# Adding a New World / Realm

Each world lives in its own folder under `worlds/`.
Copy this checklist when adding e.g. `worlds/underworld/`.

---

## 1. Create `worlds/my-world/constants.js`

```js
// worlds/underworld/constants.js
export const UNDERWORLD_FLOOR = 460;
export const FERRYMAN_X       = 540;
export const UNDERWORLD_W     = 1600;
```

---

## 2. Create `worlds/my-world/terrain.js` (if the world has non-flat terrain)

If your world has platforms or slopes, put geometry queries here.
For a **flat-floor world** skip this file — `PhysicsRealm` provides flat defaults.

```js
// worlds/underworld/terrain.js
import { G }                from '../../game/state.js';
import { UNDERWORLD_FLOOR } from './constants.js';
import { LH }               from '../constants.js';

export function surfAt(wx) {
  let sy = UNDERWORLD_FLOOR;
  for (const plat of G.platforms) {
    if (wx >= plat.x && wx <= plat.x + plat.w) sy = Math.min(sy, plat.y);
  }
  return sy;
}

export function canStep(feetY, toWX) {
  return (feetY - surfAt(toWX)) <= LH + 1;
}
```

---

## 3. Create `worlds/my-world/draw/my-world.js`

Use `drawRealmPharaoh(realm)` — no realm-specific pharaoh variant needed.

```js
import { drawRealmPharaoh } from '../../../draw/pharaoh.js';

export function drawUnderworld(realm) {
  // … draw background, terrain, NPCs …
  drawRealmPharaoh(realm);     // reads realm.getPlayerPose() automatically
  DialogueManager.render();
}
```

---

## 4. Create `worlds/my-world/MyWorldRealm.js`

### Scrolling world (most common — flat or with terrain)

```js
import { PhysicsRealm, RealmManager }   from '../../engine/realm.js';
import { InteractableRegistry }          from '../../engine/interactables.js';
import { TriggerZone, TriggerRegistry }  from '../../engine/trigger.js';
import { DialogueManager }               from '../../engine/dialogue.js';
import { G }                             from '../../game/state.js';
import { inputDx, SPEED, SPDHALF }       from '../constants.js';
import { UNDERWORLD_W, UNDERWORLD_FLOOR } from './constants.js';
import { drawUnderworld }                from './draw/underworld.js';

export class UnderworldRealm extends PhysicsRealm {
  constructor() {
    super('underworld', 'THE UNDERWORLD', {
      gravity: 0.3, worldW: UNDERWORLD_W, floor: UNDERWORLD_FLOOR, maxFallSpeed: 10,
    });
    this.registry = new InteractableRegistry();

    this.triggers = new TriggerRegistry();
    this.triggers.add(new TriggerZone('exit-gate', {
      x1: 40, x2: 140,
      hint: '[↑] RETURN TO WORLD',
      onEnter: () => log('The way back glows.', ''),
    }));
  }

  // Required: provide player pose for drawRealmPharaoh()
  getPlayerPose() {
    return { px: G.px, py: G.py, camX: G.camX, pZ: 0, facing: G.facing, frame: G.pframe };
  }

  onEnter(fromId) { G.px = 100; G.py = UNDERWORLD_FLOOR; G.pvy = 0; G.camX = 0; G.shake = 6; }
  onExit()        { G.shake = 4; }

  update(ts) {
    if (RealmManager.isTransitioning || DialogueManager.isActive()) return;

    const dx = inputDx(SPEED);   // reads keys, sets G.facing + G.pmoving
    if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);

    const surf = this.surfaceAt(G.px);
    const r = this._gravityStep(G.py, G.pvy, surf);
    G.py = r.py; G.pvy = r.pvy;

    if (G.pmoving && ts - G.legT > 120) { G.legT = ts; G.pframe = 1 - G.pframe; }
    else if (!G.pmoving) G.pframe = 0;

    G.camX = this._trackCameraX(G.camX, G.px);
    this.registry.updateEntities(ts);
    G.nearEntity = this.registry.update(G.px, G.py - 24);
    this.triggers.update(G.px);
  }

  render() {
    drawUnderworld(this);
    this.triggers.renderHints(G.camX);
  }

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (key === 'ArrowUp' && this.triggers.isInside('exit-gate')) {
      RealmManager.transitionTo('world'); return true;
    }
    if (key === ' ') return this.registry.interact();
    return false;
  }
}
```

For **non-flat terrain**, add:
```js
import { surfAt, canStep } from './terrain.js';
// in class:
surfaceAt(x)        { return surfAt(x); }
canStepTo(feetY, x) { return canStep(feetY, x); }
// in update(), replace simple clamp with:
if (dx !== 0) {
  const edgeX = G.px + dx + (dx > 0 ? SPDHALF : -SPDHALF);
  if (this.canStepTo(G.py, edgeX)) G.px = this._clampX(G.px + dx, SPDHALF);
  const ns = this.surfaceAt(G.px);
  if (ns < G.py) { G.py = ns; G.pvy = 0; }
}
```

### Fixed-camera world (chamber / council style)

Extend `FlatRealm` — it provides `_walkStep(ts)`, `getPlayerPose()`, and G-sync for free:

```js
import { FlatRealm }    from '../FlatRealm.js';
import { RealmManager } from '../../engine/realm.js';

export class ThroneRealm extends FlatRealm {
  constructor() {
    super('throne', 'THE THRONE ROOM', { floor: 440, minX: 40, maxX: 740 });
    this.registry = new InteractableRegistry();
  }
  onEnter(fromId) { this.px = 120; this.facing = 1; G.shake = 6; }
  update(ts) {
    if (DialogueManager.isActive()) return;
    this._walkStep(ts);   // handles keys + G-sync in one call
    this.registry.update(this.px, this.floor);
  }
  render() {
    drawThroneRoom(this);      // drawRealmPharaoh(realm) inside
    DialogueManager.render();
  }
  onKeyDown(key) {
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (key === 'ArrowUp') { RealmManager.transitionTo('world'); return true; }
    if (key === ' ') return this.registry.interact();
    return false;
  }
}
```

---

## 5. Register in `worlds/manifest.js`

```js
// worlds/manifest.js
import { UnderworldRealm } from './underworld/UnderworldRealm.js';

export const ALL_REALMS = [
  // ... existing realms ...
  new UnderworldRealm(),   // ← add here; main.js never changes
];
```

**Do not edit `main.js`** — it imports `ALL_REALMS` from the manifest and registers everything automatically.

---

## 6. Wire portal transitions

Portals (realm-to-realm transitions) are registered in the realm's **constructor** using `PortalRegistry`. This keeps the graph edge list colocated with the realm that owns the exit.

```js
import { PortalRegistry } from '../../engine/portal.js';

constructor() {
  super('underworld', …);

  // Outgoing portals — registered here so conditions can close over `this`.
  PortalRegistry.register({
    from: 'underworld', to: 'world',
    key: 'ArrowUp',
    condition:  () => this.px < 100,         // optional: return-gate proximity
    onUse:      () => { G.shake = 4; },       // optional: side-effects before swap
    transition: myTransRender,               // optional: null = instant swap
    duration:   1200,                        // ms (ignored when transition = null)
  });
}
```

Then in `onKeyDown()`, replace any hardcoded `scheduleTransition()` call with:

```js
onKeyDown(key) {
  if (RealmManager.isTransitioning) return false;
  if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
  // Optionally normalise WASD → arrow keys for swimming realms:
  // const k = { w: 'ArrowUp', W: 'ArrowUp', s: 'ArrowDown', S: 'ArrowDown' }[key] ?? key;
  if (PortalRegistry.handleKey(key, 'underworld', this.triggers)) return true;
  if (key === ' ') return this.registry.interact();
  return false;
}
```

**Adding a portal from an existing realm to your new realm** does not require editing the existing realm. Register the portal in your new realm's constructor with `from: 'existing-realm'` — `PortalRegistry.handleKey()` is already called inside that realm's `onKeyDown()` and will pick up the new portal automatically.

---

## 7. Add enemies (optional)

```js
import { Enemy } from '../../engine/entity.js';

const scarab = new Enemy('scarab-1', 1800, GND, {
  speed: 2, patrol: { x1: 1600, x2: 2000 },
  hurtRange: 22,
  surfaceFn: (wx) => surfAt(wx),  // snap to terrain
});
this.registry.register(scarab);

// In update() after registry.updateEntities(ts):
if (scarab.hurtCheck(G.px, G.py)) { G.shake = 8; /* player hurt */ }
scarab.stun(ts);  // on stomp
```

---

## 8. Add collectibles (optional)

Auto-collected on proximity — no button press needed:

```js
import { Collectible } from '../../engine/entity.js';

const scroll = new Collectible('scroll-1', 2100, GND - 30, {
  type: 'invite_scroll', value: 1,
  onCollect: (item) => { G.invitesLeft++; log('Found a lost scroll!', 'hi'); },
});
this.registry.register(scroll);
// Override draw(sx, sy) in a subclass to render the item visually.
```

---

## 9. Pyramid placement (optional)

```js
// in game/recruits.js alongside earthLayout:
export const underworldLayout = new PyramidLayout({
  near: [300, 500, 700],
  mid:  [400, 650],
  far:  [200, 550, 800],
});
// Write addUnderworldRecruit(name, depth, parent) and pass to
// scheduleSubRecruitsFor(rec, addUnderworldRecruit).
```

---

## Physics / rendering cheatsheet

| Task | How |
|---|---|
| Movement input | `inputDx(baseSpeed)` from `worlds/constants.js` |
| Gravity | `this._gravityStep(py, pvy, surfY)` → `{ py, pvy }` |
| Camera follow | `this._trackCameraX(camX, px)` |
| World clamp | `this._clampX(x, margin)` |
| Draw player | `drawRealmPharaoh(realm)` (reads `realm.getPlayerPose()`) |
| Player pose | Override `getPlayerPose()` → `{ px, py, camX, pZ, facing, frame }` |
| Gate/door hint | `TriggerZone` + `TriggerRegistry` |
| Patrol enemy | `new Enemy(id, x, y, { patrol, speed, hurtRange, surfaceFn })` |
| Auto-pickup | `new Collectible(id, x, y, { type, value, onCollect })` |
| Particles | Write to `G.particles[]`; `drawParts()` handles them |
