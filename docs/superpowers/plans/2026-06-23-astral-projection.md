# Astral Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `astral_lens` shop keepsake that lets an upline player project into a direct recruit's live game world — both see each other's pharaohs moving independently and can chat — while establishing the channel-registry + bidirectional-WS foundation for full multi-user co-presence.

**Architecture:** A `ChannelRegistry` singleton maps `(owner_id, realm_id)` → set of WebSocket connections. The WS receive loop becomes a typed JSON dispatcher. Client sends `pose_update` while peers are present; server relays to all channel members. Projection moves the projector's socket into the target's channel for the session duration.

**Tech Stack:** FastAPI + asyncpg + SQLAlchemy async (backend); vanilla JS ES modules, canvas 2D (frontend); existing Resend/SMTP email path; pytest with asyncio_mode=auto.

## Global Constraints

- Branch: `feat/astral-projection` (already created)
- No new Alembic migrations — all new server state is ephemeral (in-memory) or reuses `Transaction` with new `type` strings
- `SHOP_CATALOGUE` in `backend/app/shop.py` is the single source of truth for prices — never hardcode prices in JS
- Frontend has no bundler — native ES modules only; no npm/build step
- All auth decisions use `user_id` from the JWT-authenticated WS socket, never from message payload fields
- `drawPharaoh()` in `frontend/draw/pharaoh.js` checks `G.bought` — ghost peer rendering uses the new `drawPeerPharaoh()` which skips that guard
- `asyncio_mode = auto` in `backend/pytest.ini` — all test functions can be `async def` without decorators
- Tests use SQLite in-memory DB via `conftest.py` helpers: `make_user()`, `auth_headers()`, `TestingSessionLocal`

---

### Task 1: ChannelRegistry + ConnectionManager metadata

**Files:**
- Create: `backend/app/channels.py`
- Modify: `backend/app/ws.py`
- Create: `backend/tests/test_channels.py`

**Interfaces:**
- Produces: `channels` singleton with `join(ws, key)`, `leave(ws) → old_key | None`, `broadcast(key, event, exclude=None)`, `peers(key, exclude=None) → list[WebSocket]`, `channel_of(ws) → tuple | None`
- Produces: `manager.set_meta(ws, **kwargs)`, `manager.get_meta(ws) → dict`, `manager.remove_meta(ws)`

- [ ] **Step 1: Write tests for ChannelRegistry**

```python
# backend/tests/test_channels.py
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker compose exec backend pytest tests/test_channels.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.channels'`

- [ ] **Step 3: Create ChannelRegistry**

```python
# backend/app/channels.py
"""
Channel registry — maps (owner_id | None, realm_id) → set[WebSocket].

Personal realm:  (user_id, realm_id)
System realm:    (None,    realm_id)   — reserved for future cantina/ocean

Every connected player occupies exactly one channel. Moving realms means
leave-old + join-new. Projection means joining the target's channel instead
of your own.
"""
from __future__ import annotations
from fastapi import WebSocket


class ChannelRegistry:
    def __init__(self):
        self._channels: dict[tuple, set[WebSocket]] = {}
        self._ws_channel: dict[WebSocket, tuple] = {}

    async def join(self, ws: WebSocket, key: tuple) -> None:
        """Move ws to key; leave any prior channel first."""
        self.leave(ws)
        self._channels.setdefault(key, set()).add(ws)
        self._ws_channel[ws] = key

    def leave(self, ws: WebSocket) -> tuple | None:
        """Remove ws from its current channel. Returns the old key or None."""
        old_key = self._ws_channel.pop(ws, None)
        if old_key is not None:
            bucket = self._channels.get(old_key)
            if bucket:
                bucket.discard(ws)
                if not bucket:
                    del self._channels[old_key]
        return old_key

    async def broadcast(self, key: tuple, event: dict,
                        exclude: WebSocket | None = None) -> None:
        """Send event JSON to all sockets in key, pruning dead ones."""
        dead: list[WebSocket] = []
        for ws in list(self._channels.get(key, set())):
            if ws is exclude:
                continue
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.leave(ws)

    def peers(self, key: tuple,
              exclude: WebSocket | None = None) -> list[WebSocket]:
        return [ws for ws in self._channels.get(key, set()) if ws is not exclude]

    def channel_of(self, ws: WebSocket) -> tuple | None:
        return self._ws_channel.get(ws)


channels = ChannelRegistry()
```

- [ ] **Step 4: Add `_meta` and helpers to ConnectionManager**

Open `backend/app/ws.py`. Add `_meta` dict to `__init__` and three helper methods after `is_connected`:

```python
# In __init__, after self._conns line:
self._meta: dict[WebSocket, dict] = {}

# New methods after is_connected():
def set_meta(self, ws: WebSocket, **kwargs) -> None:
    self._meta.setdefault(ws, {}).update(kwargs)

def get_meta(self, ws: WebSocket) -> dict:
    return self._meta.get(ws, {})

def remove_meta(self, ws: WebSocket) -> None:
    self._meta.pop(ws, None)
```

Also update `disconnect` to call `self.remove_meta(ws)`:
```python
def disconnect(self, user_id: int, ws: WebSocket):
    bucket = self._conns.get(user_id)
    if bucket:
        bucket.discard(ws)
        if not bucket:
            del self._conns[user_id]
    self.remove_meta(ws)   # ← add this line
```

- [ ] **Step 5: Run tests — all should pass**

```bash
docker compose exec backend pytest tests/test_channels.py -v
```
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/channels.py backend/app/ws.py backend/tests/test_channels.py
git commit -m "feat: ChannelRegistry + ConnectionManager per-socket metadata"
```

---

### Task 2: Bidirectional WS dispatcher (realm_enter, pose_update, chat)

**Files:**
- Modify: `backend/app/routers/ws.py`
- Create: `backend/tests/test_ws_dispatcher.py`

**Interfaces:**
- Consumes: `channels` from `app.channels`, `manager` from `app.ws`
- Produces: typed handler functions `_on_realm_enter`, `_on_pose_update`, `_on_chat` (called by dispatcher; also testable directly)

- [ ] **Step 1: Write dispatcher unit tests**

```python
# backend/tests/test_ws_dispatcher.py
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
docker compose exec backend pytest tests/test_ws_dispatcher.py -v
```
Expected: ImportError on `_dispatch`, `_on_realm_enter`, etc.

- [ ] **Step 3: Rewrite `backend/app/routers/ws.py`**

```python
"""
WebSocket endpoint.  Clients connect with JWT as a query param:
    ws://host/ws?token=<JWT>

Client → Server typed messages (JSON objects with a `type` field):
  realm_enter   {realm, owner_id}           — player entered a realm
  pose_update   {px, py, pZ, facing, frame} — position broadcast (~10 Hz)
  chat          {text}                       — channel-scoped chat (≤200 chars)
  project_start {target_user_id}            — initiate projection (Task 3)
  project_end   {}                          — end projection session (Task 3)

The string "ping" is still handled for keep-alive.
"""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.auth import decode_token
from app.ws import manager
from app.channels import channels

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4001)
        return
    try:
        user_id  = int(payload["sub"])
        username = payload.get("username", str(user_id))
    except (KeyError, ValueError, TypeError):
        await ws.close(code=4001)
        return

    await manager.connect(user_id, ws)
    manager.set_meta(ws, user_id=user_id, username=username,
                     channel_key=None, px=0, py=0, pZ=0,
                     facing=1, frame=0, projection_session=None)
    try:
        while True:
            text = await ws.receive_text()
            await _dispatch(ws, user_id, username, text)
    except WebSocketDisconnect:
        await _handle_disconnect(ws, user_id, username)


async def _dispatch(ws: WebSocket, user_id: int, username: str, text: str):
    if text == "ping":
        await ws.send_text("pong")
        return
    try:
        msg = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return
    t = msg.get("type")
    if   t == "realm_enter":   await _on_realm_enter(ws, user_id, username, msg)
    elif t == "pose_update":   await _on_pose_update(ws, user_id, msg)
    elif t == "chat":          await _on_chat(ws, user_id, username, msg)
    elif t == "project_start": await _on_project_start(ws, user_id, username, msg)
    elif t == "project_end":   await _on_project_end(ws, user_id, username)
    # unknown types silently dropped


async def _on_realm_enter(ws: WebSocket, user_id: int, username: str, msg: dict):
    realm    = msg.get("realm", "world")
    owner_id = msg.get("owner_id")
    meta     = manager.get_meta(ws)
    session  = meta.get("projection_session")

    # Only allow joining own channel or an active projection target's channel
    if owner_id == user_id:
        new_key = (user_id, realm)
    elif session and session.get("target_id") == owner_id:
        new_key = (owner_id, realm)
    else:
        return  # unauthorized — stay in current channel

    old_key = channels.channel_of(ws)

    # Notify old channel this player left
    if old_key:
        await channels.broadcast(old_key,
                                 {"type": "peer_left", "username": username},
                                 exclude=ws)

    # If host is transitioning realms, carry visitors along
    if owner_id == user_id and old_key and old_key[0] == user_id:
        for visitor_ws in channels.peers(old_key):
            v_meta = manager.get_meta(visitor_ws)
            v_session = v_meta.get("projection_session") or {}
            if v_session.get("target_id") == user_id:
                await channels.join(visitor_ws, new_key)
                manager.set_meta(visitor_ws, channel_key=new_key)
                await visitor_ws.send_json({
                    "type": "host_realm_changed",
                    "realm": realm,
                    "world_state": {"realm": realm, "recruits": [], "owner_username": username},
                })

    await channels.join(ws, new_key)
    manager.set_meta(ws, channel_key=new_key)

    # Announce arrival to new channel
    await channels.broadcast(new_key, {
        "type": "peer_entered", "username": username,
        "px": meta.get("px", 0), "py": meta.get("py", 0),
        "pZ": meta.get("pZ", 0), "facing": meta.get("facing", 1),
        "frame": meta.get("frame", 0),
        "is_projector": bool(session),
    }, exclude=ws)


async def _on_pose_update(ws: WebSocket, user_id: int, msg: dict):
    meta = manager.get_meta(ws)
    key  = meta.get("channel_key")
    if not key:
        return
    manager.set_meta(ws,
                     px=msg.get("px", 0), py=msg.get("py", 0),
                     pZ=msg.get("pZ", 0), facing=msg.get("facing", 1),
                     frame=msg.get("frame", 0))
    await channels.broadcast(key, {
        "type": "peer_pose", "username": meta["username"],
        "px": msg.get("px", 0), "py": msg.get("py", 0),
        "pZ": msg.get("pZ", 0), "facing": msg.get("facing", 1),
        "frame": msg.get("frame", 0),
    }, exclude=ws)


async def _on_chat(ws: WebSocket, user_id: int, username: str, msg: dict):
    text = str(msg.get("text", ""))[:200]
    if not text.strip():
        return
    key = manager.get_meta(ws).get("channel_key")
    if not key:
        return
    await channels.broadcast(key, {
        "type": "chat_message", "from_username": username, "text": text,
    })


async def _on_project_start(ws: WebSocket, user_id: int, username: str, msg: dict):
    # Implemented in Task 3
    pass


async def _on_project_end(ws: WebSocket, user_id: int, username: str,
                          reason: str = "departed"):
    # Implemented in Task 3
    pass


async def _handle_disconnect(ws: WebSocket, user_id: int, username: str):
    key = channels.channel_of(ws)
    if key:
        await channels.broadcast(key, {"type": "peer_left", "username": username})
        channels.leave(ws)
    manager.disconnect(user_id, ws)
```

- [ ] **Step 4: Run dispatcher tests**

```bash
docker compose exec backend pytest tests/test_ws_dispatcher.py -v
```
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/ws.py backend/tests/test_ws_dispatcher.py
git commit -m "feat: bidirectional WS dispatcher — realm_enter, pose_update, chat"
```

---

### Task 3: project_start / project_end WS handlers

**Files:**
- Modify: `backend/app/routers/ws.py` (fill in `_on_project_start` and `_on_project_end`)
- Create: `backend/tests/test_astral_ws.py`

**Interfaces:**
- Consumes: `channels`, `manager`, `AsyncSessionLocal` from `app.database`, `Recruit`, `Inventory` from `app.models`
- Produces: complete projection session lifecycle — server-authoritative 180s timer, `world_state` point-to-point, `peer_entered` broadcast, `projection_ended` on expiry

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_astral_ws.py
"""Tests for the project_start and project_end WS message handlers."""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import select
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


def make_ws(user_id=None):
    ws = MagicMock()
    ws.send_json = AsyncMock()
    ws.send_text = AsyncMock()
    return ws


async def test_project_start_happy_path():
    alice_id, bob_id = await make_recruit_pair()
    reg = ChannelRegistry()
    ws_alice = make_ws()
    ws_bob   = make_ws()

    # Both join their own channels
    await reg.join(ws_alice, (alice_id, "world"))
    await reg.join(ws_bob,   (bob_id,   "world"))

    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mock_mgr:
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

        from app.routers.ws import _on_project_start
        await _on_project_start(ws_alice, alice_id, "alice",
                                {"target_user_id": bob_id})

    # Alice should have joined Bob's channel
    assert ws_alice in reg.peers((bob_id, "world"))
    # Bob received projection_started
    bob_calls = [c[0][0] for c in ws_bob.send_json.call_args_list]
    types = [c["type"] for c in bob_calls]
    assert "projection_started" in types
    # Alice received world_state (point-to-point)
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
         patch("app.routers.ws.manager") as mock_mgr:
        mock_mgr.get_meta.return_value = {
            "username": "alice", "channel_key": (alice_id, "world"),
            "projection_session": None,
        }
        mock_mgr.is_connected.return_value = True

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
         patch("app.routers.ws.manager") as mock_mgr:
        mock_mgr.get_meta.return_value = {
            "username": "alice2", "projection_session": None,
        }
        mock_mgr.is_connected.return_value = True

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

        from app.routers.ws import _on_project_end
        await _on_project_end(ws_alice, alice_id, "alice")

    # Alice back in own channel
    assert ws_alice in reg.peers((alice_id, "world"))
    # Bob's channel no longer has alice
    assert ws_alice not in reg.peers((bob_id, "world"))
    # Expiry task was cancelled
    expiry_task.cancel.assert_called_once()
```

- [ ] **Step 2: Run to confirm failure**

```bash
docker compose exec backend pytest tests/test_astral_ws.py -v
```
Expected: import passes (stubs exist) but `test_project_start_happy_path` fails — alice doesn't move channels.

- [ ] **Step 3: Implement `_on_project_start` in `backend/app/routers/ws.py`**

Add the following imports at the top of the file:
```python
import asyncio
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models import Recruit, Inventory, User
```

Then replace the stub `_on_project_start`:

```python
async def _on_project_start(ws: WebSocket, user_id: int, username: str, msg: dict):
    target_id = msg.get("target_user_id")
    if not isinstance(target_id, int):
        return

    async with AsyncSessionLocal() as db:
        # 1. Validate: target is a direct (depth=1) real recruit of this user
        recruit_row = (await db.execute(
            select(Recruit).where(
                Recruit.recruiter_id == user_id,
                Recruit.recruit_id   == target_id,
                Recruit.recruit_id   != None,      # noqa: E711
                Recruit.depth        == 1,
            )
        )).scalar_one_or_none()
        if not recruit_row:
            return

        # 2. Validate: projector owns astral_lens
        inv = (await db.execute(
            select(Inventory).where(
                Inventory.user_id == user_id,
                Inventory.item_id == "astral_lens",
                Inventory.quantity >= 1,
            )
        )).scalar_one_or_none()
        if not inv:
            return

        # 3. Validate: target is online
        if not manager.is_connected(target_id):
            return

        # 4. Fetch target's recruits for world_state
        target_recruits = (await db.execute(
            select(Recruit).where(Recruit.recruiter_id == target_id)
        )).scalars().all()

        # 5. Fetch target username
        target_user = (await db.execute(
            select(User).where(User.id == target_id)
        )).scalar_one_or_none()
        target_username = target_user.username if target_user else str(target_id)

    recruits_payload = [
        {"id": r.id, "name": r.recruit_name, "depth": r.depth,
         "payout": float(r.payout), "parent_name": r.parent_name, "meta": r.meta}
        for r in target_recruits
    ]

    # 6. Notify target — "A presence stirs"
    await manager.send_to_user(target_id, {
        "type": "projection_started", "from_username": username,
    })

    # 7. Send world_state point-to-point to projector
    meta = manager.get_meta(ws)
    target_meta = {}
    for t_ws in channels.peers(manager.get_meta(ws).get("channel_key") or ()):
        pass  # find target's current realm from their meta
    # Get target's current realm from their socket metadata
    from app.ws import manager as _mgr
    target_realm = "world"
    for t_ws in list(getattr(_mgr, '_conns', {}).get(target_id, [])):
        t_meta = _mgr.get_meta(t_ws)
        if t_meta.get("channel_key"):
            target_realm = t_meta["channel_key"][1]
            break

    await ws.send_json({
        "type": "world_state",
        "realm": target_realm,
        "owner_username": target_username,
        "recruits": recruits_payload,
    })

    # 8. Move projector into target's channel
    own_channel = meta.get("channel_key") or (user_id, "world")
    new_key = (target_id, target_realm)
    await channels.join(ws, new_key)

    # 9. Broadcast peer_entered to target's channel
    await channels.broadcast(new_key, {
        "type": "peer_entered", "username": username,
        "px": meta.get("px", 0), "py": meta.get("py", 0),
        "pZ": meta.get("pZ", 0), "facing": meta.get("facing", 1),
        "frame": meta.get("frame", 0), "is_projector": True,
    }, exclude=ws)

    # 10. Schedule server-authoritative expiry
    expiry_task = asyncio.create_task(_projection_expiry(ws, user_id, username))
    manager.set_meta(ws,
                     channel_key=new_key,
                     projection_session={
                         "target_id": target_id,
                         "own_channel": own_channel,
                         "expiry_task": expiry_task,
                     })


async def _projection_expiry(ws: WebSocket, user_id: int, username: str):
    await asyncio.sleep(180)
    await _on_project_end(ws, user_id, username, reason="timeout")
```

- [ ] **Step 4: Implement `_on_project_end` in `backend/app/routers/ws.py`**

Replace the stub:

```python
async def _on_project_end(ws: WebSocket, user_id: int, username: str,
                          reason: str = "departed"):
    meta    = manager.get_meta(ws)
    session = meta.get("projection_session")
    if not session:
        return

    # Cancel expiry timer if still running
    task = session.get("expiry_task")
    if task:
        task.cancel()

    target_id   = session["target_id"]
    old_key     = channels.channel_of(ws)
    own_channel = session.get("own_channel") or (user_id, "world")

    # Notify old channel: ghost leaves
    if old_key:
        await channels.broadcast(old_key,
                                 {"type": "peer_left", "username": username},
                                 exclude=ws)

    # Restore projector to own channel
    await channels.join(ws, own_channel)
    manager.set_meta(ws, channel_key=own_channel, projection_session=None)

    # Notify both parties session ended
    ended_event = {"type": "projection_ended", "from_username": username, "reason": reason}
    await ws.send_json(ended_event)
    await manager.send_to_user(target_id, ended_event)
```

- [ ] **Step 5: Run projection tests**

```bash
docker compose exec backend pytest tests/test_astral_ws.py -v
```
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/ws.py backend/tests/test_astral_ws.py
git commit -m "feat: project_start/project_end WS handlers with 3-min server timer"
```

---

### Task 4: Astral REST endpoints + beckon email

**Files:**
- Create: `backend/app/routers/astral.py`
- Modify: `backend/app/email.py` (add `send_beckon_email`)
- Modify: `backend/app/main.py` (register router)
- Create: `backend/tests/test_astral_endpoints.py`

**Interfaces:**
- Consumes: `manager` (presence check), `channels` (realm lookup), `AsyncSessionLocal`, `Recruit`, `Transaction`, `User` models, `get_current_user`, `send_beckon_email`
- Produces: `GET /api/astral/downline`, `POST /api/astral/beckon`

- [ ] **Step 1: Add `send_beckon_email` to `backend/app/email.py`**

Append after `send_recruit_joined_admin`:

```python
async def send_beckon_email(
    to_email: str,
    from_username: str,
    game_url: str,
) -> None:
    import html as _html
    safe_from = _html.escape(from_username)
    subject   = "A vision from above"
    text_body = (
        f"{from_username} is attempting to reach you across the astral plane.\n\n"
        f"The pyramid stirs. Enter the Desert:\n{game_url}\n\n"
        f"⚡ PYRAMID SCHEME™ — TOTALLY LEGAL™"
    )
    html_body = f"""<!DOCTYPE html>
<html>
<body style="background:#0a0500;color:#d0a060;font-family:monospace;padding:24px;margin:0">
  <h1 style="color:#f0c020;letter-spacing:3px;font-size:18px">⚡ PYRAMID SCHEME™ ⚡</h1>
  <p style="margin:16px 0">
    <strong style="color:#f0c020">{safe_from}</strong>
    is attempting to reach you across the astral plane.
  </p>
  <p style="color:#d0a060;margin:0 0 20px">The pyramid stirs.</p>
  <a href="{game_url}"
     style="display:inline-block;background:#1a0e00;border:1px solid #8a6a20;
            color:#f0c020;padding:10px 22px;text-decoration:none;
            letter-spacing:2px;font-size:13px;font-family:monospace">
    ► ENTER THE DESERT
  </a>
  <p style="color:#6a5030;font-size:11px;margin-top:16px">★ TOTALLY LEGAL™ ★</p>
</body>
</html>"""
    await _dispatch(to_email, subject, html_body, text_body,
                    from_email=settings.smtp_from, from_name="PYRAMID SCHEME")
```

- [ ] **Step 2: Write failing tests for the endpoints**

```python
# backend/tests/test_astral_endpoints.py
"""Tests for GET /api/astral/downline and POST /api/astral/beckon."""
import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from app.models import User, GameState, Recruit, Transaction, Inventory
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def make_recruit_pair_with_email():
    async with TestingSessionLocal() as db:
        alice = User(username="alice", password_hash="x", email="alice@test.com")
        bob   = User(username="bob",   password_hash="x", email="bob@test.com")
        db.add_all([alice, bob])
        await db.flush()
        bob.recruiter_id = alice.id
        db.add(GameState(user_id=alice.id, bought=True, earned=50.0, invites_left=0, flags={}))
        db.add(GameState(user_id=bob.id,   bought=True, earned=50.0, invites_left=0, flags={}))
        db.add(Recruit(recruiter_id=alice.id, recruit_id=bob.id,
                       recruit_name="bob", parent_name="alice", depth=1, payout=5.0))
        db.add(Inventory(user_id=alice.id, item_id="astral_lens", quantity=1))
        await db.commit()
        return alice.id, bob.id


async def test_downline_returns_only_own_direct_recruits(client):
    alice_id, bob_id = await make_recruit_pair_with_email()
    with patch("app.routers.astral.manager") as mock_mgr, \
         patch("app.routers.astral.channels") as mock_ch:
        mock_mgr.is_connected.return_value = True
        mock_mgr._meta = {}

        async with client as c:
            res = await c.get("/api/astral/downline",
                              headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 200
    data = res.json()
    assert len(data["downline"]) == 1
    assert data["downline"][0]["username"] == "bob"
    assert data["downline"][0]["online"] is True


async def test_downline_excludes_other_users_recruits(client):
    """Alice cannot see carol's recruits even if carol recruited dave."""
    alice_id, _ = await make_recruit_pair_with_email()

    async with client as c:
        with patch("app.routers.astral.manager") as mock_mgr:
            mock_mgr.is_connected.return_value = False
            res = await c.get("/api/astral/downline",
                              headers=auth_headers(alice_id, "alice"))

    body = res.json()
    assert all(d["username"] != "carol" for d in body.get("downline", []))


async def test_beckon_sends_email_and_records_transaction(client):
    alice_id, bob_id = await make_recruit_pair_with_email()
    with patch("app.routers.astral.send_beckon_email", new_callable=AsyncMock) as mock_email, \
         patch("app.routers.astral.manager") as mock_mgr:
        mock_mgr.is_connected.return_value = False

        async with client as c:
            res = await c.post("/api/astral/beckon",
                               json={"target_user_id": bob_id},
                               headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 200
    mock_email.assert_called_once()
    async with TestingSessionLocal() as db:
        txs = (await db.execute(
            select(Transaction).where(
                Transaction.user_id == alice_id,
                Transaction.type    == "beckon",
            )
        )).scalars().all()
        assert len(txs) == 1
        assert str(txs[0].ref_id) == str(bob_id)


async def test_beckon_rate_limit_429(client):
    alice_id, bob_id = await make_recruit_pair_with_email()
    async with TestingSessionLocal() as db:
        # Seed a recent beckon transaction
        db.add(Transaction(user_id=alice_id, type="beckon",
                           ref_id=str(bob_id), amount=0,
                           created_at=datetime.now(timezone.utc)))
        await db.commit()

    with patch("app.routers.astral.send_beckon_email", new_callable=AsyncMock) as mock_email, \
         patch("app.routers.astral.manager") as mock_mgr:
        mock_mgr.is_connected.return_value = False
        async with client as c:
            res = await c.post("/api/astral/beckon",
                               json={"target_user_id": bob_id},
                               headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 429
    mock_email.assert_not_called()


async def test_beckon_rejects_non_downline(client):
    alice_id, _ = await make_recruit_pair_with_email()
    carol_id = await make_user(username="carol")

    with patch("app.routers.astral.send_beckon_email", new_callable=AsyncMock) as mock_email, \
         patch("app.routers.astral.manager") as mock_mgr:
        mock_mgr.is_connected.return_value = False
        async with client as c:
            res = await c.post("/api/astral/beckon",
                               json={"target_user_id": carol_id},
                               headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 403
    mock_email.assert_not_called()
```

- [ ] **Step 3: Run to confirm failure**

```bash
docker compose exec backend pytest tests/test_astral_endpoints.py -v
```
Expected: 404 on all routes.

- [ ] **Step 4: Create `backend/app/routers/astral.py`**

```python
"""
Astral projection REST endpoints.

GET  /api/astral/downline          — direct recruits with online presence
POST /api/astral/beckon            — email an offline recruit to come online
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.channels import channels
from app.database import get_db
from app.email import send_beckon_email
from app.models import Recruit, Transaction, User
from app.ws import manager

router = APIRouter()

GAME_URL = "https://pyramid-scheme.live"   # overridden by env in future


class BeckonRequest(BaseModel):
    target_user_id: int


@router.get("/astral/downline")
async def downline_presence(
    current_user: User  = Depends(get_current_user),
    db: AsyncSession    = Depends(get_db),
):
    """Return direct recruits (depth=1, real users only) with live presence info."""
    rows = (await db.execute(
        select(Recruit, User)
        .join(User, User.id == Recruit.recruit_id)
        .where(
            Recruit.recruiter_id == current_user.id,
            Recruit.recruit_id   != None,     # noqa: E711
            Recruit.depth        == 1,
        )
    )).all()

    result = []
    for recruit_row, user_row in rows:
        online = manager.is_connected(user_row.id)
        realm  = None
        if online:
            # Find realm from the socket metadata
            for ws in list(getattr(manager, "_conns", {}).get(user_row.id, [])):
                meta = manager.get_meta(ws)
                ch   = meta.get("channel_key")
                if ch:
                    realm = ch[1]
                    break
        result.append({
            "user_id":  user_row.id,
            "username": user_row.username,
            "online":   online,
            "realm":    realm,
        })

    return {"downline": result}


@router.post("/astral/beckon", status_code=200)
async def beckon(
    body: BeckonRequest,
    current_user: User  = Depends(get_current_user),
    db: AsyncSession    = Depends(get_db),
):
    """Email a direct recruit to come online. Rate-limited to once per hour per target."""
    # 1. Validate direct recruit relationship
    recruit_row = (await db.execute(
        select(Recruit).where(
            Recruit.recruiter_id == current_user.id,
            Recruit.recruit_id   == body.target_user_id,
            Recruit.recruit_id   != None,    # noqa: E711
            Recruit.depth        == 1,
        )
    )).scalar_one_or_none()
    if not recruit_row:
        raise HTTPException(status_code=403, detail="Not your direct recruit.")

    # 2. Rate limit: one beckon per (projector, target) per hour
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (await db.execute(
        select(Transaction).where(
            Transaction.user_id    == current_user.id,
            Transaction.type       == "beckon",
            Transaction.ref_id     == str(body.target_user_id),
            Transaction.created_at >= one_hour_ago,
        )
    )).scalar_one_or_none()
    if recent:
        raise HTTPException(status_code=429, detail="Beckon already sent in the last hour.")

    # 3. Fetch target's email
    target_user = (await db.execute(
        select(User).where(User.id == body.target_user_id)
    )).scalar_one_or_none()
    if not target_user or not target_user.email:
        raise HTTPException(status_code=422, detail="Target has no email address.")

    # 4. Record transaction (rate-limit token)
    db.add(Transaction(
        user_id=current_user.id, type="beckon",
        ref_id=str(body.target_user_id), amount=0,
    ))
    await db.commit()

    # 5. Send email (best-effort — failure is logged, not raised)
    await send_beckon_email(
        to_email=target_user.email,
        from_username=current_user.username,
        game_url=GAME_URL,
    )

    return {"ok": True}
```

- [ ] **Step 5: Register router in `backend/app/main.py`**

Add after the existing `from app.routers import ...` block:

```python
from app.routers import astral as astral_router
```

Add after the existing `app.include_router(admin_router.router, ...)` line:

```python
app.include_router(astral_router.router, prefix="/api", tags=["astral"])
```

- [ ] **Step 6: Run endpoint tests**

```bash
docker compose exec backend pytest tests/test_astral_endpoints.py -v
```
Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/astral.py backend/app/email.py backend/app/main.py \
        backend/tests/test_astral_endpoints.py
git commit -m "feat: astral REST endpoints — downline presence + beckon email"
```

---

### Task 5: Shop item + global reprice

**Files:**
- Modify: `backend/app/shop.py`
- Modify: `frontend/worlds/nile/shop/catalogue.js`
- Modify: `frontend/worlds/nile/shop/ware-art.js`

**Interfaces:**
- Consumes: existing `SHOP_CATALOGUE` dict, existing `WARES` array and `ICON` object
- Produces: `astral_lens` available in shop at $8; all prices roughly halved

- [ ] **Step 1: Write smoke test for new item**

The existing `test_shop_catalogue.py` and `catalogue.smoke.mjs` will catch us if we violate constraints. Run them first to see current state:

```bash
docker compose exec backend pytest tests/test_shop_catalogue.py -v
```

- [ ] **Step 2: Update `backend/app/shop.py`**

Replace the full `SHOP_CATALOGUE` dict (all new prices + new item):

```python
SHOP_CATALOGUE: dict = {
    "invite_scroll":      {"name": "Invite Scroll",                           "price": 2,  "kind": "consumable", "effect": {"type": "invites", "amount": 1}},
    "scarab_amulet":      {"name": "Scarab Amulet",                           "price": 4,  "kind": "keepsake"},
    "bronze_coin":        {"name": "Bronze Coin",                             "price": 3,  "kind": "keepsake"},
    "croc_sandals":       {"name": "Crocodile-leather Sandals",               "price": 6,  "kind": "keepsake"},
    "secret_flood":       {"name": "The Secret of the Flood",                "price": 12, "kind": "keepsake"},
    "secret_compounding": {"name": "The Secret of Compounding",              "price": 14, "kind": "keepsake"},
    "secret_recursion":   {"name": "The Secret of Recursion",                "price": 16, "kind": "keepsake"},
    "secret_fire":        {"name": "The Secret of Fire",                     "price": 10, "kind": "keepsake"},
    "secret_name":        {"name": "The Secret Name of God",                "price": 22, "kind": "keepsake"},
    "secret_orgchart":    {"name": "The Org Chart (Upper Portion Redacted)", "price": 18, "kind": "keepsake"},
    "paperwork_above":    {"name": "The Paperwork From Above",               "price": 15, "kind": "keepsake"},
    "tongue_stone":       {"name": "The Tongue Stone",                       "price": 13, "kind": "keepsake"},
    "attentive_reel":     {"name": "A Reel of Something Attentive",          "price": 16, "kind": "keepsake"},
    "sky_iron":           {"name": "A Sliver of Meteoric Iron",             "price": 20, "kind": "keepsake"},
    "seed_phrase":        {"name": "A Founder's Seed Phrase",               "price": 22, "kind": "keepsake"},
    "future_receipt":     {"name": "A Receipt from the Future",             "price": 6,  "kind": "keepsake"},
    "self_equity":        {"name": "Stock Certificate in Yourself",         "price": 10, "kind": "keepsake"},
    "astral_lens":        {"name": "A Lens Ground from Crushed Scarab",     "price": 8,  "kind": "keepsake"},
}
```

- [ ] **Step 3: Run shop tests to confirm no regressions**

```bash
docker compose exec backend pytest tests/test_shop_catalogue.py tests/test_shop_buy.py tests/test_shop_config.py -v
```

The `test_shop_buy.py` tests use hardcoded prices (`scarab_amulet` was $9, now $4) — update the price assertions in those tests:

In `test_shop_buy.py`, the line `assert body["earned"] == 11.0` (was 100-9=91... wait the fixture uses `earned=20.0`, so 20-9=11). Now `scarab_amulet` is $4, so `earned` should be `20.0 - 4 = 16.0`. Update:
- `assert body["earned"] == 11.0` → `assert body["earned"] == 16.0`
- `assert float(st.earned) == 41.0` → `assert float(st.earned) == 46.0` (for the 409 test: 50-4=46)
- `assert float(tx.amount) == -9.0 and tx.ref_id == "scarab_amulet"` → `assert float(tx.amount) == -4.0`

Run again:
```bash
docker compose exec backend pytest tests/test_shop_catalogue.py tests/test_shop_buy.py tests/test_shop_config.py -v
```
Expected: all pass.

- [ ] **Step 4: Add `astral_lens` to `frontend/worlds/nile/shop/catalogue.js`**

Add as the last entry in the `WARES` array, before the closing `];`:

```js
  { id: 'astral_lens',  name: 'A Lens Ground from Crushed Scarab', tier: 'RELICS', art: 'astral_lens',
    blurb: 'GRIND YOUR EYE TO A FINE POWDER AND SEE THROUGH WALLS.\nYOUR CONSCIOUSNESS WILL DEPART YOUR BODY.\nDO NOT LEAVE IT UNATTENDED — PEOPLE WILL TALK.' },
```

Also add a retort entry in `WARE_RETORTS`:
```js
  astral_lens: 'SOLD. YOUR BODY STAYS HERE. HOLD THAT THOUGHT.',
```

- [ ] **Step 5: Add icon to `frontend/worlds/nile/shop/ware-art.js`**

Add inside the `ICON` object, after the last entry and before the closing `}`:

```js
  astral_lens(X, x, y, s, t) {
    // A glowing lens — circle with inner shimmer
    const pulse = 0.7 + 0.3 * Math.sin(t / 400);
    X.fillStyle = '#2a4a6a';
    X.beginPath(); X.arc(x, y, s * 0.36, 0, Math.PI * 2); X.fill();
    X.fillStyle = '#4a8ab0';
    X.beginPath(); X.arc(x, y, s * 0.28, 0, Math.PI * 2); X.fill();
    X.save(); X.globalAlpha = pulse;
    X.fillStyle = '#a0d8ef';
    X.beginPath(); X.arc(x, y, s * 0.18, 0, Math.PI * 2); X.fill();
    X.restore();
    X.fillStyle = '#e0f0ff'; X.fillRect(x - s * 0.04, y - s * 0.22, s * 0.08, s * 0.06);
  },
```

- [ ] **Step 6: Run frontend smoke tests**

```bash
node /Users/michaelflashman/Code/Flashman/ai-slop/pyramid-scheme/frontend/worlds/nile/shop/__smoke__/catalogue.smoke.mjs
```
Expected: no errors (all WARES entries have `name`, `art`, `blurb`, `tier`; no `price` or `glyph` field).

- [ ] **Step 7: Commit**

```bash
git add backend/app/shop.py backend/tests/test_shop_buy.py \
        frontend/worlds/nile/shop/catalogue.js frontend/worlds/nile/shop/ware-art.js
git commit -m "feat: add astral_lens to shop; reprice all items to ~half"
```

---

### Task 6: Frontend WS send() + PresenceStore

**Files:**
- Modify: `frontend/game/ws.js`
- Create: `frontend/game/presence.js`

**Interfaces:**
- Produces: `gameSocket.send(data: object)` — sends JSON over the WS connection, no-ops if not open
- Produces: `PresenceStore` singleton with `upsert(username, pose)`, `remove(username)`, `peers() → array`, `clear()`

- [ ] **Step 1: Add `send()` to `frontend/game/ws.js`**

Add after the `get isOpen()` getter and before the closing `}` of `GameSocket`:

```js
  send(data) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }
```

- [ ] **Step 2: Create `frontend/game/presence.js`**

```js
// ── FILE: game/presence.js ────────────────────────────────
// PresenceStore — ephemeral registry of peers in the current channel.
//
// Each entry: { username, px, py, pZ, facing, frame }
// Hydrated from ws:peer_entered / ws:peer_pose; cleared on ws:peer_left.
// The render loop reads peers() to draw ghost pharaohs.

class _PresenceStore {
  constructor() {
    this._peers = {};   // username → pose dict
  }

  upsert(username, pose) {
    this._peers[username] = { ...pose, username };
  }

  remove(username) {
    delete this._peers[username];
  }

  peers() {
    return Object.values(this._peers);
  }

  clear() {
    this._peers = {};
  }

  get size() {
    return Object.keys(this._peers).length;
  }
}

export const PresenceStore = new _PresenceStore();
```

- [ ] **Step 3: Smoke-test (node check)**

```bash
node --check /Users/michaelflashman/Code/Flashman/ai-slop/pyramid-scheme/frontend/game/presence.js
```
Expected: no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/game/ws.js frontend/game/presence.js
git commit -m "feat: GameSocket.send() + PresenceStore for peer tracking"
```

---

### Task 7: Ghost peer rendering

**Files:**
- Modify: `frontend/draw/pharaoh.js` (add `drawPeerPharaoh`, `drawAllPeers`)
- Modify: `frontend/worlds/earth/WorldRealm.js` (line ~251)
- Modify: `frontend/worlds/nile/draw/nile.js` (line ~1189)
- Modify: `frontend/worlds/oasis/draw/oasis.js` (line ~806)
- Modify: `frontend/worlds/oasis/draw/vault.js` (line ~803)
- Modify: `frontend/worlds/council/draw/council.js` (line ~505)
- Modify: `frontend/worlds/crypt/draw/chamber.js` (line ~95)
- Modify: `frontend/worlds/atlantis/draw/atlantis.js` (line ~2188)
- Modify: `frontend/worlds/deep/draw/deep.js` (line ~1017)

**Interfaces:**
- Consumes: `_drawBody` (already exported from `pharaoh.js`), `PresenceStore.peers()`, `X` canvas context, `CH` canvas height
- Produces: `drawPeerPharaoh(pose, viewerCamX)`, `drawAllPeers(realm)` (both exported)

- [ ] **Step 1: Add `drawPeerPharaoh` and `drawAllPeers` to `frontend/draw/pharaoh.js`**

Add this import at the top of the file (after the existing imports):

```js
import { PresenceStore } from '../game/presence.js';
```

Append these two functions at the bottom of the file:

```js
/**
 * Draw a ghost pharaoh for a remote peer at their reported position,
 * using the local viewer's camera. No G.bought guard; no speech bubble.
 * Reduced opacity distinguishes ghosts from the local player.
 *
 * @param {object} pose      - peer pose: {px, py, pZ, facing, frame}
 * @param {number} viewerCamX - the local player's current camX
 */
export function drawPeerPharaoh(pose, viewerCamX) {
  X.save();
  X.globalAlpha = 0.55;

  const sx  = Math.round(pose.px - viewerCamX);
  const bob = Math.sin(Date.now() / 600) * 1.5;
  const dir = pose.facing ?? 1;
  const fr  = pose.frame  ?? 0;

  if (pose.pZ === -1) {
    // Swimming / floating realm (Atlantis, Deep)
    const scale  = 1.4;
    const feetY  = CH - 32;
    const pivotX = sx + 16;
    X.translate(pivotX, feetY);
    X.scale(dir === -1 ? -scale : scale, scale);
    _drawBody(-16, -48 + bob, fr);
  } else {
    const sy = Math.round(pose.py - 48 + bob);
    if (dir === -1) { X.translate(sx + 16, 0); X.scale(-1, 1); }
    const bx = dir === -1 ? 0 : sx;
    _drawBody(bx, sy, fr);
  }

  X.restore();
}

/**
 * Draw all peers currently in the channel as ghost pharaohs.
 * Call this from each realm's render() after drawing the local pharaoh.
 */
export function drawAllPeers(realm) {
  const localPose = realm.getPlayerPose();
  if (!localPose) return;
  for (const peer of PresenceStore.peers()) {
    drawPeerPharaoh(peer, localPose.camX);
  }
}
```

- [ ] **Step 2: Wire `drawAllPeers` into WorldRealm**

In `frontend/worlds/earth/WorldRealm.js`:

Find the import line:
```js
import { drawPharaoh }   from '../../draw/pharaoh.js';
```
Change to:
```js
import { drawPharaoh, drawAllPeers } from '../../draw/pharaoh.js';
```

Find in `render()` (around line 251):
```js
drawPharaoh();
```
Add after it:
```js
drawAllPeers(this);
```

- [ ] **Step 3: Wire into NileRealm draw**

In `frontend/worlds/nile/draw/nile.js` (around line 1189):

Find:
```js
drawRealmPharaoh(realm);
```
Add after it (on the next line):
```js
drawAllPeers(realm);
```

Add import at top of file with the existing pharaoh import:
```js
import { drawRealmPharaoh, drawAllPeers } from '../../../draw/pharaoh.js';
```
(Replace the existing `import { drawRealmPharaoh }` line.)

- [ ] **Step 4: Wire into OasisRealm draw**

In `frontend/worlds/oasis/draw/oasis.js` (around line 806):

Add import at top (update existing pharaoh import to include `drawAllPeers`).

Find the `drawPharaoh({...})` call in the `drawOasis` function. Add after it:
```js
drawAllPeers(realm);
```

- [ ] **Step 5: Wire into VaultRealm draw**

In `frontend/worlds/oasis/draw/vault.js` (around line 803):

Update pharaoh import to include `drawAllPeers`. After `drawVaultPharaoh(realm)`:
```js
drawAllPeers(realm);
```

- [ ] **Step 6: Wire into CouncilRealm draw**

In `frontend/worlds/council/draw/council.js` (around line 505):

Update import. After `drawCouncilPharaoh(realm)`:
```js
drawAllPeers(realm);
```

- [ ] **Step 7: Wire into ChamberRealm draw**

In `frontend/worlds/crypt/draw/chamber.js` (around line 95):

Update import. After `drawChamberPharaoh(realm)`:
```js
drawAllPeers(realm);
```

- [ ] **Step 8: Wire into AtlantisRealm draw**

In `frontend/worlds/atlantis/draw/atlantis.js` (around line 2188):

Update import to include `drawAllPeers`. After `drawSwimmingPharaoh(realm)`:
```js
drawAllPeers(realm);
```

- [ ] **Step 9: Wire into DeepRealm draw**

In `frontend/worlds/deep/draw/deep.js` (around line 1017):

Update import. After `drawDeepSwimmer(realm)`:
```js
drawAllPeers(realm);
```

- [ ] **Step 10: Syntax check all modified files**

```bash
node --check frontend/draw/pharaoh.js
node --check frontend/worlds/earth/WorldRealm.js
node --check frontend/worlds/nile/draw/nile.js
node --check frontend/worlds/oasis/draw/oasis.js
node --check frontend/worlds/oasis/draw/vault.js
node --check frontend/worlds/council/draw/council.js
node --check frontend/worlds/crypt/draw/chamber.js
node --check frontend/worlds/atlantis/draw/atlantis.js
node --check frontend/worlds/deep/draw/deep.js
```
Expected: no syntax errors on any file.

- [ ] **Step 11: Commit**

```bash
git add frontend/draw/pharaoh.js \
        frontend/worlds/earth/WorldRealm.js \
        frontend/worlds/nile/draw/nile.js \
        frontend/worlds/oasis/draw/oasis.js \
        frontend/worlds/oasis/draw/vault.js \
        frontend/worlds/council/draw/council.js \
        frontend/worlds/crypt/draw/chamber.js \
        frontend/worlds/atlantis/draw/atlantis.js \
        frontend/worlds/deep/draw/deep.js
git commit -m "feat: drawPeerPharaoh + drawAllPeers wired into all realm renders"
```

---

### Task 8: AstralChat DOM + module

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Create: `frontend/game/astral-chat.js`

**Interfaces:**
- Produces: `AstralChat` singleton with `activate()`, `deactivate()`, `addMessage(fromUsername, text)`, `isActive → bool`

- [ ] **Step 1: Add `#astral-chat` to `frontend/index.html`**

Find:
```html
    <div id="dlg">
```
Add before it:
```html
    <div id="astral-chat">
      <div id="astral-chat-log"></div>
      <input id="astral-chat-input" type="text" maxlength="200" placeholder="speak into the ether…" autocomplete="off">
    </div>
```

- [ ] **Step 2: Add CSS to `frontend/style.css`**

Append at the end of the file:

```css
/* ── Astral chat overlay ─────────────────────────────── */
#astral-chat {
  display: none;
  width: 780px;
  background: #06020a;
  border: 2px solid #4a2a8a;
  border-bottom: 1px solid #2a1a5a;
  padding: 8px 14px 10px;
  box-sizing: border-box;
}
#astral-chat.active { display: block; }
#astral-chat-log {
  color: #c8a0f0;
  font-size: 6px;
  line-height: 1.9;
  min-height: 40px;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
  margin-bottom: 6px;
}
#astral-chat-input {
  display: none;
  width: 100%;
  background: #0e0618;
  border: 1px solid #4a2a8a;
  color: #e8d0ff;
  font-family: monospace;
  font-size: 6px;
  padding: 3px 6px;
  box-sizing: border-box;
}
#astral-chat-input.open { display: block; }
```

- [ ] **Step 3: Create `frontend/game/astral-chat.js`**

```js
// ── FILE: game/astral-chat.js ─────────────────────────────
// AstralChat — in-channel text chat overlay for astral projection sessions.
//
// Completely decoupled from DialogueManager — uses #astral-chat, not #dlg.
// Activate/deactivate with the projection session lifecycle.
//
// Keyboard: Enter opens input; Enter again (or Escape) submits/closes.

import { gameSocket } from './ws.js';

const _el      = () => document.getElementById('astral-chat');
const _log     = () => document.getElementById('astral-chat-log');
const _input   = () => document.getElementById('astral-chat-input');

class _AstralChat {
  constructor() {
    this._active = false;
    this._bound  = false;
  }

  get isActive() { return this._active; }

  activate() {
    this._active = true;
    _el()?.classList.add('active');
    this._bindKeys();
  }

  deactivate() {
    this._active = false;
    _el()?.classList.remove('active');
    const inp = _input();
    if (inp) {
      inp.classList.remove('open');
      inp.value = '';
    }
  }

  addMessage(fromUsername, text) {
    const log = _log();
    if (!log) return;
    const line = document.createElement('div');
    line.textContent = `${fromUsername}: ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // Call from the game's keydown handler when projection is active.
  // Returns true if the key was consumed.
  onKeyDown(key) {
    if (!this._active) return false;
    const inp = _input();
    if (!inp) return false;
    const open = inp.classList.contains('open');

    if (key === 'Enter' || key === 'T') {
      if (!open) {
        inp.classList.add('open');
        inp.focus();
        return true;
      } else {
        this._submit();
        return true;
      }
    }
    if (key === 'Escape' && open) {
      inp.classList.remove('open');
      inp.value = '';
      inp.blur();
      return true;
    }
    return false;
  }

  _submit() {
    const inp  = _input();
    const text = inp?.value?.trim();
    if (text) {
      gameSocket.send({ type: 'chat', text });
    }
    if (inp) {
      inp.value = '';
      inp.classList.remove('open');
      inp.blur();
    }
  }

  _bindKeys() {
    if (this._bound) return;
    this._bound = true;
    // Input field: Enter submits
    const inp = _input();
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this._submit(); }
        if (e.key === 'Escape') {
          inp.value = '';
          inp.classList.remove('open');
          inp.blur();
        }
        e.stopPropagation();  // prevent game keys from firing
      });
    }
  }
}

export const AstralChat = new _AstralChat();
```

- [ ] **Step 4: Syntax check**

```bash
node --check frontend/game/astral-chat.js
```

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/style.css frontend/game/astral-chat.js
git commit -m "feat: AstralChat overlay — #astral-chat DOM, CSS, and module"
```

---

### Task 9: AstralSession module

**Files:**
- Create: `frontend/game/astral.js`

**Interfaces:**
- Consumes: `gameSocket.send()`, `PresenceStore`, `AstralChat`, `Inventory.owned()`, `RealmManager`, `Api`, `G.userId`, `Events`
- Produces: `AstralSession` singleton with `init()` (call once after session start), `isProjecting → bool`

- [ ] **Step 1: Create `frontend/game/astral.js`**

```js
// ── FILE: game/astral.js ──────────────────────────────────
// AstralSession — manages the full astral projection lifecycle on the client.
//
// Activation: press 'A' while owning astral_lens and not currently projecting.
// Shows an overlay listing direct recruits (online → selectable; offline → Beckon).
// On confirm: sends project_start, receives world_state, switches realm.
// On end: receives projection_ended or sends project_end, restores prior realm.
//
// Depends on: gameSocket.send(), PresenceStore, AstralChat, Inventory,
//             RealmManager, Api, G (for userId + username), Events.

import { gameSocket }    from './ws.js';
import { PresenceStore } from './presence.js';
import { AstralChat }    from './astral-chat.js';
import { Inventory }     from './inventory.js';
import { Events }        from '../engine/events.js';
import { Api }           from './api.js';
import { G }             from './state.js';
import { X, CW, CH }     from '../engine/canvas.js';

const SESSION_DURATION_MS = 180_000;

class _AstralSession {
  constructor() {
    this._projecting    = false;
    this._overlayOpen   = false;
    this._downline      = [];      // [{ user_id, username, online, realm }]
    this._selectedIndex = 0;
    this._priorRealm    = null;    // realm id before projection
    this._timerEnd      = null;
    this._poseInterval  = null;
    this._realmManager  = null;    // set by init()
  }

  get isProjecting() { return this._projecting; }
  get isOverlayOpen() { return this._overlayOpen; }

  // ── Public ───────────────────────────────────────────────

  init(realmManager) {
    this._realmManager = realmManager;
    this._wireEvents();
  }

  // Called by the active realm's onKeyDown — returns true if consumed.
  onKeyDown(key) {
    // Chat overlay intercepts first
    if (AstralChat.onKeyDown(key)) return true;

    if (this._overlayOpen) {
      if (key === 'ArrowUp')   { this._selectedIndex = Math.max(0, this._selectedIndex - 1); return true; }
      if (key === 'ArrowDown') { this._selectedIndex = Math.min(this._downline.length - 1, this._selectedIndex + 1); return true; }
      if (key === 'Enter' || key === ' ' || key === 'z' || key === 'Z') {
        this._confirmSelection(); return true;
      }
      if (key === 'Escape') { this._closeOverlay(); return true; }
      return true;  // absorb all keys while overlay is open
    }

    if (key === 'a' || key === 'A') {
      if (this._projecting) { this._endProjection(); return true; }
      if (Inventory.owned('astral_lens')) { this._openOverlay(); return true; }
    }

    if (this._projecting && (key === 'Escape')) {
      this._endProjection(); return true;
    }

    return false;
  }

  // ── Overlay ──────────────────────────────────────────────

  async _openOverlay() {
    this._overlayOpen = true;
    this._selectedIndex = 0;
    try {
      const res = await Api.get('/api/astral/downline');
      this._downline = res.downline || [];
    } catch {
      this._downline = [];
    }
  }

  _closeOverlay() {
    this._overlayOpen = false;
  }

  // Called from each realm's render() when overlay is open.
  renderOverlay() {
    if (!this._overlayOpen) return;
    const PAD  = 20;
    const W    = CW - PAD * 2;
    const H    = Math.min(200, 60 + this._downline.length * 20);
    const ox   = PAD;
    const oy   = (CH - H) / 2;

    X.fillStyle   = '#08040e';
    X.strokeStyle = '#4a2a8a';
    X.lineWidth   = 2;
    X.fillRect(ox, oy, W, H);
    X.strokeRect(ox, oy, W, H);

    X.fillStyle = '#c8a0f0';
    X.font      = '7px monospace';
    X.fillText('ASTRAL LENS — SELECT A DOWNLINE', ox + 10, oy + 16);

    if (this._downline.length === 0) {
      X.fillStyle = '#7a5a9a';
      X.fillText('THE SANDS ARE STILL. NO SOUL STIRS BELOW YOU.', ox + 10, oy + 40);
      return;
    }

    this._downline.forEach((entry, i) => {
      const ly     = oy + 34 + i * 20;
      const sel    = i === this._selectedIndex;
      X.fillStyle  = sel ? '#e8d0ff' : '#8a6aaa';
      const status = entry.online
        ? `[ONLINE — ${entry.realm || '?'}]`
        : '[OFFLINE — BECKON]';
      X.fillText(`${sel ? '► ' : '  '}${entry.username.toUpperCase()}  ${status}`, ox + 10, ly);
    });

    X.fillStyle = '#4a2a8a';
    X.font      = '5px monospace';
    X.fillText('ENTER to project / beckon   ESC to close', ox + 10, oy + H - 8);
  }

  async _confirmSelection() {
    const entry = this._downline[this._selectedIndex];
    if (!entry) return;
    this._closeOverlay();

    if (entry.online) {
      // Project
      gameSocket.send({ type: 'project_start', target_user_id: entry.user_id });
      // Projection confirmed by ws:world_state event (handled in _wireEvents)
    } else {
      // Beckon
      try {
        await Api.post('/api/astral/beckon', { target_user_id: entry.user_id });
        // Brief feedback — flash a message (handled in dialogue or HUD in future)
      } catch { /* rate limit or error — ignore for now */ }
    }
  }

  // ── Projection start (triggered by ws:world_state) ───────

  _startProjection(worldState) {
    this._projecting  = true;
    this._priorRealm  = this._realmManager?.currentRealm?.id || 'world';
    this._timerEnd    = Date.now() + SESSION_DURATION_MS;

    // Seed the target's recruit data into G before switching realm
    // so WorldRealm renders the correct pyramid.
    if (worldState.recruits && Array.isArray(worldState.recruits)) {
      this._savedRecruits  = G.recruits.slice();
      this._savedPyramids  = G.pyramids.slice();
      G.recruits  = [];
      G.pyramids  = [];
      // Re-run restoreRecruits equivalent with target's data
      worldState.recruits.forEach(r => {
        G.recruits.push({
          id: r.id, name: r.name, depth: r.depth,
          payoutToPlayer: r.payout, parentName: r.parent_name,
          dbId: r.id, meta: r.meta || {},
        });
      });
    }

    this._realmManager?.transitionTo(worldState.realm || 'world');
    AstralChat.activate();
    this._startPoseBroadcast();
  }

  // ── Projection end ────────────────────────────────────────

  _endProjection(reason = 'departed') {
    if (!this._projecting) return;
    gameSocket.send({ type: 'project_end' });
    this._cleanupProjection();
  }

  _cleanupProjection() {
    this._projecting = false;
    this._stopPoseBroadcast();
    AstralChat.deactivate();
    PresenceStore.clear();

    // Restore own pyramid data
    if (this._savedRecruits) {
      G.recruits = this._savedRecruits;
      G.pyramids = this._savedPyramids;
      this._savedRecruits = null;
      this._savedPyramids = null;
    }

    if (this._priorRealm) {
      this._realmManager?.transitionTo(this._priorRealm);
      this._priorRealm = null;
    }
  }

  // ── Pose broadcasting ─────────────────────────────────────

  _startPoseBroadcast() {
    this._stopPoseBroadcast();
    this._poseInterval = setInterval(() => {
      if (PresenceStore.size === 0) return;
      gameSocket.send({
        type:   'pose_update',
        px:     G.px,
        py:     G.py,
        pZ:     G.pZ ?? 0,
        facing: G.facing,
        frame:  G.pframe ?? 0,
      });
    }, 100);
  }

  _stopPoseBroadcast() {
    clearInterval(this._poseInterval);
    this._poseInterval = null;
  }

  // ── WS event wiring ───────────────────────────────────────

  _wireEvents() {
    // world_state = projection confirmed; switch to target's realm
    Events.on('ws:world_state', (evt) => {
      this._startProjection(evt);
    });

    // Session ended by server or by target
    Events.on('ws:projection_ended', () => {
      this._cleanupProjection();
    });

    // Chat from channel
    Events.on('ws:chat_message', (evt) => {
      AstralChat.addMessage(evt.from_username, evt.text);
    });

    // Host changed realm while we're projecting
    Events.on('ws:host_realm_changed', (evt) => {
      if (!this._projecting) return;
      if (evt.world_state?.recruits) {
        G.recruits = evt.world_state.recruits.map(r => ({
          id: r.id, name: r.name, depth: r.depth,
          payoutToPlayer: r.payout, parentName: r.parent_name,
          dbId: r.id, meta: r.meta || {},
        }));
        G.pyramids = [];
      }
      this._realmManager?.transitionTo(evt.realm || 'world');
    });

    // Timer countdown (client-side display only — server is authoritative)
    Events.on('ws:projection_started', () => {
      // The target receives this — show "A presence stirs" via dialogue
      // (handled in session.js Task 10)
    });
  }
}

export const AstralSession = new _AstralSession();
```

- [ ] **Step 2: Syntax check**

```bash
node --check frontend/game/astral.js
```

- [ ] **Step 3: Commit**

```bash
git add frontend/game/astral.js
git commit -m "feat: AstralSession — overlay, projection lifecycle, pose broadcast"
```

---

### Task 10: Session WS event wiring + realm_enter broadcast

**Files:**
- Modify: `frontend/game/session.js`
- Modify: `frontend/app/schemas.py` (`MeResponse`: add `id` field)
- Modify: `frontend/game/state.js` (add `G.userId = null`)
- Modify: `frontend/worlds/manifest.js` (call `AstralSession.init(RealmManager)`)
- Modify: `frontend/main.js` (wire `realm:enter` → WS `realm_enter` message)

**Interfaces:**
- Consumes: `PresenceStore`, `AstralChat`, `AstralSession`, `G.userId`, all new WS event types
- Produces: complete wiring; `G.userId` populated from `/api/me`

- [ ] **Step 1: Add `id` to `MeResponse` schema**

In `backend/app/schemas.py`, add `id: int` to `MeResponse`:

```python
class MeResponse(BaseModel):
    id:           int       # ← add this line first
    username:     str
    email:        str | None
    ...
```

In `backend/app/routers/game.py`, update the `MeResponse(...)` construction in the `/me` endpoint to include `id=current_user.id`:

```python
return MeResponse(
    id=current_user.id,    # ← add this line
    username=current_user.username,
    ...
)
```

- [ ] **Step 2: Add `G.userId` to state**

In `frontend/game/state.js`, find the `G` object export and add `userId: null` alongside existing fields. (Read the file first to find the exact object shape; add `userId: null` after `username: ''`.)

- [ ] **Step 3: Hydrate `G.userId` in session.js**

In `frontend/game/session.js`, in `_hydrateState(me)`, add:

```js
if (me.id != null) G.userId = me.id;
```

- [ ] **Step 4: Wire new WS events in `_wireWsEvents()` in `session.js`**

Add these event listeners inside `_wireWsEvents()` in `session.js`, after the existing `ws:invite_accepted` handler:

```js
// ── Presence / astral events ─────────────────────────────

Events.on('ws:peer_entered', (evt) => {
  PresenceStore.upsert(evt.username, {
    px: evt.px, py: evt.py, pZ: evt.pZ ?? 0,
    facing: evt.facing, frame: evt.frame,
  });
});

Events.on('ws:peer_left', (evt) => {
  PresenceStore.remove(evt.username);
});

Events.on('ws:peer_pose', (evt) => {
  PresenceStore.upsert(evt.username, {
    px: evt.px, py: evt.py, pZ: evt.pZ ?? 0,
    facing: evt.facing, frame: evt.frame,
  });
});

Events.on('ws:projection_started', (evt) => {
  // Target receives this — show "A presence stirs" momentarily in #dlg
  const dlgText = document.getElementById('dlg-text');
  const dlg     = document.getElementById('dlg');
  if (dlg && dlgText) {
    dlgText.textContent = `A presence stirs nearby — ${evt.from_username} draws close...`;
    dlg.classList.add('active');
    setTimeout(() => dlg.classList.remove('active'), 3000);
  }
});
```

Also add the import at the top of `session.js`:
```js
import { PresenceStore } from './presence.js';
```

- [ ] **Step 5: Wire `realm:enter` → WS `realm_enter` in `main.js`**

In `frontend/main.js`, inside the `Events.on` wiring block (or add a new one), add:

```js
Events.on('realm:enter', ({ realm }) => {
  if (!G.userId) return;
  gameSocket.send({
    type:     'realm_enter',
    realm:    realm,
    owner_id: G.userId,   // own channel unless AstralSession overrides
  });
});
```

Also add imports at the top of `main.js` if not present:
```js
import { gameSocket } from './game/ws.js';
```

- [ ] **Step 6: Init AstralSession in `manifest.js`**

In `frontend/worlds/manifest.js`, after all realm registrations, add:

```js
import { AstralSession } from '../game/astral.js';
AstralSession.init(RealmManager);
```

- [ ] **Step 7: Wire AstralSession keydown into RealmManager**

Each realm's `onKeyDown` currently has a `DialogueManager.isActive()` guard. AstralSession should intercept keys when either projecting or overlay is open. Add to `engine/realm.js` base class OR to the shared key handler path.

The cleanest approach: in each realm's `onKeyDown`, add before the `DialogueManager` check:

```js
if (AstralSession.onKeyDown(key)) return true;
```

Add this to the `onKeyDown` in:
- `PhysicsRealm.onKeyDown` (if it exists as a base) OR manually to each realm

Since there's no single shared `onKeyDown`, add to the `FlatRealm` base class and to `WorldRealm`, `NileRealm`, `AtlantisRealm`, `DeepRealm` individually. Each already has `if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key)` — add before it:

```js
if (AstralSession.isProjecting || AstralSession.isOverlayOpen) {
  if (AstralSession.onKeyDown(key)) return true;
}
```

Import `AstralSession` in each realm file that needs it.

- [ ] **Step 8: Syntax check all modified files**

```bash
node --check frontend/game/session.js
node --check frontend/main.js
node --check frontend/worlds/manifest.js
```

- [ ] **Step 9: Run all backend tests**

```bash
docker compose exec backend pytest -v
```
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/game.py \
        frontend/game/session.js frontend/game/state.js \
        frontend/main.js frontend/worlds/manifest.js \
        frontend/worlds/earth/WorldRealm.js \
        frontend/worlds/nile/NileRealm.js \
        frontend/worlds/FlatRealm.js
git commit -m "feat: wire session WS events, realm_enter broadcast, AstralSession init"
```

---

### Task 11: Build, smoke, and manual verification

**Files:** No new files — rebuild Docker image and verify end-to-end.

- [ ] **Step 1: Run full backend test suite**

```bash
docker compose exec backend pytest -v
```
Expected: all tests pass.

- [ ] **Step 2: Rebuild Docker image**

```bash
docker compose up --build -d
```

- [ ] **Step 3: Verify shop**

1. Open http://localhost:5173, log in as a bought-in user.
2. Walk to the Nile merchant → enter the stall.
3. Confirm `astral_lens` appears in the grid — `A Lens Ground from Crushed Scarab`.
4. Confirm all prices are roughly halved vs. before (e.g. `scarab_amulet` is $4, not $9).
5. Buy `astral_lens` — confirm it shows OWNED, earnings deduct.

- [ ] **Step 4: Verify presence endpoint**

```bash
# Get a JWT by logging in first:
TOKEN=$(curl -s -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PW"}' | jq -r .access_token)

curl -s http://localhost:5173/api/astral/downline \
  -H "Authorization: Bearer $TOKEN" | jq
```
Expected: `{"downline": [...]}` — only direct recruits shown.

- [ ] **Step 5: Manual happy-path projection test**

Prerequisites: two real user accounts (A is recruiter, B is direct recruit); both own `astral_lens` or A does; B must be a real user (not a sim recruit).

Setup:
1. Open two browser tabs: tab A logged in as recruiter, tab B as recruit.
2. Both should be in-game and bought in.

Test:
1. In tab A, press `A` — overlay appears listing B.
2. Select B (who is online) — press Enter.
3. Tab B shows *"A presence stirs nearby — A draws close..."* briefly.
4. Tab A's view switches to B's realm; A's pharaoh spawns near B.
5. Both pharaohs are visible and move independently on both screens.
6. Press `T` in either tab → type a message → Enter → message appears in `#astral-chat` on both.
7. Wait 3 minutes OR press `A` again in tab A → session ends; both return to own realms.

- [ ] **Step 6: Verify unauthorized projection rejected**

In tab A, attempt a WS message to project into a non-downline user (use browser console):

```js
// In browser console on tab A:
gameSocket.send({ type: 'project_start', target_user_id: 99999 })
// No world_state should be received; A should stay in own realm
```

- [ ] **Step 7: Verify beckon**

1. In tab A, press `A` — if B is offline, see "BECKON" next to B's name.
2. Select B and confirm → check http://localhost:8025 (Mailhog) for the beckon email.
3. Email subject: "A vision from above".
4. Try beckon again immediately → should see no email sent (rate limit; no UI error yet, check network tab for 429).

- [ ] **Step 8: Commit verification note**

```bash
git commit --allow-empty -m "chore: manual verification complete — astral projection v1 working"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered in task |
|---|---|
| `astral_lens` keepsake in shop | Task 5 |
| Global reprice to ~half | Task 5 |
| Channel registry `(owner_id, realm_id)` | Task 1 |
| Bidirectional WS dispatcher | Task 2 |
| `realm_enter` → channel membership | Task 2 |
| `pose_update` → channel broadcast | Task 2 |
| `chat` → channel broadcast | Task 2 |
| `project_start` — auth + world_state + join | Task 3 |
| `project_end` — restore + broadcast | Task 3 |
| Server-authoritative 3-min timer | Task 3 |
| Host realm change carries visitors | Task 2 (`_on_realm_enter`) |
| `GET /api/astral/downline` | Task 4 |
| `POST /api/astral/beckon` + email | Task 4 |
| Beckon rate limit (1/hr) | Task 4 |
| `GameSocket.send()` | Task 6 |
| `PresenceStore` | Task 6 |
| `drawPeerPharaoh` + `drawAllPeers` | Task 7 |
| All 8 realm renders wired | Task 7 |
| `#astral-chat` DOM + CSS | Task 8 |
| `AstralChat` module | Task 8 |
| `AstralSession` overlay + lifecycle | Task 9 |
| Pyramid fidelity (host's recruit data) | Task 9 |
| Body absence (projector leaves own channel) | Task 3 (`project_start`) |
| Session WS event wiring | Task 10 |
| `realm:enter` → WS on realm transition | Task 10 |
| `projection_started` → "A presence stirs" | Task 10 |
| Downline auth: depth=1 only | Task 3 + 4 |
| Depth=2 rejected | Task 3 test |
| Sim recruit rejected | Task 3 (recruit_id IS NOT NULL) |
| Channel join auth (owner_id spoof rejected) | Task 2 |
| `G.userId` hydrated from `/api/me` | Task 10 |
| `MeResponse.id` field | Task 10 |

### Type consistency check

- `PresenceStore.upsert(username, pose)` — Task 6 defines; Task 10 calls with `{px, py, pZ, facing, frame}` ✓
- `PresenceStore.peers()` → array — Task 7 iterates with `drawPeerPharaoh(peer, camX)` ✓
- `drawPeerPharaoh(pose, viewerCamX)` — Task 7 defines; all realm draw files call via `drawAllPeers` ✓
- `drawAllPeers(realm)` — Task 7 defines; calls `realm.getPlayerPose()` which all realms implement ✓
- `gameSocket.send(data)` — Task 6 defines; Task 9 calls ✓
- `AstralSession.onKeyDown(key)` — Task 9 defines; Task 10 calls from realm `onKeyDown` ✓
- `AstralSession.init(realmManager)` — Task 9 defines; Task 10 calls from `manifest.js` ✓
- `AstralChat.activate()` / `deactivate()` — Task 8 defines; Task 9 calls ✓
- `AstralChat.addMessage(from, text)` — Task 8 defines; Task 9 `_wireEvents()` calls ✓
