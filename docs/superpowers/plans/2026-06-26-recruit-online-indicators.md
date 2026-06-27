# Recruit Online Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a live online/offline dot on each direct-recruit (depth-1) card in the follower-list panel, updated in real time over WebSocket.

**Architecture:** Presence is read from the in-memory `ConnectionManager` (online ⇔ has a live socket). A new backend module `app/presence.py` owns the recruiter lookup + push (the single seam a future Redis backplane would replace). A new frontend module `game/recruit-presence.js` owns the dot's state + DOM (data-source-agnostic — `seed()` and `set()` are its only inputs, so the wire protocol survives a backend swap unchanged). The recruit's real `User.id` is threaded to the client via REST (`/api/recruits`) and the live `recruit_joined` WS event; the card seeds from `GET /api/astral/downline` and updates from a new `recruit_presence` WS event.

**Tech Stack:** FastAPI, async SQLAlchemy, WebSockets (backend); vanilla ES modules, canvas, nginx (frontend). Tests: `pytest` (asyncio auto mode, aiosqlite) backend; node `.smoke.mjs` scripts frontend.

## Global Constraints

- **No migration.** `recruits.recruit_id` is already indexed (`ix_recruits_recruit_id`, migration 0001). No schema change.
- **Single-instance invariant.** Presence lives in `manager._conns` (process memory). Do not add cross-process state, do not enable horizontal scaling.
- **Presence push is point-to-point.** Each transition pushes to exactly one recruiter via `manager.send_to_user`. No channel broadcast.
- **Transitions only.** Notify the recruiter on the recruit's *first* connect (offline→online) and *last* disconnect (online→offline) — multi-tab open/close in between emits nothing.
- **Depth-1, real users only.** Cards get a dot only when `depth === 1` and `user_id`/`recruit_id` is non-null. Sims (`recruit_id = NULL`) get no dot.
- **Live-only.** No `last_seen`, no DB session table. After a restart everyone shows offline until clients auto-reconnect.
- **Frontend rebuild is hook-enforced.** A Stop hook rebuilds the frontend when a `frontend/` file changes — do NOT run `docker compose build` manually.
- **Work on branch** `feat/recruit-online-indicators` (multi-file feature; the pre-PR reflection hook will gate the eventual PR).
- Backend tests run from `backend/`: `python -m pytest tests/<file> -v`. Frontend smokes: `node frontend/<path>.smoke.mjs`.

---

### Task 1: Thread the recruit's `user_id` into REST + the `recruit_joined` event

Pure data plumbing — make the recruit's real `User.id` (and current online state at join) reach the client. No behavior yet.

**Files:**
- Modify: `backend/app/schemas.py:105-115` (`RecruitResponse`)
- Modify: `backend/app/routers/game.py:118-124` (build `RecruitResponse`)
- Modify: `backend/app/chain.py` (import `manager`; `recruit_joined` payload at `:89-96`)
- Test: `backend/tests/test_recruit_presence.py` (new file)

**Interfaces:**
- Produces: `RecruitResponse.user_id: int | None` on every `/api/recruits` row (= `Recruit.recruit_id`).
- Produces: `recruit_joined` WS event gains `user_id: int | None` and `online: bool`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_recruit_presence.py`:

```python
"""Tests for recruit online-indicator plumbing + presence push."""
import pytest
from unittest.mock import patch, AsyncMock
from app.models import User, GameState, Recruit
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def _make_pair():
    """alice recruits bob (depth=1, real user). Returns (alice_id, bob_id)."""
    async with TestingSessionLocal() as db:
        alice = User(username="alice", password_hash="x")
        bob   = User(username="bob",   password_hash="x")
        db.add_all([alice, bob])
        await db.flush()
        bob.recruiter_id = alice.id
        db.add(GameState(user_id=alice.id, bought=True, earned=0, invites_left=0, flags={}))
        db.add(GameState(user_id=bob.id,   bought=True, earned=0, invites_left=0, flags={}))
        db.add(Recruit(recruiter_id=alice.id, recruit_id=bob.id,
                       recruit_name="bob", parent_name="alice", depth=1, payout=5.0))
        await db.commit()
        return alice.id, bob.id


async def test_list_recruits_includes_user_id(client):
    alice_id, bob_id = await _make_pair()
    async with client as c:
        res = await c.get("/api/recruits", headers=auth_headers(alice_id, "alice"))
    assert res.status_code == 200
    rows = res.json()["recruits"]
    assert len(rows) == 1
    assert rows[0]["user_id"] == bob_id


async def test_list_recruits_user_id_null_for_sim(client):
    alice_id = await make_user(username="alice")
    async with TestingSessionLocal() as db:
        db.add(Recruit(recruiter_id=alice_id, recruit_id=None,
                       recruit_name="simguy", parent_name="alice", depth=1, payout=5.0))
        await db.commit()
    async with client as c:
        res = await c.get("/api/recruits", headers=auth_headers(alice_id, "alice"))
    assert res.json()["recruits"][0]["user_id"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_recruit_presence.py -v`
Expected: FAIL — `KeyError: 'user_id'` / response has no `user_id` key.

- [ ] **Step 3: Add `user_id` to `RecruitResponse`**

In `backend/app/schemas.py`, inside `class RecruitResponse(BaseModel):` (after `id: int`):

```python
class RecruitResponse(BaseModel):
    id:          int
    user_id:     int | None = None
    name:        str
    depth:       int
    payout:      float
    parent_name: str | None
    meta:        dict[str, Any]
    created_at:  datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 4: Populate it in the router**

In `backend/app/routers/game.py`, the `RecruitResponse(...)` construction in `list_recruits` (around line 119):

```python
        RecruitResponse(
            id=r.id, user_id=r.recruit_id, name=r.recruit_name, depth=r.depth,
            payout=r.payout, parent_name=r.parent_name, meta=r.meta or {},
            created_at=r.created_at,
        )
```

- [ ] **Step 5: Run REST tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_recruit_presence.py -v`
Expected: PASS (both REST tests).

- [ ] **Step 6: Add the `recruit_joined` event fields**

In `backend/app/chain.py`, add the import near the other app imports at the top of the file:

```python
from app.ws import manager
```

Then extend the `recruit_joined` payload (around line 89) — `is_connected` is a pure in-memory dict read, safe here even though `chain.py` does not commit/push:

```python
        ws_events.append((ancestor.id, {
            "type":          "recruit_joined",
            "name":          buyer_name,
            "depth":         depth,
            "payout":        payout,
            "db_recruit_id": recruit_row.id,
            "parent_name":   parent_name,
            "user_id":       buyer_user_id,
            "online":        manager.is_connected(buyer_user_id) if buyer_user_id else False,
        }))
```

- [ ] **Step 7: Write the chain-event test**

Append to `backend/tests/test_recruit_presence.py`:

```python
async def test_recruit_joined_event_carries_user_id_and_online():
    from app.chain import run_buyin_chain
    alice_id, _ = await _make_pair()
    async with TestingSessionLocal() as db:
        with patch("app.chain.manager") as mock_mgr:
            mock_mgr.is_connected.return_value = True
            events = await run_buyin_chain(alice_id, "carol", buyer_user_id=999, db=db)
            await db.commit()
    # events is a list of (recipient_user_id, payload) tuples
    payloads = [p for (_uid, p) in events if p.get("type") == "recruit_joined"]
    assert payloads, "expected at least one recruit_joined event"
    assert payloads[0]["user_id"] == 999
    assert payloads[0]["online"] is True
```

> Verified signature (`backend/app/chain.py:22`): `run_buyin_chain(first_recruiter_id, buyer_name, buyer_user_id, db) -> list[tuple[int, dict]]`, returning the `ws_events` list of `(ancestor_id, payload)` tuples and NOT committing. Do not change this signature.

- [ ] **Step 8: Run the full file**

Run: `cd backend && python -m pytest tests/test_recruit_presence.py -v`
Expected: PASS (all three tests).

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/game.py backend/app/chain.py backend/tests/test_recruit_presence.py
git commit -m "feat: thread recruit user_id + online into REST and recruit_joined event"
```

---

### Task 2: Backend presence module + WS connect/disconnect push

The behavioral core. A new `app/presence.py` owns the recruiter lookup and the point-to-point push; `routers/ws.py` calls it on transitions.

**Files:**
- Create: `backend/app/presence.py`
- Modify: `backend/app/routers/ws.py:64` (connect path), `:315-327` (`_handle_disconnect`)
- Test: `backend/tests/test_recruit_presence.py` (extend)

**Interfaces:**
- Consumes: `manager.is_connected`, `manager.connect`, `manager.disconnect`, `manager.send_to_user` (`app/ws.py`); `Recruit` model.
- Produces:
  - `async def direct_recruiter_id(db: AsyncSession, user_id: int) -> int | None`
  - `async def notify_presence(user_id: int, online: bool) -> None` — opens its own `AsyncSessionLocal`, looks up the direct recruiter, pushes `{"type": "recruit_presence", "user_id": user_id, "online": online}` to them if found.
  - WS event `recruit_presence {user_id: int, online: bool}` delivered to the recruiter.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_recruit_presence.py`:

```python
# ── presence module ──────────────────────────────────────────────────────

async def test_direct_recruiter_id_returns_recruiter():
    from app.presence import direct_recruiter_id
    alice_id, bob_id = await _make_pair()
    async with TestingSessionLocal() as db:
        assert await direct_recruiter_id(db, bob_id) == alice_id


async def test_direct_recruiter_id_none_when_no_recruiter():
    from app.presence import direct_recruiter_id
    lonely_id = await make_user(username="lonely")
    async with TestingSessionLocal() as db:
        assert await direct_recruiter_id(db, lonely_id) is None


async def test_notify_presence_pushes_to_recruiter():
    from app import presence
    alice_id, bob_id = await _make_pair()
    with patch.object(presence, "AsyncSessionLocal", TestingSessionLocal), \
         patch.object(presence, "manager") as mock_mgr:
        mock_mgr.send_to_user = AsyncMock(return_value=True)
        await presence.notify_presence(bob_id, online=True)
    mock_mgr.send_to_user.assert_awaited_once()
    target, payload = mock_mgr.send_to_user.await_args.args
    assert target == alice_id
    assert payload == {"type": "recruit_presence", "user_id": bob_id, "online": True}


async def test_notify_presence_noop_without_recruiter():
    from app import presence
    lonely_id = await make_user(username="lonely")
    with patch.object(presence, "AsyncSessionLocal", TestingSessionLocal), \
         patch.object(presence, "manager") as mock_mgr:
        mock_mgr.send_to_user = AsyncMock()
        await presence.notify_presence(lonely_id, online=False)
    mock_mgr.send_to_user.assert_not_awaited()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_recruit_presence.py -k "recruiter or notify" -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.presence'`.

- [ ] **Step 3: Create the presence module**

Create `backend/app/presence.py`:

```python
"""
Recruit presence — who's online, surfaced to their direct recruiter.

This is the single seam between the (currently in-memory) presence source and
the recruiter notification. A future multi-instance backplane (Redis TTL key +
pub/sub) replaces the body of `notify_presence` without touching callers or the
`recruit_presence` wire event. See the single-instance invariant in CLAUDE.md.
"""
from __future__ import annotations
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Recruit
from app.ws import manager

logger = logging.getLogger(__name__)


async def direct_recruiter_id(db: AsyncSession, user_id: int) -> int | None:
    """The user_id of this user's direct (depth=1) recruiter, or None.

    A user has exactly one depth-1 recruiter row keyed on recruit_id, so this
    is a single indexed lookup (ix_recruits_recruit_id)."""
    return (await db.execute(
        select(Recruit.recruiter_id).where(
            Recruit.recruit_id == user_id,
            Recruit.depth      == 1,
        )
    )).scalar_one_or_none()


async def notify_presence(user_id: int, online: bool) -> None:
    """Push a recruit_presence event to user_id's direct recruiter, if any.

    Opens its own short-lived session — called from the WS connect/disconnect
    path, which holds no DB session. No-op when the user has no recruiter."""
    async with AsyncSessionLocal() as db:
        recruiter_id = await direct_recruiter_id(db, user_id)
    if recruiter_id is None:
        return
    await manager.send_to_user(recruiter_id, {
        "type": "recruit_presence", "user_id": user_id, "online": online,
    })
```

- [ ] **Step 4: Run module tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_recruit_presence.py -k "recruiter or notify" -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the connect transition**

In `backend/app/routers/ws.py`, add the import near the existing `from app.ws import manager`:

```python
from app.presence import notify_presence
```

Then in `websocket_endpoint`, replace the single `await manager.connect(user_id, ws)` line (around line 64) with a transition-guarded version:

```python
    was_online = manager.is_connected(user_id)   # capture BEFORE connect
    await manager.connect(user_id, ws)
    if not was_online:                            # offline → online (first socket)
        await notify_presence(user_id, online=True)
```

- [ ] **Step 6: Wire the disconnect transition**

In `_handle_disconnect` (around line 327), replace the final `manager.disconnect(user_id, ws)` with:

```python
    manager.disconnect(user_id, ws)
    if not manager.is_connected(user_id):         # online → offline (last socket)
        await notify_presence(user_id, online=False)
```

- [ ] **Step 7: Write the transition test**

Append to `backend/tests/test_recruit_presence.py`:

```python
# ── connect/disconnect transitions (multi-tab) ───────────────────────────

async def test_presence_push_only_on_first_connect_and_last_disconnect():
    """Two tabs: first connect pushes online; closing one pushes nothing;
    closing the last pushes offline."""
    from app.ws import ConnectionManager
    from unittest.mock import MagicMock

    mgr = ConnectionManager()
    pushes = []

    async def fake_notify(user_id, online):
        pushes.append((user_id, online))

    # Simulate the ws.py transition logic against a real manager + two fake sockets.
    ws1, ws2 = MagicMock(name="ws1"), MagicMock(name="ws2")
    for s in (ws1, ws2):
        s.accept = AsyncMock()

    async def connect(uid, ws):
        was = mgr.is_connected(uid)
        await mgr.connect(uid, ws)
        if not was:
            await fake_notify(uid, True)

    async def disconnect(uid, ws):
        mgr.disconnect(uid, ws)
        if not mgr.is_connected(uid):
            await fake_notify(uid, False)

    await connect(7, ws1)      # online push
    await connect(7, ws2)      # no push (already online)
    await disconnect(7, ws1)   # no push (still has ws2)
    await disconnect(7, ws2)   # offline push

    assert pushes == [(7, True), (7, False)]
```

- [ ] **Step 8: Run the full file + sanity-check the WS suite still passes**

Run: `cd backend && python -m pytest tests/test_recruit_presence.py tests/test_astral_ws.py tests/test_ws_dispatcher.py -v`
Expected: PASS (new presence tests + existing WS suites unbroken).

- [ ] **Step 9: Commit**

```bash
git add backend/app/presence.py backend/app/routers/ws.py backend/tests/test_recruit_presence.py
git commit -m "feat: push recruit_presence to recruiter on connect/disconnect transitions"
```

---

### Task 3: Frontend `RecruitPresence` module + card dot + `userId` threading

The frontend single-source-of-truth for the dot. Pure store logic is node-testable; DOM writes are guarded so the module imports cleanly under node.

**Files:**
- Create: `frontend/game/recruit-presence.js`
- Create: `frontend/game/__smoke__/recruit-presence.smoke.mjs`
- Modify: `frontend/ui/panels.js:67-85` (`addFriendUI`)
- Modify: `frontend/game/recruits.js` — `addRecruit` rec object (`:105-112`) + the three `restoreRecruits` rec objects (`:327-330`, `:339`, `:363-373`)
- Modify: `frontend/style.css` (`.fo` dot)

**Interfaces:**
- Consumes: `RecruitResponse.user_id` (Task 1) via `restoreRecruits`; `recruit_joined.user_id` (Task 1) via `addRecruit` opts.
- Produces:
  - `RecruitPresence.seed(list)` — `list: [{user_id, online}]`
  - `RecruitPresence.set(userId, online)`
  - `RecruitPresence.isOnline(userId) -> bool`
  - `RecruitPresence.clear()`
  - Every `rec` object carries `userId: number | null`.
  - Follower card `.fe` for a depth-1 real recruit has `data-uid="<userId>"` and contains `<span class="fo"></span>` (`.on` ⇔ online).

- [ ] **Step 1: Write the failing smoke test**

Create `frontend/game/__smoke__/recruit-presence.smoke.mjs`:

```javascript
// frontend/game/__smoke__/recruit-presence.smoke.mjs
import { RecruitPresence } from '../recruit-presence.js';

// Module must import under node (no top-level DOM access).
RecruitPresence.clear();
if (RecruitPresence.isOnline(42) !== false) throw new Error('unknown uid should be offline');

RecruitPresence.seed([{ user_id: 42, online: true }, { user_id: 7, online: false }]);
if (!RecruitPresence.isOnline(42)) throw new Error('seed online failed');
if (RecruitPresence.isOnline(7)) throw new Error('seed offline failed');

// string/number key parity (WS payloads + data-uid attrs cross int/string)
RecruitPresence.set('42', false);
if (RecruitPresence.isOnline(42)) throw new Error('set must coerce key type');
RecruitPresence.set(7, true);
if (!RecruitPresence.isOnline('7')) throw new Error('isOnline must coerce key type');

// null uid is ignored, not stored
RecruitPresence.set(null, true);

console.log('recruit-presence smoke OK');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node frontend/game/__smoke__/recruit-presence.smoke.mjs`
Expected: FAIL — `Cannot find module '.../recruit-presence.js'`.

- [ ] **Step 3: Create the module**

Create `frontend/game/recruit-presence.js`:

```javascript
// frontend/game/recruit-presence.js
// Single source of truth for direct-recruit online state and its card dot.
//
// Data-source-agnostic: seed() and set() are the only inputs. Swapping the
// backend presence layer (in-memory → Redis pub/sub) never touches this module
// — the `recruit_presence` WS event and the seed shape stay the same.
//
// DOM writes are guarded (`typeof document`) so the store logic imports and
// tests cleanly under node.

const _online = new Map();   // Number(userId) → bool

function _dotEl(userId) {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`.fe[data-uid="${userId}"] .fo`);
}

function _render(userId) {
  const el = _dotEl(userId);
  if (el) el.classList.toggle('on', _online.get(Number(userId)) === true);
}

export const RecruitPresence = {
  /** Seed from GET /api/astral/downline: [{user_id, online}]. */
  seed(list) {
    for (const r of list || []) {
      if (r.user_id == null) continue;
      _online.set(Number(r.user_id), !!r.online);
      _render(r.user_id);
    }
  },

  /** Live update from the ws:recruit_presence event. */
  set(userId, online) {
    if (userId == null) return;
    _online.set(Number(userId), !!online);
    _render(userId);
  },

  isOnline(userId) {
    return _online.get(Number(userId)) === true;
  },

  clear() { _online.clear(); },
};
```

- [ ] **Step 4: Run smoke to verify it passes**

Run: `node frontend/game/__smoke__/recruit-presence.smoke.mjs`
Expected: prints `recruit-presence smoke OK`.

- [ ] **Step 5: Render the dot in the card**

In `frontend/ui/panels.js`, add the import at the top with the other imports:

```javascript
import { RecruitPresence } from '../game/recruit-presence.js';
```

Then replace the body of `addFriendUI` (lines 67-85) with a version that tags depth-1 real-recruit cards and renders the dot:

```javascript
export function addFriendUI(rec) {
  document.getElementById('nf').style.display='none';
  const list = document.getElementById('fl');
  const col  = depthHex(rec.depth);
  const showDot = rec.depth === 1 && rec.userId != null;
  const d = document.createElement('div');
  d.className='fe';
  if (showDot) d.dataset.uid = String(rec.userId);
  const dot = showDot
    ? `<span class="fo${RecruitPresence.isOnline(rec.userId) ? ' on' : ''}"></span>`
    : '';
  d.innerHTML=`<canvas class="fi" width="10" height="10" id="fi${rec.id}"></canvas>
    <span class="fn" style="color:${col}">${rec.name}</span>
    ${dot}
    <span class="fs" style="color:${col}">D${rec.depth}</span>`;
  list.prepend(d);
  setTimeout(()=>{
    const fc=document.getElementById('fi'+rec.id); if (!fc) return;
    const fx=fc.getContext('2d');
    const hc = rec.depth===1?COL.PLAYER_BLUE:rec.depth===2?'#186098':'#553088';
    fx.fillStyle=hc; fx.fillRect(3,0,4,2);
    fx.fillStyle=COL.GOLD_WARM; fx.fillRect(2,2,6,4);
    fx.fillStyle=COL.WHITE; fx.fillRect(2,6,6,4);
  }, 40);
}
```

- [ ] **Step 6: Thread `userId` onto the rec object — `addRecruit`**

In `frontend/game/recruits.js`, the `addRecruit` rec object (lines 105-112) gains `userId`:

```javascript
  const rec = {
    id: fid, name, depth, pid,
    rootPid: depth === 1 ? pid : rootPid,
    zLayer, wx,
    parentName: parentRec ? parentRec.name : null,
    payoutToPlayer: payout,
    dbId: opts.dbId || null,   // set for real server-created recruits
    userId: opts.userId ?? null,   // real User.id for depth-1 real recruits; null for sims
  };
```

- [ ] **Step 7: Thread `userId` onto the rec object — `restoreRecruits` (all three sites)**

In `restoreRecruits`, add `userId: sr.user_id ?? null` to each of the three `rec` literals:

Site A — depth-1 no-slot branch (around line 327):
```javascript
        const rec = {
          id: sr.id, name, depth: 1, pid: newPid, rootPid: newPid,
          zLayer: 0, wx: newWx, parentName, payoutToPlayer: payout,
          userId: sr.user_id ?? null,
        };
```

Site B — depth>1 no-slot branch (around line 339):
```javascript
        const rec = { id: sr.id, name, depth, pid: null, wx: null, parentName,
                      payoutToPlayer: payout, userId: sr.user_id ?? null };
```

Site C — normal rebuild branch (around line 363):
```javascript
    const rec = {
      id:            sr.id,
      name,
      depth,
      pid,
      rootPid:       rootPid ?? pid,
      zLayer:        zLayer ?? (depth === 1 ? 0 : depth === 2 ? 1 : 2),
      wx,
      parentName,
      payoutToPlayer: payout,
      userId:        sr.user_id ?? null,
    };
```

- [ ] **Step 8: Add the dot styles**

In `frontend/style.css`, append:

```css
/* Direct-recruit online indicator (follower-list cards) */
.fo{display:inline-block;width:5px;height:5px;border-radius:50%;
    background:#553a2a;margin:0 3px;vertical-align:middle;flex:0 0 auto;}
.fo.on{background:#40d080;box-shadow:0 0 3px #40d080;}
```

- [ ] **Step 9: Verify modules still parse (DOM-coupled files)**

Run: `node --check frontend/ui/panels.js && node --check frontend/game/recruits.js && node frontend/game/__smoke__/recruit-presence.smoke.mjs`
Expected: no output from `--check` (success), then `recruit-presence smoke OK`.

- [ ] **Step 10: Commit**

```bash
git add frontend/game/recruit-presence.js frontend/game/__smoke__/recruit-presence.smoke.mjs frontend/ui/panels.js frontend/game/recruits.js frontend/style.css
git commit -m "feat: recruit online dot on follower cards + RecruitPresence store"
```

---

### Task 4: Wire seed-on-load + live WS update

Connect the data: seed the store after recruits load, pass `userId` from the join event, and apply live `recruit_presence` events.

**Files:**
- Modify: `frontend/game/session.js` — load path (`:107-116`), `ws:recruit_joined` handler (`:159-172`), and `_wireWsEvents` (`:149-202`)

**Interfaces:**
- Consumes: `RecruitPresence.seed/set` (Task 3); `GET /api/astral/downline` (existing) → `{downline: [{user_id, online}]}`; `ws:recruit_presence` event (Task 2); `ws:recruit_joined.user_id` (Task 1).

- [ ] **Step 1: Import the store**

In `frontend/game/session.js`, add to the imports (near `import { addRecruit, restoreRecruits } from './recruits.js';`):

```javascript
import { RecruitPresence } from './recruit-presence.js';
```

- [ ] **Step 2: Seed presence after recruits are restored**

In the load path, immediately after the `restoreRecruits(...)` block closes (after line 116, inside the same `if (G.bought)`-style block where recruits load), add:

```javascript
    // Seed direct-recruit online dots from the presence endpoint. Best-effort:
    // a failure just leaves dots in their default (offline) state.
    Api.get('/api/astral/downline')
      .then(data => RecruitPresence.seed(data?.downline || []))
      .catch(() => {});
```

- [ ] **Step 3: Pass `userId` through the join handler**

In `_wireWsEvents`, the `ws:recruit_joined` handler (line 163) passes the new id through, and seeds the just-created card's dot from the event's `online` field (covers the "already online at join" edge case):

```javascript
    Events.on('ws:recruit_joined', (evt) => {
      const parentRec = evt.parent_name
        ? G.recruits.find(r => r.name === evt.parent_name)
        : null;
      addRecruit(evt.name, evt.depth, parentRec, { dbId: evt.db_recruit_id, userId: evt.user_id });
      if (evt.user_id != null) RecruitPresence.set(evt.user_id, !!evt.online);

      const simLog = document.getElementById('dev-sim-log');
      if (simLog) {
        const line = document.createElement('div');
        line.style.color = '#40d080';
        line.textContent = `[${new Date().toLocaleTimeString()}] ✓ ${evt.name} joined at D${evt.depth} (+$${evt.payout.toFixed(2)})`;
        simLog.prepend(line);
      }
    });
```

- [ ] **Step 4: Handle the live presence event**

In `_wireWsEvents`, add a handler (place it just before the closing comment about peer presence around line 199):

```javascript
    // A direct recruit came online / went offline — flip their card dot.
    Events.on('ws:recruit_presence', (evt) => {
      RecruitPresence.set(evt.user_id, evt.online);
    });
```

- [ ] **Step 5: Verify the file parses**

Run: `node --check frontend/game/session.js`
Expected: no output (success).

- [ ] **Step 6: Manual end-to-end verification (the Stop hook rebuilds the frontend)**

After the commit, the Stop hook rebuilds the frontend image. Then, with `docker compose up`:
1. Register two accounts in a recruiter→recruit relationship (recruiter `alice` invites `bob`; `bob` registers + buys in via `/admin` confirm).
2. Log in as `alice` (tab A) and `bob` (tab B). In tab A, `bob`'s follower card shows a **green** dot (seeded from `/api/astral/downline`).
3. Close tab B → within a moment `bob`'s dot in tab A goes **grey** (live `recruit_presence` offline).
4. Reopen `bob` → dot returns green (live online).
5. Confirm a dev-sim recruit (backtick panel) shows a card with **no** dot.

- [ ] **Step 7: Commit**

```bash
git add frontend/game/session.js
git commit -m "feat: seed recruit dots on load + apply live recruit_presence events"
```

---

## Notes for the implementer

- **Why two new modules?** `app/presence.py` and `game/recruit-presence.js` are the only files a future Redis-backed, multi-instance presence system would change. Everything else (the WS event shape, the card, the seed call) is backend-agnostic. Keep presence logic in them — do not inline the recruiter lookup into `ws.py` or the dot toggling into `session.js`.
- **Do not** add a `last_seen` column or any DB presence row — live-only is deliberate (see spec).
- **Do not** broadcast presence to a channel — it is point-to-point to the one recruiter.
- The `recruit_joined` `online` field is load-bearing for the already-online-at-join case; don't drop it as redundant.
