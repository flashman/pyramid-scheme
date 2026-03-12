# ⚡ PYRAMID SCHEME™ ⚡

> *★ WALK THE DESERT ★ BUILD YOUR EMPIRE ★ TOTALLY LEGAL ★*

A browser-based canvas game about building a pyramid scheme in ancient Egypt — and eventually being recruited into a **galactic** one. Walk the desert, recruit followers, climb the ranks from Peasant to Pharaoh, descend into the crypt, and ascend to the stars.

---

## Quick Start

This project uses ES modules, which require a web server (browsers block `file://` imports for security). The simplest way to run it locally:

```bash
python -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

> Any static file server works — `npx serve`, `live-server`, etc. The project has no build step and no dependencies.

---

## Gameplay Overview

| Action | Key |
|--------|-----|
| Walk left / right | `← →` or `A / D` |
| Step in front of pyramids (foreground layer) | `↓` |
| Return to surface layer / enter doors / ascend / enter oasis / enter passage | `↑` |
| Interact / inspect / confirm dialogue | `Space` |
| Speak to sphinx | `Space` (near sphinx) |
| Answer riddle | Type + `Enter` |
| Navigate dialogue choices | `↑ ↓` |
| Skip dialogue text | `Space` (while text is printing) |
| Jump (world + oasis) | `Z` |
| Sprint | `Shift + ← →` |

**The loop:**
1. Click **BUY IN** ($10) to place your capstone and receive 4 invite scrolls.
2. Click **SEND SCROLL** to recruit a follower — each one pays out up the chain.
3. Walk the desert to visit your recruits' pyramids. Press `Space` to inspect them.
4. Climb the tier ladder (Peasant → Scribe → Acolyte → Vizier → High Priest → Pharaoh).
5. Fly into the sky, meet the seven Egyptian sky gods.
6. Reach Pharaoh + meet all 7 gods → unlock the crypt beneath your pyramid.
7. Speak to Sector Chief Ω-7 in the crypt. Accept the cosmic upline.
8. Ascend from your capstone to the Galactic Council. Meet the Grand Archon. Accept Tier Omega.
9. Walk east to the edge of the desert. Press `[↑]` to enter the Oasis.
10. Wade through the pool (watch the reflection change). Walk to the great sphinx and press `[Space]` to receive a riddle.
11. Answer correctly — with each solved riddle the passage between the sphinx's paws glows brighter. Solve at least one and press `[↑]` at the archway to step through.

---

## Project Structure

```
pyramid-scheme/
│
├── index.html              # Shell: canvas, side panels, config editor, modal
├── main.js                 # Entry point: wires realms, quests, input, game loop
├── style.css               # All CSS — dark Egyptian theme, panel layout
│
├── engine/                 # Reusable, game-agnostic systems
│   ├── canvas.js           # Canvas element + 2D context (X), screen dimensions
│   ├── colors.js           # Central color palette (COL)
│   ├── events.js           # Lightweight pub/sub event bus (Events)
│   ├── flags.js            # Named boolean/value flags + quest manager
│   ├── realm.js            # Realm, PhysicsRealm, RealmManager with transition animations
│   ├── entity.js           # Entity, NPC, Enemy (patrol AI), Collectible, FreeRoamEnemy (2D underwater AI)
│   ├── freemove.js          # FreeMoveRealm — 2D swim physics + camera-Y (base for Atlantis and future underwater worlds)
│   ├── health.js           # HealthSystem — kill / death-screen / respawn / immunity (standalone, any realm can use)
│   ├── hazard.js           # TimedHazard — timed zone hazard (danger mode / survival mode, switchable at runtime)
│   ├── interactables.js    # Per-frame nearest-interactable registry
│   ├── trigger.js          # TriggerZone + TriggerRegistry (area gates, door hints)
│   └── dialogue.js         # Canvas-rendered branching dialogue system
│
├── game/                   # Game-specific logic and state
│   ├── state.js            # Singleton G — all shared mutable game state
│   ├── config.js           # Payout math: entry fee, decay curve, depth limits
│   ├── tiers.js            # Rank tiers, recruit names, ID generation
│   ├── recruits.js         # Buy-in, scroll sending, pyramid placement, inspect
│   │                       #   └── exports earthLayout (PyramidLayout) + scheduleSubRecruitsFor
│   ├── pyramids.js         # Data model only: mkPyr, addLayer, pyrEarnings, PyramidLayout
│   │                       #   addLayer emits 'pyramid:layer_added' — no draw imports
│   └── quests.js           # All quest definitions (registered at startup)
│
├── draw/                   # Shared drawing utilities used across realms
│   ├── pharaoh.js          # Player sprite (the Pharaoh character)
│   ├── hud.js              # HUD bar, minimap, particles, quest tracker
│   └── utils.js            # depthColor, fogTint, spawnParts helpers
│
├── ui/                     # HTML panel updates (left/right sidebars)
│   ├── panels.js           # Stats, recruit list, activity log, scroll slots
│   ├── config-editor.js    # Payout rate tuner (validates the math must balance)
│   ├── modal.js            # Full-screen announcement modal
│   └── dev-panel.js        # Developer overlay (backtick to toggle)
│
└── worlds/                 # One folder per realm/scene
    ├── constants.js        # Cross-realm constants (player speed, layer height)
    ├── WORLD_TEMPLATE.md   # Guide for adding new worlds
    │
    ├── earth/              # The desert world (default starting realm)
    │   ├── WorldRealm.js   # Extends PhysicsRealm; overrides surfaceAt/canStepTo with pyramid terrain
    │   ├── constants.js    # World width, ground Y, Z-layer parallax data, slots
    │   ├── terrain.js      # Pyramid geometry + surface queries (lyrRect, surfAt, canStep, …)
    │   └── draw/
    │       ├── background.js   # Sky gradient, stars, desert ground
    │       ├── celestial.js    # Sun, moon, clouds
    │       ├── gods.js         # 7 sky god entities with branching dialogues
    │       └── pyramids.js     # Isometric pyramid drawing with depth/fog tinting
    │
    ├── crypt/              # Inside the player's pyramid (unlocked mid-game)
    │   ├── ChamberRealm.js # Chamber movement + Sector Chief Ω-7 dialogue
    │   ├── constants.js    # Floor Y, NPC position
    │   └── draw/
    │       └── chamber.js  # Crypt interior: stone walls, torches, hieroglyphs
    │
    ├── council/            # Galactic Council station (end-game)
    │   ├── CouncilRealm.js # Council movement + Grand Archon Ω-1 dialogue
    │   ├── constants.js    # Floor Y, NPC positions, Earth portal X
    │   └── draw/
    │       └── council.js  # Space station interior: stars, columns, cosmic FX
    │
    └── oasis/              # The Oasis — east of the desert (sphinx realm)
        ├── OasisRealm.js   # PhysicsRealm: scrolling world, pool wading, passage entry
        ├── constants.js    # OASIS_FLOOR, POOL_WX/WIDTH/FLOOR, SPHINX_WX, PASSAGE_WX
        ├── riddles.js      # RiddleManager: 12 riddles, typewriter, bottom-bar panel UI
        └── draw/
            └── oasis.js    # Golden-hour sky, pool w/ prophetic reflection + player splash,
                            #   palms, full-detail sphinx, hidden passage archway
```

---

## Architecture Notes

### Realms (scene management)
Each scene is a `Realm` subclass registered with `RealmManager`. Switching scenes calls `onExit()` on the current realm and `onEnter(fromId)` on the next.

Realms with walkable terrain should extend **`PhysicsRealm`** instead of `Realm` directly. `PhysicsRealm` is configured with `{ gravity, worldW, floor, maxFallSpeed }` and exposes `_gravityStep()`, `_clampX()`, and `_trackCameraX()` helpers, eliminating copy-pasted physics math.

Fixed-camera realms (chamber, council, vault) extend **`FlatRealm`**, which adds `_walkStep(ts)` (movement + animation + G-sync in one call) and `getPlayerPose()`.

Underwater / freely-swimming realms extend **`FreeMoveRealm`** (`engine/freemove.js`). It handles 2D free-movement physics, vertical camera tracking, `_syncToG()`, `getPlayerPose()`, and `_aboveSurface()`. Adding a new FreeMoveRealm subclass is the same pattern as any other realm, with swim physics free:

```js
class MyOceanRealm extends FreeMoveRealm {
  constructor() {
    super('my-ocean', 'THE DEEP', {
      worldW: 3200, worldH: 2400, entryY: 80,
      physics: { acc: 0.4, drag: 0.92, maxSpd: 6, yDrift: -0.03 },
    });
    this.health = new HealthSystem({ onKill: …, onRespawn: () => this.resetToEntry(100) });
  }
  update(ts) {
    if (this.health.update()) { this._syncCamera(); return; }
    this._moveStep(ts);   // physics + G sync
    // ... enemies, triggers, etc.
  }
}
```

**Terrain interface.** `PhysicsRealm` declares two virtual methods with flat-floor defaults. Override them to give your realm its own surface shape:

```js
// Returns highest surface Y at world-x x (default: flat floor).
surfaceAt(x) { return this.floor; }

// Returns true if the player at feetY can step to x (default: always passable).
canStepTo(feetY, x) { return true; }
```

**Transition animations** are first-class. Instead of managing a local `_launch` flag, realms call:
```js
RealmManager.scheduleTransition('target-realm', {
  duration: 2600,
  render: (progress) => { /* draw overlay at 0..1 */ }
});
```
`main.js` calls `RealmManager.tickTransition()` and `RealmManager.renderTransition()` each frame. Input is blocked during the animation.

**Player pose.** Every realm overrides `getPlayerPose()` → `{ px, py, camX, pZ, facing, frame }`. This lets `drawRealmPharaoh(realm)` work correctly in any realm without realm-specific pharaoh draw variants. `FlatRealm` and `OasisRealm` provide their implementations; `WorldRealm` still passes the pose directly since it draws the pharaoh inline.

**G sync.** `FlatRealm._walkStep()` and `OasisRealm._syncToG()` write local player state back to G each frame. This ensures the HUD, minimap, and any G-reading system sees the current player position regardless of which realm is active.

**Movement input.** Use `inputDx(baseSpeed)` from `worlds/constants.js` instead of repeating the `ArrowLeft/Right/WASD/Shift` block:
```js
import { inputDx, SPEED, SPDHALF } from '../constants.js';
const dx = inputDx(SPEED);  // sets G.facing + G.pmoving as side-effects
if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);
```

### TriggerZones (area gates and hints)
`TriggerZone` replaces hardcoded proximity helpers like `_oasisGateNear()`. Register zones in the realm constructor; the registry handles entry/exit callbacks and hint rendering:

```js
import { TriggerZone, TriggerRegistry } from '../../engine/trigger.js';

// constructor:
this.triggers = new TriggerRegistry();
this.triggers.add(new TriggerZone('my-door', {
  x1: DOOR_X - 60, x2: DOOR_X + 60,
  condition: () => Flags.get('door_unlocked'),
  hint:      '[↑] ENTER',
  onEnter:   () => log('A door opens.', ''),
}));

// update():
this.triggers.update(G.px);

// render():
this.triggers.renderHints(G.camX);  // draws pulsing hint text for active zones

// onKeyDown():
if (key === 'ArrowUp' && this.triggers.isInside('my-door')) {
  RealmManager.transitionTo('target');
}
```

### Enemies
`Enemy` (in `engine/entity.js`) is an `Entity` subclass with patrol AI. Register with `InteractableRegistry` like any entity; the registry calls `update(ts)` and `draw(sx, sy)` automatically.

For **underwater enemies**, use `FreeRoamEnemy` (also in `engine/entity.js`). It supports two chase styles (`'direct'` for snappy surface-level steering, `'momentum'` for heavy accumulating velocity), sinusoidal drift when idle, an `aggressiveFn()` to toggle aggression via flag checks, and zone bounds to keep enemies in their depth range.

```js
const shark = new FreeRoamEnemy('shark', startX, Y, {
  chaseStyle: 'direct',  patrolBounds: { x1, x2, y },
  aggroRange: 210,       hurtRange: 32,
  aggroZoneY: ZONE_2_END,
  drawFn: (e, sx, sy, t) => drawShark(e, sx, sy, t),
});
// In update():
shark.update(ts, this.px, this.py);
if (health.canTakeDamage() && shark.hurtCheck(this.px, this.py)) { … }
```

Both `Enemy` and `FreeRoamEnemy` accept a `drawFn: (entity, sx, sy, ts) => void` constructor option — pass your draw function inline rather than subclassing.

### Player damage (HealthSystem)
`HealthSystem` (`engine/health.js`) handles kill/death-timer/respawn/immunity for any realm. No inheritance required — any realm can own one as a field.

```js
this.health = new HealthSystem({
  respawnDelay: 2800, immunityAfterSpawn: 3000,
  onKill:    (cause, msg) => { G.shake = 22; log(msg.split('\n')[0], 'hi'); },
  onRespawn: ()           => { this.resetToEntry(200); G.shake = 8; },
});
// In update() — before any other logic:
if (this.health.update()) return;  // true while dying
// To damage:
if (this.health.canTakeDamage() && enemyHit) {
  this.health.kill('shark', deathMsg);
}
```

### Timed hazard zones (TimedHazard)
`TimedHazard` (`engine/hazard.js`) models a circular zone where lingering has consequences. Supports **danger mode** (leave in time or die) and **survival mode** (stay the full duration to unlock something). Mode can be switched at runtime via `setMode()`.

```js
this.choir = new TimedHazard('choir', {
  wx: CHOIR_WX, wy: CHOIR_WY, radius: CHOIR_RADIUS,
  dangerDuration: 2400,
  onEnter: () => log('Swim away.', ''),
  onEscape: () => log('You swam fast enough.', ''),
  onDanger: () => health.kill('choir', msg),
});
// Switch to survival mode when a flag changes:
this.choir.setMode({ surviveDuration: 5000, onSurvive: () => { Flags.set('cleared', true); } });
// In update():
this.choir.update(this.px, this.py);
// progress (0..1) is available for drawing vignette overlays:
if (this.choir.isInside) drawWarning(this.choir.progress);
```

```js
import { Enemy } from '../../engine/entity.js';

const scarab = new Enemy('scarab-1', 1800, GND, {
  speed:     2,
  patrol:    { x1: 1600, x2: 2000 },
  hurtRange: 22,
  surfaceFn: (wx) => surfAt(wx),   // snap to pyramid slopes
});
this.registry.register(scarab);

// In realm update() — check hurt each frame:
if (scarab.hurtCheck(G.px, G.py)) { /* player damaged */ }

// On stomp (player lands on top):
scarab.stun(ts);
```

### Collectibles
`Collectible` auto-collects when the player walks within `interactRange` — no button press needed. Override `draw(sx, sy)` in a subclass to render the item.

```js
import { Collectible } from '../../engine/entity.js';

const scroll = new Collectible('scroll-drop-1', 2100, GND - 30, {
  type:      'invite_scroll',
  value:     1,
  onCollect: (item) => { G.invitesLeft++; log('Found a lost scroll!', 'hi'); },
});
this.registry.register(scroll);
```

### Events (decoupling)
`Events` is a simple pub/sub bus. It's the main tool for keeping layers separate — for example, `engine/flags.js` emits `game:log` instead of importing the UI directly, and `game/pyramids.js` emits `pyramid:layer_added` instead of importing `spawnParts`. Wire cross-system reactions in `main.js`, not inside the individual systems.

### Flags & Quests
`Flags` is a key/value store that fires `flag:change` on every mutation. `QuestManager` holds quest definitions; call `QuestManager.check()` after any state change that might complete a quest. Quests use `condition()` to stay hidden until prerequisites are met.

### Payout Math
The scheme must always balance: `platformFee + Σ(all depth payouts) = entryFee`.  
The payout curve is geometric: `d1Payout × decay^(depth-1)`, truncated at `minPayout`.  
The config editor enforces this constraint before applying changes.

### Z-Layers (depth / parallax)
The desert world has 3 depth layers (0 = foreground, 1 = mid, 2 = far).  
Each layer has its own `parallax` scroll factor, `scale`, `alpha`, and `fog` amount.  
The player can press `↓` to walk in the foreground plane (z=-1), which places them in front of everything.

### PyramidLayout
Every realm that places friend pyramids uses the same pattern: near/mid/far slot arrays indexed round-robin per recruit depth. `PyramidLayout` owns those arrays and counters so realms don't re-implement the bookkeeping. Earth uses `earthLayout` (exported from `game/recruits.js`); a future realm just creates its own:
```js
const myLayout = new PyramidLayout({ near: [...], mid: [...], far: [...] });
const wx = myLayout.nextX(depth);
```

### Sub-recruit scheduling
`scheduleSubRecruitsFor(rec, addFn)` (exported from `game/recruits.js`) contains the trickle-down timing and probability logic for one realm. It accepts any `addFn(name, depth, parent)` so new realms don't duplicate the scheduling math — they just supply their own `addFn`.

---

## Adding a New World

See `worlds/WORLD_TEMPLATE.md` for a step-by-step guide. In short:

1. Create `worlds/<n>/` with `<n>Realm.js` and `constants.js`.
2. Extend `PhysicsRealm` (or `Realm` for fixed-camera scenes) and implement `update(ts)`, `render()`, and `onKeyDown(key)`.
3. Register it in `main.js`: `RealmManager.register(new YourRealm())`.
4. Transition to it via `RealmManager.scheduleTransition('your-realm-id', { ... })`.
5. Create a `PyramidLayout` for your slot arrays if the realm has friend pyramids.

---

## Future Plans

- **Proper frontend/backend split** — move game state to a server, enable persistent sessions and real multiplayer recruitment chains.
- Leaderboard / live recruit feed.
- The passage beyond the sphinx — a second oasis, deeper desert, or stranger realm.
- Sound effects and music.
- Mobile touch controls.

---

## File Naming Conventions

| Pattern | Meaning |
|---------|---------|
| `*.js~` or `#*.js#` | Editor backup files — safe to delete |
| `.DS_Store` | macOS metadata — safe to delete |
| `WORLD_TEMPLATE.md` | Developer reference doc, not shipped |
| `CHANGES.md` | Running changelog |
