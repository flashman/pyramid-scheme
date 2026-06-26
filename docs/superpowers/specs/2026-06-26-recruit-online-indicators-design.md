# Recruit Online Indicators — Design Spec

**Date:** 2026-06-26
**Status:** Approved, pending implementation
**Follows on from:** [Astral Projection](2026-06-23-astral-projection-design.md)

---

## What This Is

A passive, always-visible **online dot** on direct-recruit cards in the follower-list panel (`#fl`). The dot is green when that recruit currently has a live game session, dim otherwise, and it updates in real time as recruits come and go — no overlay, no action required.

Astral projection (the prior feature) already *knows* who's online, but only inside the Astral Lens overlay and only for lens owners. This surfaces the same presence signal as an ambient, free, always-on indicator on the cards the player already sees.

**Scope:** direct recruits only (depth = 1, real users). Sim/guest recruits and deeper downline get no dot — there is no presence to show.

---

## Design Decisions Made

| Question | Decision |
|---|---|
| Placement | Online dot on the follower-list cards (`#fl`), not a separate panel |
| Freshness | Real-time — pushed over WS on connect/disconnect, not polled |
| Indicator richness | **Binary** (online / offline). No realm string on the card — the Astral Lens already shows realm |
| Who gets a dot | Direct recruits with a real `user_id` (depth = 1). Sims/guests get none |
| Gating | **Ungated** — the dot is free. Projection stays the premium `astral_lens` feature |
| Persistence | **Live-only.** No `last_seen`, no DB session table. On restart, everyone shows offline until clients reconnect (which they do automatically) |

---

## The Core Problem: Follower Cards Have No `user_id`

Presence is keyed on `User.id` (that's what `manager._conns` tracks). But the frontend's follower cards are keyed on the **Recruit row PK** (`rec.id` / `dbId`) — they never carry the recruit's real `User.id`. Neither `/api/recruits` (`RecruitResponse`) nor the live `recruit_joined` WS event includes it.

So the whole feature reduces to **threading the recruit's real `user_id` to the card**, then wiring presence to it. Three mechanisms:

1. Thread `user_id` to the client (REST + WS join event).
2. Seed initial online state on load.
3. Push live changes on connect/disconnect transitions.

---

## Mechanism 1 — Thread the real `user_id` to the client

**Backend — `RecruitResponse` (`backend/app/schemas.py`):**
Add `user_id: int | None`, sourced from `Recruit.recruit_id` (already loaded on the row; `None` for sims). No query change.

**Backend — `recruit_joined` WS event (`backend/app/chain.py`):**
The live event fired when a new recruit buys in already has `buyer_user_id` in scope. Add two fields:
- `user_id: int | None` — the new recruit's real `User.id`.
- `online: bool` — `manager.is_connected(buyer_user_id)` **at emit time** (see Edge Case below).

Only meaningful for the **depth-1** recruiter's event (chain.py emits a `recruit_joined` to every ancestor; deeper ancestors ignore the dot since their card is depth > 1).

**Frontend — recruit object & card (`frontend/game/recruits.js`, `frontend/ui/panels.js`):**
- `addRecruit()` / `restoreRecruits()` store `userId` on the `rec` object (from `user_id`).
- `addFriendUI(rec)` adds `data-uid="${rec.userId}"` to the card and renders a dot **only when `rec.depth === 1 && rec.userId != null`**.

---

## Mechanism 2 — Seed initial state on load

On startup the frontend calls the existing **`GET /api/astral/downline`** once. It already returns `[{user_id, username, online, realm}]` for every direct recruit. Use the `online` field to color each card's dot. (Ignore `realm` — not shown on the card.)

This endpoint has **no lens gate** (confirmed in `astral.py`), so seeding the dots for non-lens-owners is already permitted — consistent with the "dot is free" decision.

> Optional micro-optimization (not adopted): fold `online` into `/api/recruits` and drop this seed call to save one round-trip. Rejected — the separate seed keeps `/api/recruits` free of volatile presence state, and the call is cheap and off the render path.

---

## Mechanism 3 — Push live changes (transitions only)

A new server→client WS event:

| type | payload | meaning |
|---|---|---|
| `recruit_presence` | `{user_id: int, online: bool}` | a direct recruit came online / went offline |

Sent to the **recruiter** (one message, point-to-point — no broadcast amplification).

**On WS connect (`backend/app/routers/ws.py`, around `manager.connect`):**
```
was_online = manager.is_connected(user_id)   # BEFORE connect — O(1) dict lookup
await manager.connect(user_id, ws)
if not was_online:                            # False → True transition (first tab)
    recruiter_id = <lookup>                   # 1 indexed query, see below
    if recruiter_id:
        await manager.send_to_user(recruiter_id, {"type":"recruit_presence","user_id":user_id,"online":True})
```

**On WS disconnect (`_handle_disconnect`, after `manager.disconnect`):**
```
manager.disconnect(user_id, ws)
if not manager.is_connected(user_id):         # True → False transition (last tab closed)
    recruiter_id = <lookup>
    if recruiter_id:
        await manager.send_to_user(recruiter_id, {"type":"recruit_presence","user_id":user_id,"online":False})
```

**The recruiter lookup** (one query, opens a fresh `AsyncSessionLocal()` — the connect path opens none today):
```sql
SELECT recruiter_id FROM recruits
 WHERE recruit_id = :user_id AND depth = 1
```
Hits `ix_recruits_recruit_id` (migration 0001), returns **exactly one row** (a user has one direct recruiter) → `scalar_one_or_none`. Returns `None` for users with no recruiter (e.g. user 1) → no push, no error.

**Multi-tab safety:** the `was_online` / `is_connected` guards ensure the recruiter is notified only on the **first** connect and **last** disconnect. Opening/closing intermediate tabs does zero DB work (just the O(1) dict check) and emits nothing.

**Frontend (`frontend/game/session.js._wireWsEvents`):**
`ws:recruit_presence` → find card by `[data-uid="${user_id}"]`, toggle its dot. O(1) DOM op, off the canvas render loop.

---

## Edge Case: Recruit Already Online at Join

If recruit X is **already online** at the moment they become A's recruit (the buy-in creates the Recruit row *after* X connected), no connect-hook ever fires for A — X's connect-time recruiter lookup ran before A's row existed. A's freshly-created card would wrongly show offline until A reloads or X reconnects.

**Fix:** the `recruit_joined` event carries `online: manager.is_connected(buyer_user_id)` at emit time (Mechanism 1). The new card renders its dot from that field. The connect/disconnect hooks then handle X going on/offline *afterward*. Seed + event + hooks together cover all three entry points (already-known recruits, brand-new recruits, later transitions).

---

## Prior Art & Scaling Path

This is deliberately the **in-memory connection-map** model of presence (online ⇔ has a live socket), which fits the single-instance invariant: `manager._conns` is process-local RAM, never persisted, wiped on deploy. That's the correct choice at this scale, and it's recorded here so it reads as a decision, not an accident.

How larger systems handle the same problem, and where this design would grow:

- **Heartbeat + `last_seen` timestamp** (WhatsApp, Slack, classic forums): derive "online" from a recently-bumped timestamp instead of a boolean. Self-healing — sidesteps the universal truth that *disconnect events are unreliable* (crashes, dead tunnels, half-open sockets leave a boolean `online` stuck `true`; a stale timestamp fixes itself). This design dodges the same trap differently: it recomputes from the live socket and never persists a presence lie. **If we ever want "last seen 3h ago" flavor** (very on-brand for a scheme nagging you back), that's a single `last_seen` column — no other change.
- **Redis/KV TTL key + pub/sub** (Discord, Phoenix Presence, Socket.IO Redis adapter): the named prerequisite in `CLAUDE.md` for scaling past one web instance. A TTL key auto-expires on missed heartbeats (offline without a logout event); pub/sub fans out changes with interest management.
- **Dedicated presence platforms** (Pusher/Ably/Firebase `onDisconnect`): solve the missing-logout problem at the infrastructure layer.

**Upgrade path:** the `recruit_presence` event and the seed model are storage-agnostic. Moving to multi-instance means swapping `manager._conns` for a Redis TTL key + pub/sub behind the same emit points — **the frontend and the wire protocol do not change.** The one constant across every tier is that presence is a *fan-out* problem, not a storage one; this design already limits fan-out correctly by pushing only to the single direct recruiter who cares.

---

## Performance

No game-loop cost and no new index/migration.

- **Backend per transition (first connect / last disconnect, ≈ once per page-load, not per tab, not per message):** one O(1) dict check + one indexed single-row query + one point-to-point push. Negligible beside the existing 10–20 Hz pose-broadcast firehose. The only genuinely new resource is one short-lived DB session per transition (connect path opens none today).
- **`recruit_joined`:** +1 dict lookup (`is_connected`) on an already-rare buy-in event.
- **Frontend:** +1 one-shot REST seed call at load (off render path); per-event work is one `querySelector` + a dot toggle in static side-panel DOM (not the canvas loop).

---

## Files Touched

**Backend:**
- `app/schemas.py` — add `user_id` to `RecruitResponse`.
- `app/chain.py` — add `user_id` + `online` to the `recruit_joined` event payload (import `manager` for the `is_connected` read; `is_connected` is a pure in-memory dict lookup, safe to call here even though chain.py doesn't commit/push).
- `app/routers/ws.py` — `was_online` guard + recruiter lookup + push on connect; symmetric push on disconnect. New `recruit_presence` event. Add a small helper `_direct_recruiter_id(db, user_id)` for the shared lookup.

**Frontend:**
- `game/recruits.js` — carry `userId` through `addRecruit()` and `restoreRecruits()`.
- `ui/panels.js` — `data-uid` + dot element on depth-1 real-user cards; a `setPresence(userId, online)` helper that toggles the dot.
- `game/session.js` — seed from `/api/astral/downline` on load; handle `ws:recruit_presence`.
- `style.css` — `.online-dot` (green) / dim default.

**No migration.** `recruit_id` already indexed; no schema change.

---

## Deferred / Out of Scope

- **`last_seen` / "last online N ago"** — needs a DB column; live-only for now.
- **Realm on the card** — the Astral Lens already shows it.
- **Presence for deeper downline** (depth > 1) — cards exist but get no dot; would need recursive notification fan-out.
- **Multi-instance backplane** (Redis TTL + pub/sub) — only needed if/when the single-instance invariant is lifted; this design is forward-compatible with it.

---

## Verification Plan

1. **Schema/threading:** `GET /api/recruits` includes `user_id` for real recruits, `null` for sims. `recruit_joined` WS event includes `user_id` + `online`.
2. **Seed on load:** Recruiter logs in with one recruit already online → that card shows the online dot immediately (from the `/api/astral/downline` seed).
3. **Live online:** Recruit (offline) logs in → recruiter's matching card flips to green in real time without reload.
4. **Live offline:** Recruit closes their only tab → recruiter's card dims in real time.
5. **Multi-tab (no flap):** Recruit has two tabs open, closes one → recruiter sees no change; closes the second → card dims (exactly one `online:false`).
6. **Already-online-at-join edge case:** Recruit X is logged in; X buys in under A (live `recruit_joined`) → A's brand-new card shows the online dot immediately.
7. **No-recruiter safety:** User 1 (no recruiter) connects/disconnects → lookup returns `None`, no push, no error in logs.
8. **Sims get no dot:** Dev-sim recruits (`recruit_id = NULL`) render cards with no dot and never receive presence events.
9. **Restart behavior:** Backend restarts → all cards show offline until clients auto-reconnect, then live updates resume (documents the live-only limitation).
