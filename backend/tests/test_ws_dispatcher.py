"""Unit-test the WS message handlers without a live WebSocket server."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.channels import ChannelRegistry


def make_ws(user_id=1):
    ws = MagicMock()
    ws.send_json = AsyncMock()
    ws.send_text = AsyncMock()
    return ws


async def test_unknown_type_is_silently_dropped():
    """Dispatcher must not raise on unknown message types."""
    from app.routers.ws import _dispatch
    ws = make_ws()
    # Should complete without raising
    await _dispatch(ws, user_id=1, username="alice", text='{"type":"unknown_future_event","foo":1}')


async def test_ping_still_works():
    from app.routers.ws import _dispatch
    ws = make_ws()
    await _dispatch(ws, user_id=1, username="alice", text="ping")
    ws.send_text.assert_called_once_with("pong")


async def test_malformed_json_is_dropped():
    from app.routers.ws import _dispatch
    ws = make_ws()
    await _dispatch(ws, user_id=1, username="alice", text="not-json{{{")
    ws.send_json.assert_not_called()
    ws.send_text.assert_not_called()


async def test_realm_enter_joins_own_channel():
    from app.routers.ws import _on_realm_enter
    reg = ChannelRegistry()
    ws = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr:
        mock_mgr.get_meta.return_value = {}
        await _on_realm_enter(ws, user_id=5, username="bob",
                              msg={"realm": "world", "owner_id": 5})

    assert ws in reg.peers((5, "world"))


async def test_realm_enter_unauthorized_owner_rejected():
    """A player may not join another user's channel without a projection session."""
    from app.routers.ws import _on_realm_enter
    reg = ChannelRegistry()
    ws = make_ws()

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr:
        mock_mgr.get_meta.return_value = {}   # no projection_session
        await _on_realm_enter(ws, user_id=5, username="bob",
                              msg={"realm": "world", "owner_id": 99})  # not own channel

    # Should not have joined any channel
    assert reg.channel_of(ws) is None


async def test_pose_update_broadcasts_to_channel_peers():
    from app.routers.ws import _on_pose_update
    reg = ChannelRegistry()
    ws_sender = make_ws()
    ws_peer   = make_ws()

    await reg.join(ws_sender, (1, "world"))
    await reg.join(ws_peer,   (1, "world"))

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr:
        mock_mgr.get_meta.return_value = {"username": "alice", "channel_key": (1, "world")}
        await _on_pose_update(ws_sender, user_id=1,
                              msg={"px": 100, "py": 200, "pZ": 0, "facing": 1, "frame": 0})

    ws_peer.send_json.assert_called_once()
    evt = ws_peer.send_json.call_args[0][0]
    assert evt["type"] == "peer_pose"
    assert evt["px"] == 100
    ws_sender.send_json.assert_not_called()
