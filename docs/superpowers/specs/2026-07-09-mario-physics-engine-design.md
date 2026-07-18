# Mario Physics Engine — Design

**Date:** 2026-07-09
**Status:** Approved

## Goal

Replace the heightfield physics in the side-scrolling realms with a classic-Mario-style
collision-geometry engine: velocity-driven movement (momentum, skid, variable-height jump,
asymmetric gravity, limited air control) and solid-body collision (walls, ceilings,
head-bonkable blocks, one-way platforms, moving platforms), plus the directional
body-vs-body contact primitive that future enemies (stomp mechanic) will build on.

## Scope decisions

| Decision | Choice |
|---|---|
| Depth | Full collision geometry (not just movement feel) |
| Migration | Full migration of side-scrollers — no parallel heightfield system remains |
| Realms | Desert (`world`), Nile, Oasis only. FlatRealm rooms (vault, chamber, council) and swim realms (atlantis, deep) untouched |
| Enemies | Engine capability only (directional contact classification, tested). No enemies placed |
| Fidelity | Faithful conversion — realms play as today. New capabilities (bonkable blocks, one-way/moving platforms) ship tested but unplaced, awaiting future level content |
| Architecture | Solid-list AABB with dynamic geometry providers (tile grid rejected: pyramids grow at runtime at arbitrary, non-grid positions) |

## Background: what "old Mario physics" means here

- **Momentum**: input applies acceleration toward a max speed; friction decelerates on
  release; reversing at speed triggers a skid. Run modifier raises max speed.
- **Variable-height jump**: jump sets an upward velocity; gravity is reduced while rising
  with the button held, full on release (jump cut). Jump velocity gets a bonus scaled by
  horizontal speed (running jumps go higher).
- **Asymmetric gravity**: falling gravity > rising gravity; terminal velocity.
- **Air control**: mid-air steering uses the same accel model — no instant reversal.
- **Static contact is directional gameplay**: floors land, walls zero `vx`, ceilings
  head-bonk (and bonking a block from below is an *action*), one-way platforms pass from
  below, moving platforms carry riders.
- **Dynamic contact is directional gameplay**: top contact = stomp (bounce), side/bottom
  contact = damage. (Capability only in this project.)

## Current-engine gaps (pre-migration)

- `inputDx()` sets a fixed ±5 px/frame (Shift ×2) — position-driven, no momentum.
- Jump is flat `pvy = -9`; gravity symmetric 0.5/frame, terminal 14 (`_gravityStep`).
- Terrain is a heightfield: `surfaceAt(x)` returns one surface per x; nothing can be
  above the player. `canStepTo` rejects steep faces; no walls/ceilings representable.
- `Enemy` is a stationary radius-hurt entity; no directional contact anywhere.
- Useful existing structure: pyramids are already per-layer AABBs (`lyrRect(p, i)`,
  layers `LH = 22`px tall), and `canStep` implements a one-layer auto-step-up (≤ 23px).

## Design

### 1. Core collision module — `engine/physics2d.js` (new)

- **`Body`** — moving rect anchored at feet-center (matches `G.px`/`G.py` convention):
  `{ x, y, w, h, vx, vy }` + per-frame contact flags `grounded`, `headBonk`, `wallLeft`,
  `wallRight`, `riding`.
- **`Solid`** — rect with flags: `{ x, y, w, h, oneWay?, vx?, vy?, onBonk?, tags? }`.
- **`SolidSet`** — per-realm collection: static rects + *providers* (functions returning
  rects), rebuilt per frame. The Desert provider maps `G.pyramids` through `lyrRect()`
  and filters by `G.pZ` / `G.descendId`, so z-layer descent is geometry filtering, not
  special-cased physics. Queries are a linear scan (realm solid counts are in the dozens).
- **`resolveMove(body, solids, { maxStepUp })`** — per-axis resolution.
  - Horizontal: on overlap, attempt auto-step-up (rise ≤ `maxStepUp` = `LH + 1` = 23px,
    with headroom check) — preserves pyramid stair-walking exactly; otherwise clamp,
    zero `vx`, set wall flag.
  - Vertical: downward → land (one-way solids only land when feet started above the top);
    upward → clamp, zero `vy`, set `headBonk`, fire the solid's `onBonk`.
- **Moving solids** — updated before the player; grounded riders inherit the solid's
  delta; a solid moving into a body pushes it; an impossible push emits `squish`
  (realms decide the response; nothing uses it yet).
- **`contactDirection(a, b)`** — classifies body-vs-body contact as
  `top`/`bottom`/`left`/`right` from overlap + relative velocity. This is the stomp
  primitive and the entirety of the enemy-capability scope: shipped and tested,
  consumed by nothing until enemies exist.

### 2. Kinematics module — `engine/kinematics.js` (new)

Pure functions over one exported tunables object (`TUNING`): walk/run acceleration, max
speeds, ground friction, skid deceleration, air acceleration, `jumpVy` + speed-scaled
bonus, three gravity constants (rising-held, rising-released, falling), terminal
velocity. `stepRun()` / `stepJump()` take velocity + input, return new velocity — no DOM,
no `G`, node-testable.

Controls: **Z = jump** (unchanged), **Shift = run** (max-speed raise feeding
acceleration, replacing the instant ×2), arrows steer. Variable-jump hold reads
`G.keys['z']` (already tracked). Initial tuning calibrated so top run speed ≈ today's
sprint (traversal times stay familiar); adjusted by playtest.

### 3. Realm base — `SolidRealm` (new), replacing `PhysicsRealm`

Owns a `SolidSet` + the player `Body` (bridged to `G.px/py/pvy` plus new `G.pvx`),
reuses camera-follow / world-clamp helpers. Frame order: input → kinematics →
`resolveMove` → contact events on the `Events` bus (`physics:land`, `physics:bonk`) so
sound/particles wire in `main.js` per house style. `getPlayerPose()` contract unchanged
(pharaoh/peer drawing needs nothing). *Zones* — rects with kinematics modifiers (water,
pool) — live on `SolidRealm`, not in the collision core.

After all three side-scrollers migrate, `PhysicsRealm` has no subclasses and is deleted;
`WORLD_TEMPLATE.md` is rewritten around `SolidRealm`.

### 4. Faithful migrations

- **Desert**: pyramid provider as above. `ArrowDown`/`ArrowUp` z-layer logic, triggers,
  portals, capstone/crypt zones, camera unchanged. `terrain.js` keeps its query helpers
  for HUD/tooltips (`nearbyFriendPyr`, `pyrUnderPlayer`); `canStep` and
  `surfAt`-as-physics retire.
- **Nile**: dry banks and hop-stones become solids; the river is a *zone* — inside it a
  swim kinematics variant applies (reduced accel, no run) and one-way `CURRENT_SPD` is
  added as external velocity; delta exemption preserved.
- **Oasis**: ground/ledges become solids; the pool is a zone applying the 0.55 wade
  multiplier to max speed.

### 5. Edge cases

- Pyramid grows under/around the player → depenetrate upward on provider rebuild
  (matches today's snap-up behavior).
- Realm transitions zero both velocities in `onEnter`.
- Physics stays per-frame (not dt-scaled), consistent with the current engine. At
  ≤ 10px/frame against ≥ 22px solids, per-axis resolution cannot tunnel.

### 6. Testing

`physics2d` and `kinematics` are DOM-free by design → node smoke tests (established repo
pattern): wall/ceiling/floor/one-way/step-up resolution, rider carry, `contactDirection`
classification, variable-jump arc heights, skid distances. Realm files get
`node --check`. Manual playtest checklist per realm: pyramid climb, descend-behind,
crypt door, capstone ascend, Nile crossing, pool wade, all portals and quest triggers.

### 7. Build order

1. `engine/physics2d.js` + `engine/kinematics.js` + node tests
2. `SolidRealm` + Desert migration
3. Nile migration
4. Oasis migration
5. Capability features (bonkable, one-way, moving solids, squish, body-contact) +
   delete `PhysicsRealm` and dead heightfield helpers; update `WORLD_TEMPLATE.md`
