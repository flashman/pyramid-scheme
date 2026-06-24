"""Tests for the project_start and project_end WS message handlers."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.channels import ChannelRegistry
from app.models import User, GameState, Recruit, Inventory
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def make_recruit_pair(recruiter_username="alice", recruit_username="bob"):
    """Create two bought-in users with a direct recruit relationship. Returns (recruiter_id, recruit_id)."""
    async with TestingSessionLocal() as db:
        alice = User(username=recruiter_username,
                     password_hash="x", email=f"{recruiter_username}@x.com")
        bob   = User(username=recruit_username,
                     password_hash="x", email=f"{recruit_username}@x.com")
        db.add_all([alice, bob])
        await db.flush()
        bob.recruiter_id = alice.id
        db.add(GameState(user_id=alice.id, bought=True, earned=100.0, invites_left=0, flags={}))
        db.add(GameState(user_id=bob.id,   bought=True, earned=100.0, invites_left=0, flags={}))
        db.add(Recruit(recruiter_id=alice.id, recruit_id=bob.id,
                       recruit_name=recruit_username, parent_name=recruiter_username, depth=1, payout=5.0))
        db.add(Inventory(user_id=alice.id, item_id="astral_lens", quantity=1))
        await db.commit()
        return alice.id, bob.id


def make_ws():
    ws = MagicMock()
    ws.send_json = AsyncMock()
    ws.send_text = AsyncMock()
    return ws


async def test_project_start_happy_path():
    alice_id, bob_id = await make_recruit_pair()
    reg = ChannelRegistry()
    ws_alice = make_ws()
    ws_bob   = make_ws()

    await reg.join(ws_alice, (alice_id, "world"))
    await reg.join(ws_bob,   (bob_id,   "world"))

    async def _noop_expiry(*a, **kw):
        pass

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal), \
         patch("app.routers.ws._projection_expiry", _noop_expiry):

        mock_mgr.get_meta.side_effect = lambda ws: {
            ws_alice: {"user_id": alice_id, "username": "alice",
                       "channel_key": (alice_id, "world"),
                       "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0,
                       "projection_session": None},
            ws_bob:   {"user_id": bob_id, "username": "bob",
                       "channel_key": (bob_id, "world"),
                       "px": 100, "py": 200, "pZ": 0, "facing": 1, "frame": 0,
                       "projection_session": None},
        }[ws]
        mock_mgr.is_connected.return_value = True
        mock_mgr.set_meta = MagicMock()
        mock_mgr.send_to_user = AsyncMock()
        mock_mgr._conns = {bob_id: {ws_bob}}

        from app.routers.ws import _on_project_start
        await _on_project_start(ws_alice, alice_id, "alice",
                                {"target_user_id": bob_id})

    # Alice should have joined Bob's channel
    assert ws_alice in reg.peers((bob_id, "world"))

    # Bob was notified via manager.send_to_user
    mock_mgr.send_to_user.assert_called_once()
    call_args = mock_mgr.send_to_user.call_args
    assert call_args[0][0] == bob_id
    assert call_args[0][1]["type"] == "projection_started"

    # Alice received world_state point-to-point
    alice_calls = [c[0][0] for c in ws_alice.send_json.call_args_list]
    a_types = [c["type"] for c in alice_calls]
    assert "world_state" in a_types


async def test_project_start_rejects_non_downline():
    alice_id, bob_id = await make_recruit_pair()
    carol_id = await make_user(username="carol")

    reg = ChannelRegistry()
    ws_alice = make_ws()
    await reg.join(ws_alice, (alice_id, "world"))

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):

        mock_mgr.get_meta.return_value = {
            "username": "alice", "channel_key": (alice_id, "world"),
            "projection_session": None,
        }
        mock_mgr.is_connected.return_value = True
        mock_mgr.send_to_user = AsyncMock()

        from app.routers.ws import _on_project_start
        await _on_project_start(ws_alice, alice_id, "alice",
                                {"target_user_id": carol_id})

    # Alice should NOT have moved channels
    assert ws_alice in reg.peers((alice_id, "world"))
    ws_alice.send_json.assert_not_called()


async def test_project_start_rejects_depth2_recruit():
    """depth=2 recruit must be rejected even though they're in the Recruit table."""
    async with TestingSessionLocal() as db:
        alice = User(username="alice2", password_hash="x")
        bob   = User(username="bob2",   password_hash="x")
        carol = User(username="carol2", password_hash="x")
        db.add_all([alice, bob, carol])
        await db.flush()
        db.add(Inventory(user_id=alice.id, item_id="astral_lens", quantity=1))
        # carol is depth=2 from alice's perspective
        db.add(Recruit(recruiter_id=alice.id, recruit_id=carol.id,
                       recruit_name="carol2", parent_name="bob2", depth=2, payout=1.0))
        await db.commit()
        alice_id, carol_id = alice.id, carol.id

    reg = ChannelRegistry()
    ws_alice = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):

        mock_mgr.get_meta.return_value = {
            "username": "alice2", "projection_session": None,
        }
        mock_mgr.is_connected.return_value = True
        mock_mgr.send_to_user = AsyncMock()

        from app.routers.ws import _on_project_start
        await _on_project_start(ws_alice, alice_id, "alice2",
                                {"target_user_id": carol_id})

    ws_alice.send_json.assert_not_called()


async def test_project_end_restores_own_channel():
    alice_id, bob_id = await make_recruit_pair()
    reg = ChannelRegistry()
    ws_alice = make_ws()
    ws_bob   = make_ws()

    await reg.join(ws_alice, (bob_id,   "world"))   # alice is projecting into bob
    await reg.join(ws_bob,   (bob_id,   "world"))

    expiry_task = MagicMock()
    expiry_task.cancel = MagicMock()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr:

        mock_mgr.get_meta.return_value = {
            "username": "alice", "channel_key": (bob_id, "world"),
            "projection_session": {"target_id": bob_id, "expiry_task": expiry_task,
                                   "own_channel": (alice_id, "world")},
        }
        mock_mgr.set_meta = MagicMock()
        mock_mgr.send_to_user = AsyncMock()

        from app.routers.ws import _on_project_end
        await _on_project_end(ws_alice, alice_id, "alice")

    # Alice back in own channel
    assert ws_alice in reg.peers((alice_id, "world"))
    # Bob's channel no longer has alice
    assert ws_alice not in reg.peers((bob_id, "world"))
    # Expiry task was cancelled
    expiry_task.cancel.assert_called_once()


async def test_disconnect_during_projection_notifies_host():
    """A projector closing their tab mid-session must cleanly end the session:
    cancel the expiry task and notify the host, even though the projector's
    own socket is already dead (send_json raises)."""
    alice_id, bob_id = await make_recruit_pair()
    reg = ChannelRegistry()
    ws_alice = make_ws()
    ws_bob   = make_ws()

    await reg.join(ws_alice, (bob_id, "world"))   # alice projecting into bob
    await reg.join(ws_bob,   (bob_id, "world"))

    # Projector socket is gone — any send blows up.
    ws_alice.send_json = AsyncMock(side_effect=RuntimeError("socket closed"))

    expiry_task = MagicMock()
    expiry_task.cancel = MagicMock()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr:

        mock_mgr.get_meta.return_value = {
            "username": "alice", "channel_key": (bob_id, "world"),
            "projection_session": {"target_id": bob_id, "expiry_task": expiry_task,
                                   "own_channel": (alice_id, "world")},
        }
        mock_mgr.set_meta   = MagicMock()
        mock_mgr.disconnect = MagicMock()
        mock_mgr.send_to_user = AsyncMock()

        from app.routers.ws import _handle_disconnect
        # Must not raise despite the dead projector socket.
        await _handle_disconnect(ws_alice, alice_id, "alice")

    # Host was notified the session ended...
    host_calls = [c for c in mock_mgr.send_to_user.await_args_list
                  if c.args[0] == bob_id
                  and c.args[1].get("type") == "projection_ended"]
    assert host_calls, "host must receive projection_ended on projector disconnect"
    assert host_calls[0].args[1]["reason"] == "disconnected"
    # ...the runaway expiry timer was cancelled...
    expiry_task.cancel.assert_called_once()
    # ...and the connection was reaped.
    mock_mgr.disconnect.assert_called_once()
