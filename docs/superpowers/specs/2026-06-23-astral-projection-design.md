# Astral Projection — Design Spec

**Date:** 2026-06-23
**Status:** Approved, pending implementation

---

## What This Is

A new shop keepsake — the *Astral Lens* — that lets an upline player project their pharaoh into one of their direct recruits' active game worlds. Both players see each other moving independently and can chat in real time. A "Beckon" action emails offline downline to come online.

This is increment one of full multi-user co-presence. The channel registry and bidirectional WS protocol built here are the load-bearing foundation all future multiplayer features will extend.

---

## Design Decisions Made

| Question | Decision |
|---|---|
| Mutual visibility? | Yes — both see each other as ghost pharaohs |
| Independent movement? | Yes — each player has their own physics and camera |
| Announced arrival? | Yes — target sees *"A presence stirs nearby…"* before ghost materialises |
| Item kind | Keepsake with a server-authoritative 3-minute session limit |
| Projection reach | Direct recruits only (depth = 1); deeper reach deferred |
| Channel key | `(owner_id, realm_id)` — owner-scoped worlds; `(None, realm_id)` reserved for future system realms |
| NPC dialogue conflict | New `#astral-chat` element — completely decoupled from `DialogueManager` |
| Projector's own body | Suspended from their own channel while projecting ("consciousness left the body") |

---

## Channel Registry

The core new primitive. Every connected player occupies exactly one **channel** at a time:

```
channel_key = (owner_id: int | None, realm_id: str)
```

Examples:
```
(7,    "world")  →  {ws_alice}               # Alice alone in her Desert
(7,    "world")  →  {ws_alice, ws_bob}        # Bob projecting into Alice's Desert
(None, "ocean")  →  {ws_carol, ws_dave}       # future system realm, no owner
```

**`ChannelRegistry` (`backend/app/channels.py`)** — module-level singleton:

- `join(ws, channel_key)` — adds socket to channel, updates per-socket metadata
- `leave(ws)` — removes socket from current channel
- `broadcast(channel_key, event, exclude=None)` — sends JSON event to all sockets in channel
- `peers(channel_key) → list[dict]` — returns metadata for all sockets except one (used to populate `peer_entered` payloads)

Per-socket ephemeral metadata lives in `ConnectionManager._meta: dict[WebSocket, dict]`, keyed to socket not user (multi-tab safe):

```python
{
  "user_id": int,
  "username": str,
  "channel_key": tuple,
  "px": float, "py": float, "facing": str, "frame": int,
  "projection_session": dict | None   # {target_id, started_at, expiry_task}
}
```

When the set grows from 2 to 3+ members in a channel, nothing changes structurally — that is the path to full co-presence.

---

## Bidirectional WebSocket Protocol

Today the WS server drops all client messages except the string `"ping"`. The receive loop becomes a typed JSON dispatcher. Unknown `type` values are silently dropped.

### Client → Server

| type | payload | notes |
|---|---|---|
| `realm_enter` | `{realm: str, owner_id: int}` | sent on every realm transition |
| `pose_update` | `{px, py, facing, frame}` | ~10 Hz; only sent when channel has peers |
| `project_start` | `{target_user_id: int}` | initiate projection |
| `project_end` | `{}` | end session (either party) |
| `chat` | `{text: str}` | ≤ 200 chars; channel-scoped |

### Server → Client (new events)

| type | payload | meaning |
|---|---|---|
| `peer_entered` | `{username, px, py, facing, frame, is_projector}` | someone joined your channel |
| `peer_left` | `{username}` | someone left your channel |
| `peer_pose` | `{username, px, py, facing, frame}` | peer moved |
| `chat_message` | `{from_username, text}` | chat from someone in channel |
| `world_state` | `{recruits: [...], realm, owner_username}` | sent point-to-point to projector on join |
| `projection_started` | `{from_username}` | *"A presence stirs…"* — target receives this |
| `projection_ended` | `{from_username, reason}` | session ended (timeout / departure) |
| `host_realm_changed` | `{realm, world_state}` | host crossed a realm boundary; visitors re-instantiate |

`host_realm_changed` is critical: without it, visitors keep rendering the old realm while receiving pose events for the new one.

---

## Projection Lifecycle

### Triggering

The projector presses a key (e.g. `A`) while owning `astral_lens`. A canvas overlay lists their direct recruits: online recruits are selectable for projection, offline recruits show a **Beckon** button. If no recruits exist: *"The sands are still. No soul stirs below you."*

### Starting a session

1. Projector selects online target and confirms.
2. Client sends `{type: "project_start", target_user_id: N}`.
3. Server validates (all server-side, JWT identity only):
   - Target ∈ projector's direct recruits (`Recruit`: `recruiter_id=auth_user, recruit_id=target, recruit_id IS NOT NULL, depth=1`)
   - Projector owns `astral_lens` (`Inventory` table)
   - Target is online (`ConnectionManager.is_connected(target_id)`)
4. Server sends `projection_started {from_username}` → **target**.
5. Server fetches target's recruits from DB; sends `world_state` → **projector only** (point-to-point, never broadcast).
6. Server moves projector's socket to `(target_id, target_realm)` channel.
7. Server broadcasts `peer_entered` to everyone now in that channel (including target).
8. Server stores `projection_session = {target_id, started_at}` in `_meta[ws]`.
9. Server schedules expiry: `asyncio.create_task(asyncio.sleep(180))` → calls `project_end` handler.

### Client-side on session start (projector)

- Receives `world_state` → seeds target's recruit list locally.
- `RealmManager.scheduleTransition(target_realm)` → switches rendered realm.
- Projector's pharaoh spawns near target's last known pose (inception hover).
- Begins receiving `peer_pose` events for the target.
- Starts 100 ms pose-broadcast interval (stops when channel empties).

### Client-side on session start (target)

- Receives `projection_started` → `#dlg` briefly shows *"A presence stirs nearby…"* then closes.
- Receives `peer_entered` → `PresenceStore.upsert(peer)`.
- Projector's ghost pharaoh rendered on each frame from `PresenceStore`.

### Host crosses a realm boundary

1. Host sends `realm_enter {realm: new_realm, owner_id: host_id}`.
2. Server updates host's channel: `leave (host_id, old_realm)` → `join (host_id, new_realm)`.
3. Server checks for visitors in `(host_id, old_realm)` — moves each to `(host_id, new_realm)`.
4. Server fetches new `world_state` (new realm's recruit data if relevant).
5. Server fires `host_realm_changed {realm: new_realm, world_state}` to each visitor.
6. Visitor clients re-instantiate the new realm and re-seed pyramid data.

### Ending a session

Triggered by: either party sends `project_end`; server expiry fires; either party disconnects.

1. Server broadcasts `peer_left` to departing channel (third parties see the ghost leave).
2. Server removes projector from target's channel.
3. Server moves projector back to `(projector_id, projector_last_realm)`.
4. Server sends `projection_ended {from_username, reason}` to both parties.
5. Projector's client restores their own realm. Projector reappears in their own channel.

---

## Summoning Offline Downline

**Trigger:** Projector clicks/selects Beckon next to an offline recruit in the astral overlay.

**Endpoint:** `POST /api/astral/beckon {target_user_id}`

**Flow:**
1. Validate target ∈ projector's direct recruits (same DB check as `project_start`).
2. Check rate limit: query `Transaction` for `type="beckon", user_id=projector, ref_id=target` within the last hour. Return 429 if found.
3. Insert `Transaction(type="beckon", ref_id=target_id, amount=0)`.
4. Send email via existing Resend path:
   - **Subject:** *"A vision from above"*
   - **Body:** *"[Username] is attempting to reach you across the astral plane. The pyramid stirs. Enter the Desert: [link]"*
5. Return `{ok: true}`.

**UX:** Slot shows *"Summons sent"* briefly. If target comes online during the session, their slot auto-upgrades to selectable (presence list re-fetched on `ws:connected` events, or polled on overlay open).

---

## New REST Endpoints (`backend/app/routers/astral.py`)

### `GET /api/astral/downline`

Returns projector's direct recruits enriched with live presence. Scoped to `recruiter_id = current_user` only — never exposes other users' locations.

```json
{
  "downline": [
    {
      "user_id": 42,
      "username": "ankhman",
      "online": true,
      "realm": "world",
      "owner_id": 42
    }
  ]
}
```

### `POST /api/astral/beckon`

See Summoning section above.

---

## Frontend Architecture

### New modules

**`frontend/game/presence.js` — `PresenceStore`**

Pure state dict `{username → {px, py, facing, frame}}`. No realm logic.

```js
PresenceStore.upsert(username, pose)
PresenceStore.remove(username)
PresenceStore.peers()   // → array of {username, px, py, facing, frame}
PresenceStore.clear()
```

Wired in `session.js._wireWsEvents()`:
- `ws:peer_entered` → `upsert`
- `ws:peer_left` → `remove`
- `ws:peer_pose` → `upsert`

**`frontend/game/astral.js` — `AstralSession`**

Owns the projection lifecycle on the client:
- Keypress activation while `Inventory.owned('astral_lens')`
- Canvas overlay: fetches `/api/astral/downline`, renders list, handles Beckon
- On session start: calls `RealmManager.scheduleTransition`, seeds recruit data
- Sends `pose_update` at 100 ms when `PresenceStore.peers().length > 0`
- Sends `realm_enter` via `RealmManager`'s transition hook
- Timer countdown display (3 min)
- On session end / `ws:projection_ended`: restores prior realm, clears `PresenceStore`

**`frontend/game/astral-chat.js` — `AstralChat`**

Manages `#astral-chat` div — completely independent of `DialogueManager`. Shown only during active projection sessions.

- Maintains a scrolling log of `chat_message` events
- `Enter` key opens inline text input; submit calls `gameSocket.send({type:'chat', text})`
- Dismisses cleanly when session ends

### Modified files

**`frontend/game/ws.js`**
Add `send(data)` method: `this._ws?.send(JSON.stringify(data))` with connected guard.

**`frontend/game/session.js`**
- `_wireWsEvents()` — handle `peer_entered`, `peer_left`, `peer_pose`, `projection_started`, `projection_ended`, `host_realm_changed`
- `_wirePeerSync()` — pose broadcast interval, gated on `PresenceStore.peers().length > 0`

**All realm `render()` methods**
After drawing local pharaoh, iterate `PresenceStore.peers()` and call `drawRealmPharaoh(realm, peer)` for each. Ghost peers distinguished by reduced opacity (visual design deferred).

**`frontend/index.html`**
Add `<div id="astral-chat"></div>` as sibling to `#dlg`.

**`frontend/style.css`**
`#astral-chat` — anchored to top of canvas, hidden by default, similar typography to `#dlg`.

**`frontend/worlds/nile/shop/catalogue.js`**
Add `astral_lens` to `WARES`:
```js
{ id: 'astral_lens', name: 'A Lens Ground from Crushed Scarab', tier: 'MYSTIC', art: 'astral_lens',
  blurb: 'GRIND YOUR EYE TO A FINE POWDER AND SEE THROUGH WALLS' }
```

**`frontend/worlds/nile/shop/ware-art.js`**
Add `astral_lens(X, x, y, s, t)` to `ICON`.

---

## Security Model

1. **Downline membership — server-only.** All `project_start` and `beckon` requests validate against `Recruit` table: `recruiter_id=auth_user AND recruit_id=target AND recruit_id IS NOT NULL AND depth=1`. Lateral, upward, and deep traversal all rejected.

2. **Identity from JWT at WS handshake.** `user_id` is always sourced from the token validated at socket open. No message payload field for identity is trusted.

3. **Channel join authorisation.** `realm_enter` with `owner_id ≠ auth_user_id` is only permitted if an active authorised projection session exists for `(owner_id, realm)`. `ChannelRegistry.join()` enforces this — unauthorised joins are silently rejected.

4. **Presence endpoint scoped.** `GET /api/astral/downline` filters by `recruiter_id = current_user`. Never exposes other players' locations.

5. **`world_state` point-to-point.** Target's recruit data is sent only to the authorised projector's socket immediately on session start — never broadcast to the channel.

6. **Beckon rate-limited.** 1 per (projector, target) per hour via `Transaction` ledger. Target must be in direct downline.

7. **Session timer server-authoritative.** `asyncio.create_task(asyncio.sleep(180))` ends sessions regardless of client state.

8. **Target can always leave.** `project_end` accepted from either party; server honours immediately.

9. **Pose coordinates untrusted (intentional).** Relayed without server-side validation. This is a satire game — no anti-cheat required.

10. **Message schema.** Unknown `type` values silently dropped. Chat text capped at 200 chars server-side.

---

## Shop: New Item & Repricing

**New item in `backend/app/shop.py`:**
```python
"astral_lens": {"name": "A Lens Ground from Crushed Scarab", "price": 8, "kind": "keepsake"}
```

Mixed in with existing items in `catalogue.js` without special prominence — it belongs among the other mystical objects.

**Global reprice:** All items reduced to roughly half current values. New range: $2–$25. `backend/app/shop.py` is the single source of truth; no JS changes required.

---

## v1 Scope Boundary: What Is and Isn't Synced

`world_state` carries the host's recruit list — the Desert pyramid renders correctly from the host's tree. **Everything else renders from the visitor's own local state:** quest flags, NPC states, Nile baby fork outcome, water physics, croc positions. Two players "in the same Nile" may see different NPC dialogue states or encounter different story branches.

This is an acceptable v1 cut. The Desert is the primary projection target and its key mutable state (pyramid shape) is synced. Visitors in other realms share movement and chat but not quest progress. This boundary should be visible to players — the spec for future realm-state sync will address it.

---

## Deferred

- Ghost pharaoh visual distinction (opacity, tint, aura) — design pass after core ships
- Projection activation animation and ghost materialisation effect
- Realm-switch transition effects when following a host across realms
- System realms — `(None, realm_id)` architecture is ready; no consumer yet
- Full channel fanout to N players (full co-presence) — additive once channel registry is in place
- Syncing non-pyramid realm state across visitors (NPC states, quest flags)
- Deeper projection reach (full subtree) — remove `depth = 1` filter from auth query

---

## Verification Plan

1. **Shop:** buy `astral_lens` in Nile stall → inventory shows owned, `earned` deducts, WS `inventory_update` fires. All items show repriced values.

2. **Presence endpoint:** `GET /api/astral/downline` returns only direct online recruits with realm — no lateral/upline users visible.

3. **Happy path:** Two real accounts in a recruiter/recruit relationship, both logged in to separate browser sessions. (Dev-sim recruits have `recruit_id=NULL` and no WS — they cannot be projected into. Use the normal registration + invite flow to set up the second account.) A projects into B → B sees *"A presence stirs"* → A's client switches to B's realm → both pharaohs visible and moving independently on both screens → chat works both ways → 3-min server timer fires → both return to own realms.

4. **Host realm change:** While A is projecting into B, B walks into the Nile → A receives `host_realm_changed` and re-renders the Nile. A's pharaoh continues moving independently.

5. **Pyramid fidelity:** A projects into B → A sees B's pyramid shape (B's recruit tree), not A's own.

6. **Unauthorised projection:** A tries to project into a non-downline user → server rejects. A tries to project into a depth=2 recruit → server rejects. A tries to project into a sim recruit → server rejects.

7. **Downline-auth unit tests:** Depth=1 real recruit passes; depth=2 recruit-of-recruit rejected; lateral/upline/non-downline/sim-recruit all rejected.

8. **Channel auth:** Direct WS message `{type:"realm_enter", realm:"world", owner_id: <other_user>}` without active session → server ignores, socket stays in current channel.

9. **Beckon:** B offline → A sends Beckon → email appears in Mailhog with correct subject/body → second Beckon within 1 hr returns 429.

10. **Body absence:** While A is projecting, a third party C visits A's own world → A's pharaoh is absent from A's world.
