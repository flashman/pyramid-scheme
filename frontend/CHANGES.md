# PYRAMID SCHEME™ — CHANGELOG

---

## v1.22 — Terrain / Data / Draw Separation

> *No gameplay changes. game/pyramids.js is now a pure data layer; pyramid geometry and physics move to worlds/earth/terrain.js; draw side-effects decouple via event; PhysicsRealm gets a terrain interface.*

### `worlds/earth/terrain.js` (new)

All pyramid geometry and surface-query functions moved here from `game/pyramids.js`:
`lyrRect`, `surfAt`, `surfAtExcluding`, `canStep`, `playerPyrSurfAt`, `pyrUnderPlayer`, `nearbyFriendPyr`, `pyrCoversX`.

The optional `(pyrs, floor)` parameters are **removed** — they existed solely for Moon realm portability. Functions now read directly from `G.pyramids` and `GND`. Call signatures are shorter and intent is clearer.

### `game/pyramids.js` — pure data layer

Now contains only: `PyramidLayout`, `mkPyr`, `addLayer`, `pyrEarnings`.

`addLayer` no longer imports from `draw/` or reads `GND`. Instead it emits `'pyramid:layer_added'` with `{ pyrId, wx, layers, depth, zLayer }` and returns. The visual response (particles + screenshake) is wired in `main.js`:

```js
Events.on('pyramid:layer_added', ({ wx, layers, depth, zLayer }) => {
  if (zLayer === 0) {
    G.shake = Math.max(1, 6 - depth * 0.6);
    spawnParts(wx, GND - layers * LH, depthHex(depth), Math.max(4, 22 - depth * 2));
  }
});
```

`game/pyramids.js` now imports only `G` and `Events`. No world constants, no draw utilities.

### `engine/realm.js` — terrain interface on `PhysicsRealm`

Two virtual methods added:

```js
surfaceAt(x)        { return this.floor; }  // highest surface Y at x (default: flat floor)
canStepTo(feetY, x) { return true; }        // can player step to x? (default: always yes)
```

`WorldRealm` overrides both using `worlds/earth/terrain.js`. A future realm with platforms, slopes, or any other surface just overrides these two methods — the physics loop (`_gravityStep`, `_clampX`, `_trackCameraX`) is shared and unchanged.

### `WorldRealm.js` — uses terrain interface

Physics loop calls `this.surfaceAt()` and `this.canStepTo()` instead of importing terrain functions directly. The physics path is now purely in terms of `PhysicsRealm` helpers; terrain shape is a pluggable detail.

`surfaceAt()` on `WorldRealm` respects `G.descendId` (phase-through descent) so the physics loop doesn't need to know about that either.

### Import updates

- `worlds/earth/draw/pyramids.js` — imports `lyrRect` from `../terrain.js` (not `game/pyramids.js`)
- `draw/hud.js` — imports `surfAt` from `../worlds/earth/terrain.js` (not `game/pyramids.js`)
- `main.js` — gains `GND`, `LH`, `depthHex` imports for the new event handler

### `worlds/WORLD_TEMPLATE.md` — updated

Template now covers: `terrain.js` creation for non-flat worlds, `surfaceAt`/`canStepTo` override pattern, flat-world shortcut (no overrides needed), `PyramidLayout` setup, and `scheduleTransition` animation wiring.

---

 — Engine + Game Abstraction Pass
> *No gameplay changes. Moon scene removed. Engine and game abstractions motivated by the moon scene are kept and improved.*

### Moon scene removed
`worlds/moon/` and `game/moon-recruits.js` are deleted. Quest 5 (`LUNAR EXPANSION`), the moon portal in the Council, and all moon-gated state (`G.moonPyramids`, `G.moonRecruits`, `G.moonNextSlot*`) are removed. The `LUNAR PHARAOH` tier and its `moonRequired` gate are removed; `getTier()` is simplified.

### `engine/realm.js` — `PhysicsRealm` + `RealmTransition`

**`PhysicsRealm`** is a new base class for realms with walkable terrain, sitting between `Realm` and concrete realm classes. Constructor takes `{ gravity, worldW, floor, maxFallSpeed }`. Exposes three helpers:
- `_gravityStep(py, pvy, surfY)` — applies one frame of gravity; returns `{ py, pvy }`
- `_clampX(x, margin)` — clamps world-x to valid range
- `_trackCameraX(camX, px, lerpK)` — smooth-follow camera, world-clamped

`WorldRealm` now extends `PhysicsRealm(gravity=0.5)`. The moon had `gravity=0.18`; any future realm declares its own value rather than embedding a magic number.

**`RealmManager.scheduleTransition(toId, { duration, render })`** replaces the ad-hoc `_launch` / `_moonLaunch` booleans that WorldRealm and CouncilRealm each maintained. Realms now hand off a `render(progress: 0..1)` callback and a duration; the manager handles the timer, overlay draw, and the actual realm swap at the end. `main.js` calls `tickTransition()` and `renderTransition()` each frame. `isTransitioning` lets realms block input during the animation.

`WorldRealm` is refactored to use `scheduleTransition` for the capstone launch. `CouncilRealm` drops `_moonLaunch` entirely (the destination is gone) and checks `RealmManager.isTransitioning` to block input.

### `game/pyramids.js` — `PyramidLayout`

`PyramidLayout` is a new class that owns near/mid/far slot arrays and their round-robin counters — the pattern that recurred identically in `recruits.js` (Earth) and `moon-recruits.js`:

```js
const layout = new PyramidLayout({ near: F_SLOTS, mid: F_SLOTS_MID, far: F_SLOTS_FAR });
const wx = layout.nextX(depth);   // depth 1→near, 2→mid, 3+→far
layout.reset();                    // dev-panel hard reset
```

Earth's three raw `G.nextSlot / G.nextSlotMid / G.nextSlotFar` fields are removed from `G` and replaced by `earthLayout` (exported from `game/recruits.js`). The dev panel's full-reset calls `earthLayout.reset()`.

`pyrEarnings()` is simplified — the `G.moonRecruits` spread is removed.

### `game/recruits.js` — `scheduleSubRecruitsFor`

`scheduleSubRecruits(rec)` is refactored into two functions:

- **`scheduleSubRecruitsFor(rec, addFn)`** — the realm-portable form. All timing and probability logic lives here; `addFn(name, depth, parent)` is provided by the caller. A future realm supplies its own add function without duplicating the scheduling math.
- **`scheduleSubRecruits(rec)`** — Earth shorthand; calls `scheduleSubRecruitsFor(rec, addRecruit)`.

`earthLayout` replaces the old `G.nextSlot*` index manipulation in `addRecruit`.

### `worlds/council/constants.js`
`COUNCIL_MOON_PORTAL_X` removed.

---

## v1.20 — Moon Realm (removed in v1.21)
> *Added in v1.20, removed in v1.21. Documented here for historical context.*

- Added `worlds/moon/` — lunar surface realm with floaty gravity (0.18), starfield sky, Earth visible overhead, craters, landing pad, and spaceship landing/launch animation.
- Added `game/moon-recruits.js` — recruitment mechanics mirroring Earth's but targeting `G.moonPyramids`.
- Added three NPCs: Franchise Agent Ω-M, three Reptilian People (SSSS-KATH, HRRK-VAAL, ZZREX-9), and the Monolith.
- Added Quest 5: **LUNAR EXPANSION** — gated behind Tier Omega, culminating in planting a lunar capstone.
- Added moon portal in the Council station; `COUNCIL_MOON_PORTAL_X` constant and portal draw/interaction logic in `CouncilRealm`.
- Added moon state to `G`: `moonPyramids`, `moonRecruits`, `moonNextSlot*`.
- Added `LUNAR PHARAOH` tier gated behind `moon_base_complete` flag.

---

## v1.19 — ES6 Module Migration
> *No gameplay changes.* Full conversion from globals + order-dependent `<script>` tags to native ES6 `import`/`export` modules.

### What changed

**`index.html`** — All 25+ individual `<script>` tags replaced with a single `<script type="module" src="main.js">`. Load order is now enforced by the import graph, not by file ordering in HTML.

**Every JS file** now has explicit `import` declarations at the top and `export` on all public symbols. Nothing is attached to `window` or relied on as an implicit global, except for the handful of `onclick=""` HTML attributes that need window-level refs (these are explicitly set via `window.buyIn = buyIn` etc. in `main.js`).

### Structural improvements

- **`engine/flags.js`** no longer calls `log()` directly (which would have created an engine→UI dependency). It now emits a `game:log` event instead; `main.js` wires that event to `log()`.
- **`game/tiers.js`** exports a `nextId()` function replacing direct mutation of the `_fid` counter from `game/recruits.js`. The counter stays private to its module.
- **`lyrRect()`** moved from `worlds/earth/draw/pyramids.js` to `game/pyramids.js` where it belongs (pure pyramid geometry), and re-exported for use in the draw layer.
- **`main.js`** is now the explicit wiring point for all cross-system event listeners and the game loop boot sequence.

---

## v1.18 — Code Structure Refactor
> *Reconstructed from code*

**No gameplay changes.** Full structural refactor to support multiple worlds/realms more cleanly.

### File structure
- `engine/constants.js` split into three focused files:
  - `engine/canvas.js` — canvas element, context, screen dimensions only
  - `worlds/constants.js` — shared player physics (`SPEED`, `LH`, `CAP_W`, `SLOPE`)
  - Per-world `constants.js` files for each realm (see below)
- `engine/config.js` → `game/config.js` — payout math belongs with game logic, not engine infrastructure
- `engine/state.js` → `game/state.js` — same reasoning; `G` is game state

### Worlds folder
`realms/` replaced by `worlds/`, where each world is now self-contained:
```
worlds/
├── constants.js          ← shared cross-world player + pyramid geometry
├── earth/
│   ├── constants.js      ← GND, WORLD_W, Z_LAYERS, F_SLOTS*
│   ├── WorldRealm.js
│   └── draw/             ← background, celestial, gods, pyramids
├── crypt/
│   ├── constants.js      ← CHAMBER_FLOOR, CHIEF_X
│   ├── ChamberRealm.js
│   └── draw/chamber.js
└── council/
    ├── constants.js      ← COUNCIL_FLOOR, COUNCIL_ARCHON_X, COUNCIL_PORTAL_X
    ├── CouncilRealm.js
    └── draw/council.js
```

### Player drawing
- `drawPharaoh()` now accepts an optional `pose` object `{ px, py, camX, pZ, facing, frame }`
- `drawChamberPharaoh(realm)` and `drawCouncilPharaoh(realm)` are thin wrappers in `draw/pharaoh.js`
- Eliminates the old pattern of temporarily mutating global `G` state just to reuse the draw function

### Other fixes
- `_legT` (walk animation timer) moved from `main.js` into `G.legT` in `game/state.js` — eliminates a leaked module-level global
- Added `worlds/WORLD_TEMPLATE.md` — step-by-step guide for adding future realms

---

## v1.17 and earlier
> *Reconstructed from code structure and inline comments*

### v1.17 — Folder structure introduced
Flat file layout reorganized into `engine/`, `game/`, `draw/`, `realms/`, and `ui/` folders. Script load order formalized in `index.html`.

### v1.16 — Galactic Council + Tier Omega quest
- Added `CouncilRealm` — deep space station, high orbit above the desert world
- Grand Archon `Ω-1` NPC with full branching dialogue tree
- Capstone launch sequence: gold rings → warp tunnel → white flash → realm transition
- Quest 4: **TIER OMEGA** — ascend from the capstone, speak to the Archon, accept Tier Omega certification
- `Events.emit('tier_omega_complete')` triggers particle celebration in `main.js`

### v1.15 — Crypt realm + Sector Chief dialogue upgrade
- Added `ChamberRealm` — alien crypt beneath the player's pyramid
- Sector Chief upgraded from static sprite to a proper `NPC` with branching `Dialogue`
- Quest 3: **THE COSMIC UPLINE** — enter the crypt, speak to the Chief, accept the upline offer
- Crypt door unlocks via `Flags.set('crypt_open')` triggered by `unlockCrypt()`

### v1.14 — Engine refactor: Entity, InteractableRegistry, Dialogue system
- `Entity` and `NPC` base classes extracted to `engine/entity.js`
- `InteractableRegistry` introduced — replaces per-realm proximity if/else chains; SPACE always calls `registry.interact()`
- `Dialogue` + `DialogueManager` added — branching typewriter dialogue rendered to a DOM panel below the canvas
- `Realm` base class + `RealmManager` formalized in `engine/realm.js`
- `Events` pub/sub bus added to `engine/events.js` — decouples systems from hardwired callbacks
- `Flags` + `QuestManager` added to `engine/flags.js`

### v1.13 — Sky gods upgraded to full NPC entities
- Seven sky gods (`SHU`, `THOTH`, `HORUS`, `ANUBIS`, `RA`, `NUT`, `AMUN`) promoted from decorative sprites to `SkyGodEntity` instances extending `NPC`
- Each god has a unique branching dialogue with dynamic text (live recruit counts, net earnings, etc.)
- Gods orbit the player with altitude-aware proximity detection
- Quest 2: **THE SEVEN HEAVENS** — meet all 7 gods and reach PHARAOH tier to unlock the crypt

### v1.12 — Quest system + tier system
- `QuestManager` with live-lambda step evaluation
- Quests 1–2 added: **THE SCHEME BEGINS** and **THE SEVEN HEAVENS**
- Six player tiers: `PEASANT → SCRIBE → ACOLYTE → VIZIER → HIGH PRIEST → PHARAOH`
- Tier milestone events, rank-up log messages, PHARAOH staff rendered on player sprite

### v1.11 — Parallax Z-layers for depth
- Three depth layers (`Z_LAYERS`) with per-layer parallax, scale, alpha, and fog tinting
- Recruit pyramids distributed across foreground / midground / background slots (`F_SLOTS`, `F_SLOTS_MID`, `F_SLOTS_FAR`)
- `fogTint()` blends pyramid colours toward desert haze at distance

### v1.10 — Sky climbing + celestial objects
- Player can walk onto pyramids and climb toward the sky
- Altitude bar in HUD
- Moon, three planets (Jupiter-like, Mars-like, Neptune-like) appear as player ascends
- Static sky god sprites placed at altitude intervals as climbing targets

### v1.9 — World exploration
- Scrolling desert world (`WORLD_W = 8000`)
- Player character with walk/bob animation, facing direction, shadow
- Camera tracking with lerp smoothing; vertical camera drift when climbing
- Recruit pyramids placed at world positions, walkable surfaces via `surfAt()`
- Pyramid descent mechanic (↓ to walk in front, phase-through with `descendId`)
- Minimap at top of canvas

### v1.8 — Pyramid inspect + friend UI panel
- SPACE near a friend's pyramid opens an inspect modal (layers, earnings breakdown)
- Right panel recruit list with depth badges
- Depth-coloured pyramid layers (`depthColor()`)

### v1.7 — Config editor
- Runtime-editable payout config panel (`CFG`, `payoutAtDepth`, `maxPayDepth`, `totalPool`)
- Constraint validation: `platformFee + pool = entryFee`

### v1.6 — Cascading sub-recruits
- `scheduleSubRecruits()` — each recruit probabilistically spawns D+1 recruits after a delay
- Depth-aware payout decay (`CFG.decay`)
- Particle effects on recruit events

### v1.5 — Economics + payout table
- Buy-in flow, scroll slots, invite mechanic
- Payout table rendered in left panel
- Earned / invested / net stats
- Earnings milestone modals

### v1.4 — Canvas game world (initial)
- Canvas element added; basic desert background and ground plane drawn each frame
- Player sprite placeholder; `requestAnimationFrame` game loop

### v1.1–v1.3 — HTML prototype
- Static HTML/CSS pyramid scheme UI: buy-in button, recruit list, activity log
- Payout math as plain JS with hardcoded rates
- No canvas, no world exploration
