# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PYRAMID SCHEME™ is a satirical browser-based game built as a personal AI-development experiment. Players buy in, walk a procedurally-drawn desert world, send invite scrolls to friends, and watch their pyramid grow in real time as recruits join. Payout credits flow up the chain automatically on every buy-in.

The stack is a FastAPI backend (Python, async SQLAlchemy, PostgreSQL, WebSockets) and a vanilla-JS canvas game frontend (no bundler, native ES modules, nginx static). Everything runs in Docker Compose.

### World structure (realms in order)

| Realm id | Name | Class |
|---|---|---|
| `world` | The Desert | `WorldRealm` (scrolling, physics) |
| `nile` | The Nile | `NileRealm` (scrolling, physics; west off the Desert; one-way river current) |
| `oasis` | The Oasis | `OasisRealm` (scrolling, physics, pool wading) |
| `vault` | Beneath the Sphinx | `VaultRealm` (flat, indoor) |
| `atlantis` | Atlantis | `AtlantisRealm` (free 2D swim, 5 zones) |
| `deep` | The Deep | `DeepRealm` (free 2D swim, 4 zones) |
| `chamber` | The Crypt | `ChamberRealm` (flat, indoor) |
| `council` | Galactic Council | `CouncilRealm` (flat, indoor) |

### Current status (v1.46 frontend / v0.5.1 backend)

**Working end-to-end:** registration, JWT auth, upline chain walk, payout credits, WebSocket real-time pyramid updates, invite email flow (Mailhog in dev), dev sim panel, session persistence, profile management.

**Buy-in flow (manual):** `POST /api/buy-in` returns 503 while Stripe is disabled. The authenticated buy-in dialog shows a QR code + a deterministic 5-emoji **offering code**. The player pays externally (e.g. Venmo) and includes the code in the payment note.

The admin confirms payments from the **`/admin` page** (`frontend/admin/index.html`, served by nginx; gate redirects non-admins to `/`). The page takes a username **or** a pasted offering code (resolved live via `POST /api/admin/lookup`, which returns every matching username + bought status — the code is a lossy hash, so collisions are listed for disambiguation), then calls `POST /api/admin/confirm-buyin {username}`. Both routes are gated by `User.is_admin` (user 1 is the sole admin, seeded by migration 0003) and registered unconditionally (not behind `DEBUG`).

**Do NOT hand-edit `GameState.bought = True` in the DB** — that grants scrolls but skips the entire upline payout. `confirm-buyin` calls `_apply_confirmed_buyin()` in `routers/payments.py`, the shared apply path: marks bought, grants scrolls, walks the upline via `run_buyin_chain()`, writes ledger rows, pushes WS events. Same function is the blueprint the Stripe webhook will call once wired (pass `source="stripe"`). The endpoint refuses an already-bought user unless `allow_rebuy=true`, because each confirm pays the chain again.

**Offering code is server-canonical.** `app/offering.py` is the single implementation; `GET /api/me` returns `offering_code`, and the buy-in dialog reads `G.offeringCode` (never computes it in JS — same single-source-of-truth rule as payout/shop values). `test_offering_code.py` pins it to the frontend reference values.

**Stubbed / incomplete:**
- Stripe payment integration is a 503 gate — `_apply_confirmed_buyin()` holds the chain-walk blueprint; call it from the webhook after signature verification.
- Balance withdrawal/cashout has no implementation.
- `POST /api/stripe/webhook` accepts any POST; signature verification is a TODO comment.

**Do not accept real money until Phase 1 blockers in `PYRAMID_SCHEME_TODO.md` are resolved.** The highest-priority items are: rotating `SECRET_KEY`, moving the WS JWT off the query string, rate-limiting auth endpoints, and wiring Stripe properly.

**Story gaps:** the game has a hard stop after the 4th quest (post-Tier-Omega loop missing). The `stele_read` flag is set but has no listener. Sky god rewards are quest steps with no mechanical payoff.

## Quick start

```bash
docker compose up --build
# Game:    http://localhost:5173
# Emails:  http://localhost:8025  (Mailhog — all outgoing mail caught here)
# DB:      http://localhost:5050  (pgAdmin, no login)

# Apply migrations (first time or after schema changes):
docker compose exec backend alembic upgrade head
```

Backend hot-reloads via uvicorn `--reload` (source bind-mounted at `/app`). Frontend is nginx static — rebuild the image to pick up JS changes.

## Dev workflow

- **Backtick `` ` ``** opens the dev panel in-game with a recruit simulator.
- **`DEBUG=true`** (default in dev) enables `/api/dev/*` endpoints. Setting `DEBUG=false` disables them entirely — never enable in production.
- Invite emails land in Mailhog (`:8025`), not a real inbox.
- Wipe all data: `docker compose down -v && docker compose up --build`

## Backend architecture

`FastAPI` + `asyncpg` + `SQLAlchemy` (async ORM) + `Alembic` migrations.

**Do not use `create_all`.** Schema is managed exclusively by Alembic. Adding models requires a new migration file.

Key files:
- `app/chain.py` — `run_buyin_chain()` walks the upline and credits ancestors. Shared by real buy-ins (`routers/payments.py`) and the dev sim (`routers/dev.py`). Does NOT commit — caller commits then pushes WS events.
- `app/payout.py` — `PAYOUT_CONFIG` is the **single source of truth** for all payout math. The frontend fetches it via `GET /api/config`; never duplicate these values in JS.
- `app/shop.py` — `SHOP_CATALOGUE` is the **single source of truth** for bazaar ware ids/prices (mirrors `payout.py`); served via `GET /api/config`. Never hardcode ware prices in JS. `app/inventory.py` has the inventory helpers; ownership lives in the `inventory` table (**keepsakes only**, qty 1 — consumables are effect-only, never inventoried), and every buy writes a `shop_buy` row to `Transaction` (the DB ledger). **Namespace lock:** `PUT /api/state` strips reserved flag prefixes (`shop_owned_*`) so clients can't forge ownership — keep server-owned state out of the client-settable `flags`.
- `app/ws.py` — `manager` singleton (`ConnectionManager`). Supports multiple tabs per user. Import `manager` wherever you need to push real-time events. `manager.realm_of(user_id)` resolves a user's current realm from socket metadata (used by astral presence) — don't reach into `manager._conns`/`_meta` directly.
- `app/channels.py` — `channels` singleton (`ChannelRegistry`). Maps `(owner_id | None, realm_id) → set[WebSocket]` so co-presence (ghost peers, chat, astral projection) is scoped to one realm instance. `(None, realm)` keys are reserved for future shared "system" realms (cantina/ocean).
- `app/models.py` — `User`, `GameState`, `Invite`, `Recruit`, `Transaction`, `GameEvent`, `Inventory`. `Recruit.meta` (JSON) is patched by the frontend after slot assignment via `PATCH /api/recruits/{id}/meta`.

> **⚠️ Single-instance invariant.** `manager` and `channels` hold all WebSocket / co-presence state in **process memory**. The backend therefore runs as **exactly one web instance** — there is no cross-process fan-out. Consequences: (1) never enable horizontal autoscaling on Render — two instances = split-brain co-presence (users on different instances can't see each other, and a rolling deploy briefly runs two); (2) every deploy / idle spin-down wipes live channels and in-flight projection sessions (clients reconnect and re-`realm_enter`, but an active projection is lost). Scaling past one instance, or building a many-occupant shared realm, requires a pub/sub backplane (Render Key Value / Redis) behind `channels.broadcast` + interest management — see `PYRAMID_SCHEME_TODO.md`.

## Frontend architecture

Vanilla JS canvas game — **no bundler**. Native ES modules served by nginx. No npm, no build step.

### Global state: `G` (`game/state.js`)
All shared runtime state (player position, economics, particles, held keys) lives in the exported `G` object. Realms read and write `G` directly. Don't duplicate state elsewhere.

### Event bus: `Events` (`engine/events.js`)
Lightweight pub/sub. Cross-system wiring (realm enter → music change, pyramid layer added → particles) is done in `main.js` via `Events.on(...)`. Keep draw-layer imports out of game-logic files by emitting events instead of calling draw functions directly.

### Flags & the Ledger (`engine/flags.js`, `engine/ledger.js`)
`Flags` are named, persistent game-state values (client-settable; synced to the server and restored on load — see `game/session.js`). Quests gate on them. The **Ledger** (`engine/ledger.js`) is a Flags-backed append-only accumulator of one-way story *forks* (e.g. the Nile basket: `Ledger.record('nile_baby', 'adopted'|'drowned')`). It records "at face amount" — it does not judge — for a future endgame reckoning to read back via `Ledger.count(...)`.

### Inventory & the bazaar shop (`game/inventory.js`, `worlds/nile/shop/`)
The `Inventory` store mirrors the server inventory — hydrated from `/api/me` and the WS `inventory_update` event, which **always carry the full list** (`hydrate()` replaces, never merges). The "JUST POTS" stall (`worlds/nile/shop/StallOverlay.js`) is a canvas overlay opened from the Nile merchant; wares come from the server catalogue (`game/config.js getShop()`), the spoken descriptions/retorts drive the real `#dlg` window, and buying goes through `POST /api/shop/buy`. Read ownership via `Inventory.owned(id)` — **not** `shop_owned_*` flags. The design + the (cut) Phase 2/3 scope live in `docs/superpowers/specs/2026-06-18-shop-*`.

### Realm system (`engine/realm.js`)
- `Realm` — minimal base: `onEnter`, `onExit`, `update(ts)`, `render()`, `onKeyDown(key)`, `getPlayerPose()`.
- `PhysicsRealm` — adds gravity (`_gravityStep`), camera follow (`_trackCameraX`), world clamp (`_clampX`), and terrain interface (`surfaceAt`, `canStepTo`).
- `FlatRealm` (`worlds/FlatRealm.js`) — fixed-camera realms (crypt chamber, council, vault). Provides `_walkStep(ts)` and `getPlayerPose()`. Extend this instead of PhysicsRealm for indoor/chamber areas.
- `RealmManager` — registers realms, handles transitions. Use `scheduleTransition(id, {duration, render})` for animated swaps; `transitionTo(id)` for immediate swaps. Check `RealmManager.isTransitioning` to block input/update during animations.

### Realm graph: `PortalRegistry` (`engine/portal.js`)
The directed graph of realm-to-realm connections. Each realm registers its **outgoing portals in its own constructor** so conditions can close over `this`:

```js
PortalRegistry.register({
  from: 'vault', to: 'oasis',
  key: 'ArrowUp',
  condition:  () => this.px < 200,      // optional — arrow fn closes over `this`
  onUse:      () => { G.shake = 4; },   // optional side-effects before swap
  transition: vaultTransRender,         // optional — null = instant swap
  duration:   1000,
});
```

Each realm's `onKeyDown()` delegates to the registry instead of hardcoding transitions:

```js
onKeyDown(key) {
  if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
  if (PortalRegistry.handleKey(key, 'vault', this.triggers)) return true;
  if (key === ' ') return this.registry.interact();
  return false;
}
```

Swimming realms (Atlantis, Deep) normalize WASD → arrow keys before calling `handleKey()`. Portals with `key: null` are for graph completeness only (boundary exits handled in `update()`).

**To add a portal from an existing realm to a new one**: register it in the new realm's constructor with `from: 'existing-realm'` — no edit to the existing realm file required.

### Realm manifest (`worlds/manifest.js`)
Single file for realm instantiation. `main.js` imports `ALL_REALMS` and registers them — `main.js` never needs to change when adding realms. Add new realms here only.

### Adding a new world
Follow `worlds/WORLD_TEMPLATE.md` — it is the authoritative step-by-step guide (constants → terrain → draw → realm class → register in `worlds/manifest.js` → wire portals via `PortalRegistry`).

### Draw conventions
- `drawRealmPharaoh(realm)` reads `realm.getPlayerPose()` — no realm-specific pharaoh draw variant needed.
- Particles: write to `G.particles[]`; `drawParts()` handles rendering.
- All realms must implement `getPlayerPose()` returning `{ px, py, camX, pZ, facing, frame }`.

### Audio (`audio/sound.js`)
`SoundManager` — procedural Web Audio. `SoundManager.playRealm(id)` switches the theme. Triggered via `Events.on('realm:enter', ...)` in `main.js`.

## Migrations

```bash
# Apply all pending
docker compose exec backend alembic upgrade head

# Create a new migration after model changes
docker compose exec backend alembic revision --autogenerate -m "describe change"

# View history
docker compose exec backend alembic history
```
