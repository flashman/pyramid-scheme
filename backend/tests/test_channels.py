import pytest
from unittest.mock import AsyncMock, MagicMock
from app.channels import ChannelRegistry


def make_ws():
    ws = MagicMock()
    ws.send_json = AsyncMock()
    return ws


async def test_join_places_ws_in_channel():
    reg = ChannelRegistry()
    ws = make_ws()
    await reg.join(ws, (1, "world"))
    assert ws in reg.peers((1, "world"))


async def test_leave_removes_ws_and_returns_old_key():
    reg = ChannelRegistry()
    ws = make_ws()
    await reg.join(ws, (1, "world"))
    old = reg.leave(ws)
    assert old == (1, "world")
    assert reg.peers((1, "world")) == []


async def test_join_moves_ws_from_old_channel():
    reg = ChannelRegistry()
    ws = make_ws()
    await reg.join(ws, (1, "world"))
    await reg.join(ws, (1, "nile"))
    assert reg.peers((1, "world")) == []
    assert ws in reg.peers((1, "nile"))


async def test_broadcast_sends_to_all_except_excluded():
    reg = ChannelRegistry()
    ws1, ws2, ws3 = make_ws(), make_ws(), make_ws()
    for ws in (ws1, ws2, ws3):
        await reg.join(ws, (7, "world"))
    await reg.broadcast((7, "world"), {"type": "ping"}, exclude=ws1)
    ws1.send_json.assert_not_called()
    ws2.send_json.assert_called_once_with({"type": "ping"})
    ws3.send_json.assert_called_once_with({"type": "ping"})


async def test_channel_of_returns_current_channel():
    reg = ChannelRegistry()
    ws = make_ws()
    assert reg.channel_of(ws) is None
    await reg.join(ws, (3, "nile"))
    assert reg.channel_of(ws) == (3, "nile")


async def test_broadcast_prunes_dead_sockets():
    reg = ChannelRegistry()
    ws = make_ws()
    ws.send_json.side_effect = Exception("closed")
    await reg.join(ws, (1, "world"))
    await reg.broadcast((1, "world"), {"type": "test"})
    assert reg.peers((1, "world")) == []
