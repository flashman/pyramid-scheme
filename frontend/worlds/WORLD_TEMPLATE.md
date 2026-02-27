# Adding a New World / Realm

Each world lives in its own folder under `worlds/`.
Copy this checklist when adding e.g. `worlds/underworld/`.

---

## 1. Create `worlds/my-world/constants.js`

Define layout constants for this world: floor Y, NPC X positions, world width, etc.

```js
// worlds/underworld/constants.js
export const UNDERWORLD_FLOOR = 460;
export const FERRYMAN_X       = 540;
export const UNDERWORLD_W     = 1600;
```

---

## 2. Create `worlds/my-world/terrain.js` (if the world has non-flat terrain)

If your world has platforms, slopes, or any surface other than a flat floor, put the
geometry queries here. Each world owns its own terrain model — there is no shared terrain.

```js
// worlds/underworld/terrain.js
import { G }                from '../../game/state.js';
import { UNDERWORLD_FLOOR } from './constants.js';
import { LH }               from '../constants.js';

export function surfAt(wx) {
  // Query your world's platforms/terrain at wx.
  // Return the highest surface Y (lowest numeric value).
  let sy = UNDERWORLD_FLOOR;
  for (const plat of G.platforms) {
    if (wx >= plat.x && wx <= plat.x + plat.w) sy = Math.min(sy, plat.y);
  }
  return sy;
}

export function canStep(feetY, toWX) {
  const s = surfAt(toWX);
  return (feetY - s) <= LH + 1;   // can walk up at most one step height
}
```

For a **flat-floor world** you can skip this file entirely — `PhysicsRealm` already provides
flat-floor defaults via `surfaceAt()` and `canStepTo()`.

---

## 3. Create `worlds/my-world/draw/my-world.js`

All drawing functions for this world. Export a master `drawMyWorld()` function
called from `MyWorldRealm.render()`.

---

## 4. Create `worlds/my-world/MyWorldRealm.js`

### Flat-floor world (no terrain file needed)

Extend `PhysicsRealm` and use its defaults:

```js
import { PhysicsRealm, RealmManager } from '../../engine/realm.js';
import { UNDERWORLD_W, UNDERWORLD_FLOOR } from './constants.js';
import { SPEED, SPDHALF } from '../constants.js';

export class UnderworldRealm extends PhysicsRealm {
  constructor() {
    super('underworld', 'THE UNDERWORLD', {
      gravity:      0.3,               // lighter gravity
      worldW:       UNDERWORLD_W,
      floor:        UNDERWORLD_FLOOR,
      maxFallSpeed: 10,
    });
    this.registry = new InteractableRegistry();
    // register NPCs, portals, etc.
  }

  // surfaceAt() and canStepTo() use the flat-floor defaults from PhysicsRealm.
  // Override them here if you add platforms later.

  onEnter(fromId) { /* shake, log, set player position */ }
  onExit()        {}

  update(ts) {
    if (RealmManager.isTransitioning) return;
    let dx = 0;
    if (G.keys['ArrowLeft']  || G.keys['a']) { dx = -SPEED; G.facing = -1; }
    if (G.keys['ArrowRight'] || G.keys['d']) { dx =  SPEED; G.facing =  1; }
    if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);

    const surf   = this.surfaceAt(G.px);          // flat floor by default
    const result = this._gravityStep(G.py, G.pvy, surf);
    G.py  = result.py;
    G.pvy = result.pvy;

    G.camX = this._trackCameraX(G.camX, G.px);
    this.registry.update(G.px, G.py - 24);
  }

  render() {
    drawUnderworld();
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (key === 'ArrowUp') { RealmManager.transitionTo('world'); return true; }
    if (key === ' ')       { return this.registry.interact(); }
    return false;
  }
}
```

### World with non-flat terrain

Override `surfaceAt()` and `canStepTo()` using your terrain module:

```js
import { surfAt, canStep } from './terrain.js';

export class UnderworldRealm extends PhysicsRealm {
  // … constructor same as above …

  surfaceAt(x)        { return surfAt(x); }
  canStepTo(feetY, x) { return canStep(feetY, x); }

  update(ts) {
    // … horizontal movement, then …
    if (dx !== 0) {
      const edgeX = G.px + dx + (dx > 0 ? SPDHALF : -SPDHALF);
      if (this.canStepTo(G.py, edgeX)) G.px = this._clampX(G.px + dx, SPDHALF);
      const ns = this.surfaceAt(G.px);
      if (ns < G.py) { G.py = ns; G.pvy = 0; }   // snap up slopes
    }
    const surf   = this.surfaceAt(G.px);
    const result = this._gravityStep(G.py, G.pvy, surf);
    G.py  = result.py;
    G.pvy = result.pvy;
    // …
  }
}
```

---

## 5. Register in `main.js`

```js
import { UnderworldRealm } from './worlds/underworld/UnderworldRealm.js';
// …
RealmManager.register(new UnderworldRealm());
```

---

## 6. Wire a transition

From any existing realm, trigger the switch in an NPC dialogue or key press:

```js
// Immediate (no animation):
RealmManager.transitionTo('underworld');

// With overlay animation:
RealmManager.scheduleTransition('underworld', {
  duration: 1500,
  render: (progress) => { /* draw overlay at 0..1 */ },
});
```

Input is automatically blocked during scheduled transitions.
Check `RealmManager.isTransitioning` in `update()` and `onKeyDown()` to be safe.

---

## 7. (Optional) Pyramid placement via PyramidLayout

If your world has friend pyramids, create a layout instance in `game/recruits.js`
alongside `earthLayout`:

```js
export const underworldLayout = new PyramidLayout({
  near: [300, 500, 700],
  mid:  [400, 650],
  far:  [200, 550, 800],
});
```

Then write an `addUnderworldRecruit(name, depth, parent)` function and pass it to
`scheduleSubRecruitsFor(rec, addUnderworldRecruit)`.

---

## Physics notes

- Gravity, world width, floor, and terminal velocity are all constructor parameters —
  no code changes needed to make a lighter/heavier or wider world.
- `_gravityStep(py, pvy, surfY)`, `_clampX(x, margin)`, and `_trackCameraX(camX, px)`
  are helpers inherited from `PhysicsRealm`. Use them directly in `update()`.
- `surfaceAt(x)` and `canStepTo(feetY, x)` are virtual methods on `PhysicsRealm`.
  Override both for complex terrain; override neither for a flat world.
- `drawPharaoh()` reads from `G` automatically — no parameters needed.
- Visual side-effects of `addLayer()` (particles, shake) are handled by `main.js`
  via the `pyramid:layer_added` event. Your world's terrain file stays draw-free.
