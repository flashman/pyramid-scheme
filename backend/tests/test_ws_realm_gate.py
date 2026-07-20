"""realm_enter must be gated on the channel owner's unlocks.

The astral rule: a projection join validates against the **host's** unlocks,
not the projector's — scouting a downline member's realm is sanctioned even
where the projector has never been.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.channels import ChannelRegistry
from app.realms import grant_realm, invalidate_unlock_cache
from tests.conftest import TestingSessionLocal, make_user


@pytest.fixture(autouse=True)
def _clear_unlock_cache():
    invalidate_unlock_cache()
    yield
    invalidate_unlock_cache()


def make_ws():
    ws = MagicMock()
    ws.send_json = AsyncMock()
    return ws


async def _grant(uid, realm):
    async with TestingSessionLocal() as db:
        with patch("app.realms.manager") as mgr:
            mgr.send_to_user = AsyncMock()
            await grant_realm(db, uid, realm, "test")


async def test_enter_own_unlocked_realm_is_allowed():
    uid = await make_user()
    await _grant(uid, "vault")
    reg = ChannelRegistry()
    ws  = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {"username": "buyer", "projection_session": None,
                                     "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0}
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws, uid, "buyer", {"realm": "vault", "owner_id": uid})

    assert ws in reg.peers((uid, "vault"))


async def test_enter_locked_realm_is_denied():
    uid = await make_user()
    reg = ChannelRegistry()
    ws  = make_ws()
    await reg.join(ws, (uid, "world"))

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {"username": "buyer", "projection_session": None,
                                     "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0}
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws, uid, "buyer", {"realm": "council", "owner_id": uid})

    # Denied, and the socket stays where it was.
    assert ws not in reg.peers((uid, "council"))
    assert ws in reg.peers((uid, "world"))
    sent = [c[0][0] for c in ws.send_json.call_args_list]
    assert {"type": "realm_denied", "realm": "council"} in sent


async def test_default_realm_needs_no_grant():
    uid = await make_user()
    reg = ChannelRegistry()
    ws  = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {"username": "buyer", "projection_session": None,
                                     "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0}
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws, uid, "buyer", {"realm": "world", "owner_id": uid})

    assert ws in reg.peers((uid, "world"))


async def test_unknown_realm_is_denied():
    uid = await make_user()
    reg = ChannelRegistry()
    ws  = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {"username": "buyer", "projection_session": None,
                                     "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0}
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws, uid, "buyer", {"realm": "narnia", "owner_id": uid})

    assert ws not in reg.peers((uid, "narnia"))


async def test_projection_join_follows_the_host_not_the_projector():
    """Alice has never unlocked the vault; Bob has. Alice projecting into Bob
    must still be carried into Bob's vault channel."""
    alice = await make_user(username="alice")
    bob   = await make_user(username="bob")
    await _grant(bob, "vault")

    reg = ChannelRegistry()
    ws_alice = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {
            "username": "alice", "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0,
            "projection_session": {"target_id": bob},
        }
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws_alice, alice, "alice",
                              {"realm": "vault", "owner_id": bob})

    assert ws_alice in reg.peers((bob, "vault"))


async def test_projection_join_denied_where_the_host_is_not_entitled():
    alice = await make_user(username="alice")
    bob   = await make_user(username="bob")

    reg = ChannelRegistry()
    ws_alice = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {
            "username": "alice", "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0,
            "projection_session": {"target_id": bob},
        }
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws_alice, alice, "alice",
                              {"realm": "council", "owner_id": bob})

    assert ws_alice not in reg.peers((bob, "council"))
