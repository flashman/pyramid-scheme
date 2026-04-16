# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PYRAMID SCHEME™ is a satirical browser-based game built as a personal AI-development experiment. Players buy in, walk a procedurally-drawn desert world, send invite scrolls to friends, and watch their pyramid grow in real time as recruits join. Payout credits flow up the chain automatically on every buy-in.

The stack is a FastAPI backend (Python, async SQLAlchemy, PostgreSQL, WebSockets) and a vanilla-JS canvas game frontend (no bundler, native ES modules, nginx static). Everything runs in Docker Compose.

### World structure (realms in order)

| Realm id | Name | Class |
|---|---|---|
| `world` | The Desert | `WorldRealm` (scrolling, physics) |
| `oasis` | The Oasis | `OasisRealm` (scrolling, physics, pool wading) |
| `vault` | Beneath the Sphinx | `VaultRealm` (flat, indoor) |
| `atlantis` | Atlantis | `AtlantisRealm` (free 2D swim, 5 zones) |
| `deep` | The Deep | `DeepRealm` (free 2D swim, 4 zones) |
| `chamber` | The Crypt | `ChamberRealm` (flat, indoor) |
| `council` | Galactic Council | `CouncilRealm` (flat, indoor) |

### Current status (v1.43 frontend / v0.5.0 backend)

**Working end-to-end:** registration, JWT auth, buy-in, upline chain walk, payout credits, WebSocket real-time pyramid updates, invite email flow (Mailhog in dev), dev sim panel, session persistence, profile management.

**Stubbed / incomplete:**
- Stripe payment integration is `raise NotImplementedError` — no real money can move yet.
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
- `app/ws.py` — `manager` singleton (`ConnectionManager`). Supports multiple tabs per user. Import `manager` wherever you need to push real-time events.
- `app/models.py` — `User`, `GameState`, `Invite`, `Recruit`, `Transaction`, `GameEvent`. `Recruit.meta` (JSON) is patched by the frontend after slot assignment via `PATCH /api/recruits/{id}/meta`.

## Frontend architecture

Vanilla JS canvas game — **no bundler**. Native ES modules served by nginx. No npm, no build step.

### Global state: `G` (`game/state.js`)
All shared runtime state (player position, economics, particles, held keys) lives in the exported `G` object. Realms read and write `G` directly. Don't duplicate state elsewhere.

### Event bus: `Events` (`engine/events.js`)
Lightweight pub/sub. Cross-system wiring (realm enter → music change, pyramid layer added → particles) is done in `main.js` via `Events.on(...)`. Keep draw-layer imports out of game-logic files by emitting events instead of calling draw functions directly.

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
