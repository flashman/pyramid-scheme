# Mario Physics Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the heightfield physics in the three side-scrolling realms (Desert, Nile, Oasis) with a Mario-style engine: velocity-driven kinematics (momentum, skid, variable-height jump, asymmetric gravity) and solid-list AABB collision (walls, ceilings, bonkable blocks, one-way + moving platforms, directional body-vs-body contact).

**Architecture:** Two new pure, DOM-free engine modules — `engine/kinematics.js` (velocity math over a `TUNING` object) and `engine/physics2d.js` (Body / SolidSet / per-axis `resolveMove`) — consumed by a new `SolidRealm` base class that replaces `PhysicsRealm`. Realms supply geometry as static rects plus *providers* (functions returning rects each frame), which is how runtime-growing pyramids and moving croc-backs stay in sync. Faithful conversion: realms play exactly as today; new capabilities ship tested but unplaced.

**Tech Stack:** Vanilla JS ES modules (no bundler, no npm install). Tests: node built-in test runner (`node --test`) + `node:assert`. Spec: `docs/superpowers/specs/2026-07-09-mario-physics-engine-design.md`.

## Global Constraints

- Branch: all work on `feat/mario-physics`.
- No bundler, no npm dependencies. `frontend/package.json` may contain ONLY `{"type": "module", "private": true}` (marks ESM for node tests; Dockerfile's explicit COPY list means it never ships).
- `engine/kinematics.js` and `engine/physics2d.js` must import NOTHING (pure modules) — they are the node-testable core. `engine/canvas.js` touches the DOM at import time; never import it (directly or transitively) from these two files or their tests.
- Faithful conversion: no behavior change beyond the new movement feel. All portals, triggers, quest flags, z-layer descent, croc bites, pool wading, and the Nile current must work as today.
- Player body: `w: 20, h: 34`, anchored feet-center (`G.px` = center x, `G.py` = feet y) — matches every draw file's convention.
- Jump key is `z`/`Z` (both — `G.keys` stores raw `e.key`, so Shift turns `z` into `Z`). Shift = run. Arrows steer. No WASD.
- Frontend JS changes require a docker rebuild to see in-game (Stop hook does this automatically).
- Run `node --check <file>` on every modified DOM-coupled JS file before committing.
- Frame-based physics (no dt scaling), matching the existing engine.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `frontend/package.json` | Create | `{"type":"module"}` so node runs frontend files as ESM |
| `frontend/engine/kinematics.js` | Create | TUNING + stepRun/stepFall/jumpVelocity (pure) |
| `frontend/engine/physics2d.js` | Create | makeBody, SolidSet, resolveMove, contactDirection, moveSolids (pure) |
| `frontend/engine/solidrealm.js` | Create | SolidRealm base: player body ↔ G bridge, physicsStep, tryJump, camera |
| `frontend/tests/kinematics.test.js` | Create | Node tests for kinematics |
| `frontend/tests/physics2d.test.js` | Create | Node tests for collision core |
| `frontend/game/state.js` | Modify | Add `pvx: 0` |
| `frontend/worlds/earth/WorldRealm.js` | Modify | Migrate to SolidRealm + pyramid provider |
| `frontend/worlds/nile/NileRealm.js` | Modify | Migrate: bank/reed/croc solids, water zone with current |
| `frontend/worlds/oasis/OasisRealm.js` | Modify | Migrate: floor/pool solids, pool tuning zone, G-backed state |
| `frontend/engine/realm.js` | Modify (Task 7) | Delete PhysicsRealm |
| `frontend/worlds/constants.js` | Modify (Task 7) | Delete inputDx if unused |
| `frontend/worlds/WORLD_TEMPLATE.md`, `CLAUDE.md` | Modify (Task 7) | Docs updated to SolidRealm |

---

### Task 1: Kinematics module (TDD)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/engine/kinematics.js`
- Test: `frontend/tests/kinematics.test.js`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (used by Tasks 3–6):
  - `TUNING` — default tunables object (shape below).
  - `stepRun(vx, dir, { grounded, run }, T = TUNING) → number` — one frame of horizontal velocity. `dir` ∈ {-1, 0, 1}.
  - `stepFall(vy, jumpHeld, T = TUNING) → number` — one frame of gravity (asymmetric, hold-modulated, terminal-clamped).
  - `jumpVelocity(vx, T = TUNING) → number` — takeoff vy including the running-jump bonus.

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/tests/kinematics.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNING, stepRun, stepFall, jumpVelocity } from '../engine/kinematics.js';

test('walk accelerates gradually toward walkMax, never past it', () => {
  let vx = 0;
  const first = stepRun(vx, 1, { grounded: true, run: false });
  assert.equal(first, TUNING.walkAccel);           // one accel step, not instant max
  for (let i = 0; i < 200; i++) vx = stepRun(vx, 1, { grounded: true, run: false });
  assert.ok(Math.abs(vx - TUNING.walkMax) < 1e-9);
});

test('run reaches a higher max than walk', () => {
  let vx = 0;
  for (let i = 0; i < 200; i++) vx = stepRun(vx, 1, { grounded: true, run: true });
  assert.ok(Math.abs(vx - TUNING.runMax) < 1e-9);
  assert.ok(TUNING.runMax > TUNING.walkMax);
});

test('releasing input on the ground applies friction until stop', () => {
  let vx = TUNING.walkMax;
  const after1 = stepRun(vx, 0, { grounded: true, run: false });
  assert.equal(after1, TUNING.walkMax - TUNING.friction);   // gradual, not instant
  for (let i = 0; i < 200; i++) vx = stepRun(vx, 0, { grounded: true, run: false });
  assert.equal(vx, 0);
});

test('reversing at speed skids: decelerates faster than friction, does not snap', () => {
  const vx = TUNING.runMax;
  const after = stepRun(vx, -1, { grounded: true, run: true });
  assert.ok(after < vx);                     // slowing
  assert.ok(after > 0);                      // still moving the old way (skid, not snap)
  assert.ok(vx - after > TUNING.friction);   // faster than plain friction
});

test('air: no input conserves momentum exactly', () => {
  assert.equal(stepRun(4, 0, { grounded: false, run: false }), 4);
});

test('air steering uses airAccel', () => {
  const after = stepRun(0, 1, { grounded: false, run: false });
  assert.equal(after, TUNING.airAccel);
});

test('holding jump rises with less gravity than releasing', () => {
  const held     = stepFall(-9, true);
  const released = stepFall(-9, false);
  assert.ok(held < released);                // less decel while held
});

test('falling gravity applies below terminal velocity, then clamps', () => {
  assert.equal(stepFall(2, false), 2 + TUNING.gravityFall);
  assert.equal(stepFall(TUNING.maxFall, false), TUNING.maxFall);
});

test('held jump reaches a much higher apex than a tap', () => {
  const apex = (held) => {
    let vy = jumpVelocity(0), y = 0;
    while (vy < 0) { vy = stepFall(vy, held); y += vy; }
    return -y;
  };
  const big = apex(true), small = apex(false);
  assert.ok(big > small * 1.6, `held ${big} vs tap ${small}`);
  assert.ok(big > 72, 'held jump must clear the Nile riverbed→bank rise (72px)');
});

test('running jump takes off faster than standing jump', () => {
  assert.ok(jumpVelocity(TUNING.runMax) < jumpVelocity(0));  // more negative
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && node --test tests/kinematics.test.js`
Expected: FAIL — `Cannot find module '../engine/kinematics.js'`

- [ ] **Step 4: Implement `frontend/engine/kinematics.js`**

```js
// ── FILE: engine/kinematics.js ───────────────────────────
// Mario-style velocity math. Pure module: no imports, no DOM, no G —
// node-testable (tests/kinematics.test.js).
//
// All values are px/frame (the game loop is frame-based, not dt-based).
// Realms may pass a modified copy of TUNING for zones (pool wading,
// swimming) — see SolidRealm.physicsStep(opts.tuning).

export const TUNING = {
  // ── Horizontal ──
  walkAccel: 0.35,
  walkMax:   5,      // ≈ old fixed SPEED
  runAccel:  0.5,    // Shift held
  runMax:    9,      // just under the old sprint (SPEED × 2)
  friction:  0.35,   // ground decel when no input
  skidDecel: 0.9,    // ground decel when input opposes motion
  airAccel:  0.25,   // steering strength while airborne (momentum conserved)

  // ── Vertical ──
  jumpVy:          -9,     // matches the old flat jump
  jumpVyPerVx:     -0.25,  // takeoff bonus per px/frame of |vx| (running jumps)
  gravityRiseHeld: 0.38,   // rising with jump held  → high arc (apex ≈ 106px)
  gravityRise:     0.75,   // rising after release   → jump cut (apex ≈ 54px)
  gravityFall:     0.6,    // falling — snappier than the rise
  maxFall:         14,     // terminal velocity (unchanged from PhysicsRealm)
};

/**
 * One frame of horizontal velocity.
 * dir −1|0|1; grounded picks friction vs air rules; run raises the cap.
 */
export function stepRun(vx, dir, { grounded = true, run = false } = {}, T = TUNING) {
  const max = run ? T.runMax : T.walkMax;
  if (dir !== 0) {
    const accel = !grounded                            ? T.airAccel
                : (vx !== 0 && Math.sign(vx) !== dir)  ? T.skidDecel
                : (run ? T.runAccel : T.walkAccel);
    vx += dir * accel;
    if (Math.sign(vx) === dir && Math.abs(vx) > max) {
      // Over the cap (e.g. run released mid-stride): bleed down, don't snap.
      vx = grounded
        ? Math.sign(vx) * Math.max(max, Math.abs(vx) - T.friction)
        : Math.sign(vx) * max;
    }
  } else if (grounded) {
    vx = Math.sign(vx) * Math.max(0, Math.abs(vx) - T.friction);
  }
  // airborne + no input: momentum conserved
  return vx;
}

/** One frame of gravity — asymmetric, jump-hold modulated, terminal-clamped. */
export function stepFall(vy, jumpHeld, T = TUNING) {
  const g = vy < 0 ? (jumpHeld ? T.gravityRiseHeld : T.gravityRise) : T.gravityFall;
  return Math.min(vy + g, T.maxFall);
}

/** Takeoff velocity: base jump plus a bonus scaled by ground speed. */
export function jumpVelocity(vx, T = TUNING) {
  return T.jumpVy + T.jumpVyPerVx * Math.abs(vx);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && node --test tests/kinematics.test.js`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/engine/kinematics.js frontend/tests/kinematics.test.js
git commit -m "feat: Mario kinematics module (momentum, skid, variable jump)"
```

---

### Task 2: physics2d collision core (TDD)

**Files:**
- Create: `frontend/engine/physics2d.js`
- Test: `frontend/tests/physics2d.test.js`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (used by Tasks 3–6):
  - `makeBody({ x, y, w = 20, h = 34 }) → body` — `{ x, y, w, h, vx, vy, grounded, headBonk, wallLeft, wallRight }`, feet-center anchored (rect spans `[x−w/2, x+w/2] × [y−h, y]`).
  - `class SolidSet` — `addStatic(rects)`, `addProvider(fn)`, `rebuild()`, `all()`. Solids are `{ x, y, w, h, oneWay?, vx?, vy?, onBonk? }` with `y` = TOP of the rect.
  - `resolveMove(body, solids, { maxStepUp = 0, externalVx = 0 })` — per-axis resolution; mutates body; fires `solid.onBonk(body)` on ceiling hits.
  - `contactDirection(a, b) → 'top'|'bottom'|'left'|'right'|null` — body-vs-body contact classification (the stomp primitive; `'top'` = a rests on b).
  - `moveSolids(solids, body = null) → boolean` — advances solids by their vx/vy, carries a grounded rider, pushes on horizontal contact; returns true if the push left the body crushed (squish).

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/physics2d.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBody, SolidSet, resolveMove, contactDirection, moveSolids } from '../engine/physics2d.js';

const GROUND = { x: 0, y: 100, w: 1000, h: 50 };   // floor top at y=100

test('falls under gravity and lands on a floor solid', () => {
  const b = makeBody({ x: 50, y: 90 });
  b.vy = 20;
  resolveMove(b, [GROUND]);
  assert.equal(b.y, 100);
  assert.equal(b.vy, 0);
  assert.equal(b.grounded, true);
});

test('walking off a ledge clears grounded', () => {
  const ledge = { x: 0, y: 100, w: 40, h: 50 };
  const b = makeBody({ x: 30, y: 100 });
  b.vx = 25; b.vy = 1;
  resolveMove(b, [ledge]);
  assert.equal(b.grounded, false);
});

test('wall stops horizontal motion, zeroes vx, sets wallRight', () => {
  const wall = { x: 100, y: 0, w: 50, h: 200 };
  const b = makeBody({ x: 70, y: 100 });
  b.vx = 30;
  resolveMove(b, [GROUND, wall]);
  assert.equal(b.x, 100 - b.w / 2);
  assert.equal(b.vx, 0);
  assert.equal(b.wallRight, true);
});

test('step-up: a rise within maxStepUp is climbed while walking', () => {
  const step = { x: 100, y: 78, w: 100, h: 72 };   // 22px above the floor
  const b = makeBody({ x: 80, y: 100 });
  b.vx = 15;
  resolveMove(b, [GROUND, step], { maxStepUp: 23 });
  assert.equal(b.y, 78);
  assert.ok(b.x > 100 - b.w / 2);                  // walked onto it, not blocked
});

test('step-up refused when the rise exceeds maxStepUp', () => {
  const step = { x: 100, y: 60, w: 100, h: 90 };   // 40px rise
  const b = makeBody({ x: 80, y: 100 });
  b.vx = 15;
  resolveMove(b, [GROUND, step], { maxStepUp: 23 });
  assert.equal(b.x, 100 - b.w / 2);
  assert.equal(b.wallRight, true);
});

test('step-up refused when there is no headroom above the step', () => {
  const step = { x: 100, y: 90, w: 100, h: 60 };            // 10px rise — fits maxStepUp
  const lid  = { x: 100, y: 40, w: 100, h: 30 };            // ceiling 20px above step top
  const b = makeBody({ x: 80, y: 100 });                    // body is 34 tall — no room
  b.vx = 15;
  resolveMove(b, [GROUND, step, lid], { maxStepUp: 23 });
  assert.equal(b.x, 100 - b.w / 2);                         // blocked instead
});

test('one-way platform: passes through from below, lands from above', () => {
  const reed = { x: 40, y: 60, w: 40, h: 6, oneWay: true };
  const up = makeBody({ x: 60, y: 100 });
  up.vy = -50;                                     // jumping up through it (100 → 50)
  resolveMove(up, [GROUND, reed]);
  assert.equal(up.headBonk, false);
  assert.ok(up.y < 60);                            // passed through
  const down = makeBody({ x: 60, y: 50 });
  down.vy = 20;                                    // falling onto it
  resolveMove(down, [GROUND, reed]);
  assert.equal(down.y, 60);
  assert.equal(down.grounded, true);
});

test('ceiling: rising into a solid clamps, zeroes vy, sets headBonk, fires onBonk', () => {
  let bonked = null;
  const block = { x: 40, y: 20, w: 40, h: 20, onBonk: (b) => { bonked = b; } };
  const b = makeBody({ x: 60, y: 100 });
  b.vy = -80;                                      // head would pass block bottom (y=40)
  resolveMove(b, [GROUND, block]);
  assert.equal(b.y, 40 + b.h);                     // head clamped to block bottom
  assert.equal(b.vy, 0);
  assert.equal(b.headBonk, true);
  assert.equal(bonked, b);
});

test('externalVx (current) moves the body but respects walls and does not alter vx', () => {
  const wall = { x: 0, y: 0, w: 20, h: 200 };
  const b = makeBody({ x: 45, y: 100 });
  b.vx = 0;
  resolveMove(b, [GROUND, wall], { externalVx: -60 });
  assert.equal(b.x, 20 + b.w / 2);                 // swept into the wall, clamped
  assert.equal(b.vx, 0);
});

test('depenetration: geometry grown around the body lifts it to the surface', () => {
  const grown = { x: 0, y: 80, w: 200, h: 70 };    // new pyramid layer under our feet
  const b = makeBody({ x: 50, y: 100 });           // feet now inside it
  resolveMove(b, [grown]);
  assert.equal(b.y, 80);
});

test('SolidSet: providers are re-evaluated on rebuild', () => {
  const set = new SolidSet();
  set.addStatic([GROUND]);
  let wx = 100;
  set.addProvider(() => [{ x: wx, y: 90, w: 40, h: 10, oneWay: true }]);
  set.rebuild();
  assert.equal(set.all().length, 2);
  assert.equal(set.all()[1].x, 100);
  wx = 300;
  set.rebuild();
  assert.equal(set.all()[1].x, 300);
});

test('contactDirection classifies all four sides and non-overlap', () => {
  const b = makeBody({ x: 100, y: 100, w: 20, h: 20 });
  assert.equal(contactDirection(makeBody({ x: 100, y: 84,  w: 20, h: 20 }), b), 'top');
  assert.equal(contactDirection(makeBody({ x: 100, y: 116, w: 20, h: 20 }), b), 'bottom');
  assert.equal(contactDirection(makeBody({ x: 84,  y: 100, w: 20, h: 20 }), b), 'left');
  assert.equal(contactDirection(makeBody({ x: 116, y: 100, w: 20, h: 20 }), b), 'right');
  assert.equal(contactDirection(makeBody({ x: 500, y: 500, w: 20, h: 20 }), b), null);
});

test('moveSolids carries a grounded rider by the platform delta', () => {
  const plat = { x: 40, y: 60, w: 40, h: 10, vx: 3, vy: 0 };
  const b = makeBody({ x: 60, y: 60 });
  b.grounded = true;
  moveSolids([plat], b);
  assert.equal(plat.x, 43);
  assert.equal(b.x, 63);
});

test('moveSolids pushes a body it moves into; squish reported against a wall', () => {
  const pusher = { x: 0, y: 0, w: 50, h: 200, vx: 10, vy: 0 };
  const b = makeBody({ x: 65, y: 100 });           // clear of pusher (right edge 50 vs body left edge 55)
  const free = moveSolids([pusher], b);            // pusher → 10..60, overlaps body → push
  assert.equal(b.x, 60 + b.w / 2);                 // shoved to the pusher's new right edge (70)
  assert.equal(free, false);                       // not squished — nothing behind
  const wall = { x: 85, y: 0, w: 20, h: 200 };
  const squished = moveSolids([pusher, wall], b);  // pusher → 20..70, push to 80 → body overlaps wall
  assert.equal(squished, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && node --test tests/physics2d.test.js`
Expected: FAIL — `Cannot find module '../engine/physics2d.js'`

- [ ] **Step 3: Implement `frontend/engine/physics2d.js`**

```js
// ── FILE: engine/physics2d.js ────────────────────────────
// Solid-list AABB collision core. Pure module: no imports, no DOM, no G —
// node-testable (tests/physics2d.test.js).
//
// Conventions:
//   • Body is feet-center anchored: rect spans [x−w/2, x+w/2] × [y−h, y].
//   • Solid { x, y, w, h } has y = TOP of the rect.
//   • oneWay solids catch a body falling onto their top; never walls/ceilings.
//   • Realms own a SolidSet: static rects + providers (functions returning
//     rects), rebuilt each frame — this is how runtime-grown pyramids and
//     moving croc-backs stay in sync without special-cased physics.

export function makeBody({ x = 0, y = 0, w = 20, h = 34 } = {}) {
  return { x, y, w, h, vx: 0, vy: 0,
           grounded: false, headBonk: false, wallLeft: false, wallRight: false };
}

export class SolidSet {
  constructor()      { this._static = []; this._providers = []; this._all = []; }
  addStatic(rects)   { this._static.push(...rects); return this; }
  addProvider(fn)    { this._providers.push(fn); return this; }
  rebuild()          {
    this._all = [...this._static];
    for (const fn of this._providers) this._all.push(...fn());
    return this._all;
  }
  all()              { return this._all; }
}

/** True if a body of size w×h placed at feet-center (x, y) overlaps no solid. */
function bodyFits(x, y, w, h, solids) {
  const hw = w / 2;
  for (const s of solids) {
    if (s.oneWay) continue;
    if (x + hw > s.x && x - hw < s.x + s.w && y > s.y && y - h < s.y + s.h) return false;
  }
  return true;
}

/**
 * One frame of movement, resolved per axis. Mutates body.
 *   maxStepUp  – auto-climb rises up to this many px while walking (stairs)
 *   externalVx – additive world drift (Nile current): moves the body and is
 *                wall-checked, but never stored into body.vx.
 */
export function resolveMove(body, solids, { maxStepUp = 0, externalVx = 0 } = {}) {
  const hw = body.w / 2;
  body.headBonk = false; body.wallLeft = false; body.wallRight = false;

  // ── Depenetrate: geometry may have grown around us (pyramid layer added) ──
  for (const s of solids) {
    if (s.oneWay) continue;
    if (body.x + hw > s.x && body.x - hw < s.x + s.w &&
        body.y > s.y && body.y - body.h < s.y + s.h) {
      body.y = s.y;                       // stand on the solid that swallowed us
    }
  }

  // ── Horizontal ─────────────────────────────────────────
  const dx = body.vx + externalVx;
  let nx = body.x + dx;
  if (dx !== 0) {
    for (const s of solids) {
      if (s.oneWay) continue;
      // Wall band: solid must overlap the body's interior (feet−1 keeps the
      // tile we stand on from reading as a wall).
      if (!(body.y - 1 > s.y && body.y - body.h + 1 < s.y + s.h)) continue;
      if (dx > 0 && body.x + hw <= s.x && nx + hw > s.x) {
        const rise = body.y - s.y;
        if (rise > 0 && rise <= maxStepUp && bodyFits(nx, s.y, body.w, body.h, solids)) {
          body.y = s.y;                   // auto step-up (pyramid stairs)
          continue;
        }
        nx = s.x - hw; body.vx = 0; body.wallRight = true;
      } else if (dx < 0 && body.x - hw >= s.x + s.w && nx - hw < s.x + s.w) {
        const rise = body.y - s.y;
        if (rise > 0 && rise <= maxStepUp && bodyFits(nx, s.y, body.w, body.h, solids)) {
          body.y = s.y;
          continue;
        }
        nx = s.x + s.w + hw; body.vx = 0; body.wallLeft = true;
      }
    }
  }

  // ── Vertical ───────────────────────────────────────────
  const wasY = body.y;
  let ny = body.y + body.vy;
  if (body.vy >= 0) {
    // Falling / standing: land on the highest top we were above before the move.
    let landY = Infinity;
    for (const s of solids) {
      if (!(nx + hw > s.x && nx - hw < s.x + s.w)) continue;
      if (wasY <= s.y + 1 && ny >= s.y && s.y < landY) landY = s.y;
    }
    if (landY < Infinity) { ny = landY; body.vy = 0; body.grounded = true; }
    else body.grounded = false;
  } else {
    // Rising: clamp the head against the lowest solid bottom we cross.
    let ceilY = -Infinity, hit = null;
    for (const s of solids) {
      if (s.oneWay) continue;
      if (!(nx + hw > s.x && nx - hw < s.x + s.w)) continue;
      const bottom = s.y + s.h;
      if (wasY - body.h >= bottom && ny - body.h < bottom && bottom > ceilY) {
        ceilY = bottom; hit = s;
      }
    }
    if (hit) { ny = ceilY + body.h; body.vy = 0; body.headBonk = true; hit.onBonk?.(body); }
    body.grounded = false;
  }

  body.x = nx; body.y = ny;
  return body;
}

/**
 * Body-vs-body contact classification — the stomp primitive.
 * Returns the side of b that a is touching: 'top' means a rests on b
 * (a falling with vy > 0 + 'top' = stomp; 'left'/'right'/'bottom' = hurt).
 */
export function contactDirection(a, b) {
  const ax1 = a.x - a.w / 2, ax2 = a.x + a.w / 2, ay1 = a.y - a.h, ay2 = a.y;
  const bx1 = b.x - b.w / 2, bx2 = b.x + b.w / 2, by1 = b.y - b.h, by2 = b.y;
  if (ax1 >= bx2 || ax2 <= bx1 || ay1 >= by2 || ay2 <= by1) return null;
  const dx = Math.min(ax2 - bx1, bx2 - ax1);
  const dy = Math.min(ay2 - by1, by2 - ay1);
  if (dy <= dx) return (ay2 + ay1) < (by2 + by1) ? 'top' : 'bottom';
  return (ax2 + ax1) < (bx2 + bx1) ? 'left' : 'right';
}

/**
 * Advance moving solids by their (vx, vy). A grounded body standing on a
 * moving solid is carried by its delta; a solid moving into the body pushes
 * it. Returns true if a push left the body overlapping another solid (squish
 * — the caller decides what that means).
 */
export function moveSolids(solids, body = null) {
  let squished = false;
  for (const s of solids) {
    const svx = s.vx || 0, svy = s.vy || 0;
    if (!svx && !svy) continue;
    const hw = body ? body.w / 2 : 0;
    const riding = body && body.grounded &&
      body.x + hw > s.x && body.x - hw < s.x + s.w && Math.abs(body.y - s.y) <= 1;
    s.x += svx; s.y += svy;
    if (!body) continue;
    if (riding) { body.x += svx; body.y += svy; continue; }
    // Push: solid now overlaps the body → shove along the motion direction.
    if (body.x + hw > s.x && body.x - hw < s.x + s.w &&
        body.y > s.y && body.y - body.h < s.y + s.h) {
      body.x = svx > 0 ? s.x + s.w + hw : s.x - hw;
      if (!bodyFits(body.x, body.y, body.w, body.h, solids.filter(o => o !== s))) squished = true;
    }
  }
  return squished;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && node --test tests/physics2d.test.js`
Expected: all tests PASS. Then run the full suite: `cd frontend && node --test tests/` — all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/engine/physics2d.js frontend/tests/physics2d.test.js
git commit -m "feat: physics2d collision core (solids, step-up, one-way, bonk, contact)"
```

---

### Task 3: SolidRealm base class

**Files:**
- Create: `frontend/engine/solidrealm.js`
- Modify: `frontend/game/state.js` (add `pvx`)

**Interfaces:**
- Consumes: `Realm` from `./realm.js`; `CW` from `./canvas.js`; `G` from `../game/state.js`; `Events` from `./events.js`; `makeBody`, `SolidSet`, `resolveMove` from `./physics2d.js`; `TUNING`, `stepRun`, `stepFall`, `jumpVelocity` from `./kinematics.js`.
- Produces (used by Tasks 4–6):
  - `class SolidRealm extends Realm` — constructor `(id, name, { worldW, maxStepUp = 0, tuning = TUNING })`.
  - `this.solids` — the realm's `SolidSet`; `this.body` — the player body; `this.worldW`.
  - `physicsStep(ts, opts = {}) → body` — one full player frame. `opts`: `tuning` (zone override), `externalVx` (drift), `dir`/`run` (input overrides), `edgeMargin` (world-clamp margin, default `body.w/2`).
  - `tryJump(T = this.tuning) → boolean` — grounded check + takeoff (call from `onKeyDown`).
  - `stepWalkAnim(ts)` — the shared legT/pframe flip.
  - `_trackCameraX(camX, px, lerpK = 0.1) → number` and `_clampX(x, margin) → number` (same math as the old PhysicsRealm).
  - Emits `physics:land` `{ realm, impactVy }` and `physics:bonk` `{ realm }` on the Events bus.

DOM-coupled (imports canvas.js transitively) → no node unit tests; verify with `node --check`.

- [ ] **Step 1: Add `pvx` to `frontend/game/state.js`**

In the player-position block, change:

```js
  // ── Player world-space position & animation ────────────
  px: 2450, py: GND,
  pvy: 0,
```

to:

```js
  // ── Player world-space position & animation ────────────
  px: 2450, py: GND,
  pvx: 0, pvy: 0,
```

- [ ] **Step 2: Create `frontend/engine/solidrealm.js`**

```js
// ── FILE: engine/solidrealm.js ───────────────────────────
// SolidRealm — base class for side-scrolling realms with Mario-style
// physics: solid-list AABB collision (physics2d.js) + velocity-driven
// kinematics (kinematics.js). Replaces the old heightfield PhysicsRealm.
//
// A realm supplies geometry on this.solids (static rects + providers) in
// its constructor, then calls physicsStep(ts) from update() and tryJump()
// from onKeyDown('z'). Zones (pool wading, swimming) pass a modified
// tuning and/or externalVx per frame — they are realm concerns, not
// collision concerns.

import { Realm }   from './realm.js';
import { CW }      from './canvas.js';
import { G }       from '../game/state.js';
import { Events }  from './events.js';
import { makeBody, SolidSet, resolveMove }             from './physics2d.js';
import { TUNING, stepRun, stepFall, jumpVelocity }     from './kinematics.js';

export class SolidRealm extends Realm {
  constructor(id, name, { worldW = 800, maxStepUp = 0, tuning = TUNING } = {}) {
    super(id, name);
    this.worldW    = worldW;
    this.maxStepUp = maxStepUp;
    this.tuning    = tuning;
    this.solids    = new SolidSet();
    this.body      = makeBody({ x: G.px, y: G.py });
  }

  /** Arrow keys → dir, Shift → run, z/Z held → variable-jump hold. */
  readInput() {
    let dir = 0;
    if (G.keys['ArrowLeft'])  dir = -1;
    if (G.keys['ArrowRight']) dir =  1;
    return { dir, run: !!G.keys['Shift'], jumpHeld: !!(G.keys['z'] || G.keys['Z']) };
  }

  /**
   * One player physics frame: input → kinematics → collision → G writeback.
   * opts.tuning     – per-frame tuning override (zones: pool, water)
   * opts.externalVx – additive drift (Nile current); wall-checked, not stored
   * opts.dir/run    – input overrides (e.g. run disabled while swimming)
   * opts.edgeMargin – world x-clamp margin (default body half-width)
   */
  physicsStep(ts, opts = {}) {
    const T   = opts.tuning ?? this.tuning;
    const inp = this.readInput();
    const dir = opts.dir ?? inp.dir;
    const run = opts.run ?? inp.run;
    const b   = this.body;

    b.x = G.px; b.y = G.py; b.vx = G.pvx; b.vy = G.pvy;
    const wasGrounded = b.grounded;
    const impactVy    = b.vy;

    b.vx = stepRun(b.vx, dir, { grounded: b.grounded, run }, T);
    b.vy = stepFall(b.vy, inp.jumpHeld, T);

    this.solids.rebuild();
    resolveMove(b, this.solids.all(), {
      maxStepUp:  this.maxStepUp,
      externalVx: opts.externalVx ?? 0,
    });

    // World x-clamp (the realm edge is not a Solid).
    const margin = opts.edgeMargin ?? b.w / 2;
    if (b.x < margin)               { b.x = margin;               b.vx = Math.max(0, b.vx); }
    if (b.x > this.worldW - margin) { b.x = this.worldW - margin; b.vx = Math.min(0, b.vx); }

    if (dir !== 0) G.facing = dir;
    G.pmoving = dir !== 0;

    if (!wasGrounded && b.grounded) Events.emit('physics:land', { realm: this.id, impactVy });
    if (b.headBonk)                 Events.emit('physics:bonk', { realm: this.id });

    G.px = b.x; G.py = b.y; G.pvx = b.vx; G.pvy = b.vy;
    return b;
  }

  /** Grounded jump with the running-speed bonus. Call from onKeyDown('z'). */
  tryJump(T = this.tuning) {
    if (!this.body.grounded) return false;
    G.pvy = jumpVelocity(G.pvx, T);
    this.body.grounded = false;
    return true;
  }

  /** Shared leg-flip walk animation (same cadence as the old realms). */
  stepWalkAnim(ts) {
    if (G.pmoving && ts - G.legT > 120) { G.legT = ts; G.pframe = 1 - G.pframe; }
    else if (!G.pmoving) G.pframe = 0;
  }

  /** Reset velocities on entry — realms call this at the top of onEnter(). */
  resetMotion() { G.pvx = 0; G.pvy = 0; this.body.grounded = false; }

  // ── Camera helpers (same math as the old PhysicsRealm) ──
  _clampX(x, margin = 14) {
    return Math.max(margin, Math.min(this.worldW - margin, x));
  }
  _trackCameraX(camX, px, lerpK = 0.1) {
    const target = Math.max(0, Math.min(this.worldW - CW, px - CW / 2));
    return camX + (target - camX) * lerpK;
  }
}
```

- [ ] **Step 3: Syntax-check both files**

Run: `node --check frontend/engine/solidrealm.js && node --check frontend/game/state.js`
Expected: no output (clean). Also re-run `cd frontend && node --test tests/` — still all PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/engine/solidrealm.js frontend/game/state.js
git commit -m "feat: SolidRealm base class bridging physics2d/kinematics to G"
```

---

### Task 4: Desert (WorldRealm) migration

**Files:**
- Modify: `frontend/worlds/earth/WorldRealm.js`

**Interfaces:**
- Consumes: `SolidRealm` from `../../engine/solidrealm.js`; `lyrRect` from `./terrain.js` (already exported); everything WorldRealm already imports.
- Produces: no new interfaces. `surfaceAt`/`canStepTo` overrides are DELETED (they were the PhysicsRealm terrain contract). `surfAt` stays imported — it still powers the descend-cancel check and `draw/hud.js`.

Behavior contract (verify in Step 3): pyramid stair climbing (auto step-up ≤ 23px), z-layer descend/ascend, phase-through descent (`G.descendId`), crypt/capstone/oasis/nile triggers and portals, camera (x lerp + y track), east-edge clamp, `!G.bought` freeze — all exactly as today; movement now has momentum and variable jump.

- [ ] **Step 1: Migrate the realm**

In `frontend/worlds/earth/WorldRealm.js`:

**(a)** Replace the imports of `PhysicsRealm` and `inputDx`:

```js
import { PhysicsRealm, RealmManager }     from '../../engine/realm.js';
```
→
```js
import { RealmManager }                   from '../../engine/realm.js';
import { SolidRealm }                     from '../../engine/solidrealm.js';
```
and
```js
import { SPEED, SPDHALF, LH, inputDx }   from '../constants.js';
```
→
```js
import { SPDHALF, LH }                    from '../constants.js';
```
Also update the `./terrain.js` import list: add `lyrRect`, drop the now-unused `surfAtExcluding` and `canStep`; keep `surfAt` (descend-cancel check), `pyrUnderPlayer`, `playerPyrSurfAt`, `nearbyFriendPyr`.

**(b)** Change the class declaration and constructor head:

```js
export class WorldRealm extends PhysicsRealm {
  constructor() {
    super('world', 'THE DESERT', {
      gravity:      0.5,
      worldW:       WORLD_W,
      floor:        GND,
      maxFallSpeed: 14,
    });
```
→
```js
export class WorldRealm extends SolidRealm {
  constructor() {
    super('world', 'THE DESERT', {
      worldW:    WORLD_W,
      maxStepUp: LH + 1,      // one pyramid layer — preserves stair-walking
    });

    // ── Geometry: the ground plane + every foreground pyramid layer.
    // Pyramids grow at runtime (recruits join), so they are a provider,
    // re-read each frame. pZ −1 walks BEHIND pyramids (no solids), and a
    // phase-through descent (G.descendId) excludes that one pyramid.
    this.solids.addStatic([{ x: -100, y: GND, w: WORLD_W + 200, h: 300 }]);
    this.solids.addProvider(() => {
      if (G.pZ !== 0) return [];
      const rects = [];
      for (const p of G.pyramids) {
        if (!p.layers || (p.zLayer || 0) > 0) continue;
        if (G.descendId && p.id === G.descendId) continue;
        for (let i = 0; i < p.layers; i++) rects.push(lyrRect(p, i));
      }
      return rects;
    });
```
(keep everything after — registry, triggers, portals — unchanged).

**(c)** Delete the `surfaceAt(x)` and `canStepTo(feetY, x)` override methods entirely (the `// ── Terrain interface ──` block).

**(d)** In `onEnter(fromId)`, add `this.resetMotion();` as the first line.

**(e)** Replace the whole movement section of `update(ts)` — everything from `// ── Horizontal movement` through the end of the `else { // Z-layer -1 }` block — with:

```js
    // ── Player physics (momentum + solids; provider handles pZ/descend) ──
    this.physicsStep(ts);

    // ── Cancel phase-through once clear of the pyramid ──
    if (G.descendId && surfAt(G.px) >= G.py) G.descendId = null;
```

**(f)** Replace the walk-animation block:

```js
    if (G.pmoving && ts - G.legT > 120) { G.legT = ts; G.pframe = 1 - G.pframe; }
    else if (!G.pmoving) G.pframe = 0;
```
→
```js
    this.stepWalkAnim(ts);
```

**(g)** In the east-edge clamp at the bottom of `update()`, add a velocity zero so momentum doesn't fight the clamp:

```js
    if (G.pZ === 0 && G.px > OASIS_ENTRY_X + OASIS_GATE_RANGE) {
      G.px = OASIS_ENTRY_X + OASIS_GATE_RANGE;
      G.pvx = Math.min(0, G.pvx);
    }
```

**(h)** In `onKeyDown`, replace the jump handler:

```js
    if ((key === 'z' || key === 'Z') && G.bought && G.pZ === 0) {
      const surf = this.surfaceAt(G.px);
      if (G.py >= surf - 1) { G.pvy = -9; return true; }
    }
```
→
```js
    if ((key === 'z' || key === 'Z') && G.bought && G.pZ === 0) {
      if (this.tryJump()) return true;
    }
```

- [ ] **Step 2: Syntax-check**

Run: `node --check frontend/worlds/earth/WorldRealm.js`
Expected: clean. Grep check: `grep -n "inputDx\|surfaceAt\|canStepTo" frontend/worlds/earth/WorldRealm.js` → no hits.

- [ ] **Step 3: Manual smoke test (docker)**

The Stop hook rebuilds the frontend. In-game at `http://localhost:5173` (backtick dev panel to sim recruits/buy-in first):
- Walk: gradual accel; release: short slide; Shift: faster with longer ramp; quick reverse: brief skid.
- Jump (Z): tap = short hop, hold = high jump; running jump goes higher.
- Climb the player pyramid by walking into it (stairs auto-step). Sim a recruit → new layer appears; stand where it grows → you pop on top (depenetrate).
- ↓ on ground → walk behind pyramids (pZ −1); ↑ → return. ↓ on a friend's pyramid top (own capstone below) → phase-through descent.
- Crypt door, capstone ascend, oasis gate, nile gate all trigger; east-edge clamp holds.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/earth/WorldRealm.js
git commit -m "feat: migrate Desert to SolidRealm (pyramid solids provider)"
```

---

### Task 5: Nile migration

**Files:**
- Modify: `frontend/worlds/nile/NileRealm.js`

**Interfaces:**
- Consumes: `SolidRealm`; `TUNING` from `../../engine/kinematics.js`; existing nile constants (`BANK_SEGMENTS`, `REEDS`, `REED_TOP`, `CROC_BACK`, `RIVERBED_Y`, `BANK_Y`, `WATER_Y`, `WATER_BOTTOM`, `CURRENT_SPD`, `SWIM_SPD`, `JUMP_VY`, `DELTA_START_X`, `NILE_W`).
- Produces: no new interfaces. `_groundUnder` and `_bankWall` are DELETED (solids replace them). `_onBank` STAYS (the return-gate trigger condition uses it).

Behavior contract: banks are solid with quay walls (can't walk into a bank side from the water; climb out from above), riverbed standable everywhere, reeds/croc-backs one-way (crocs move out from under you — no carry, as today), current sweeps west in water only (exempt: Delta, jump-launch frames `pvy < -0.5`), swim = reduced control + no run, croc bites only with feet in water, health/respawn/baby/triggers untouched.

- [ ] **Step 1: Migrate the realm**

In `frontend/worlds/nile/NileRealm.js`:

**(a)** Imports: replace `PhysicsRealm` with `RealmManager`-only from realm.js and add SolidRealm + TUNING:

```js
import { PhysicsRealm, RealmManager }     from '../../engine/realm.js';
```
→
```js
import { RealmManager }                   from '../../engine/realm.js';
import { SolidRealm }                     from '../../engine/solidrealm.js';
import { TUNING }                         from '../../engine/kinematics.js';
```
and
```js
import { inputDx, SPEED, SPDHALF }        from '../constants.js';
```
→
```js
import { SPDHALF }                        from '../constants.js';
```

**(b)** Class + constructor head:

```js
export class NileRealm extends PhysicsRealm {
  constructor() {
    super('nile', 'THE NILE', {
      gravity:      0.5,
      worldW:       NILE_W,
      floor:        BANK_Y,
      maxFallSpeed: 14,
    });
```
→
```js
// In-water tuning: reduced, quick-saturating control; no run; flat jump
// (JUMP_VY, no speed bonus). The current is externalVx, not tuning.
const SWIM_TUNING = {
  ...TUNING,
  walkAccel: 0.8, walkMax: SWIM_SPD, runAccel: 0.8, runMax: SWIM_SPD,
  friction: 0.6, airAccel: 0.8,
  jumpVy: JUMP_VY, jumpVyPerVx: 0,
};

export class NileRealm extends SolidRealm {
  constructor() {
    super('nile', 'THE NILE', {
      worldW:    NILE_W,
      maxStepUp: 0,          // quay walls must stay walls — climb out from above
    });

    // ── Geometry ──────────────────────────────────────────
    // Riverbed: standable everywhere (wading — the soft-lock guarantee).
    this.solids.addStatic([{ x: -100, y: RIVERBED_Y, w: NILE_W + 200, h: 80 }]);
    // Dry banks: deep solid slabs — their tops are the towpath, their sides
    // are the quay walls that stop you walking ashore from the water.
    this.solids.addStatic(BANK_SEGMENTS.map(s => ({
      x: s.x1, y: BANK_Y, w: s.x2 - s.x1, h: WATER_BOTTOM - BANK_Y + 40,
    })));
    // Reeds: one-way platforms above the waterline.
    this.solids.addStatic(REEDS.map(r => ({
      x: r.x - r.w / 2, y: REED_TOP, w: r.w, h: 6, oneWay: true,
    })));
    // Croc-backs: one-way platforms that FOLLOW the patrolling crocs.
    // Provider rects move each frame but carry no rider — the croc swims out
    // from under you exactly as today.
    this.solids.addProvider(() => this.crocs.map(c => ({
      x: c.worldX - CROC_BACK_HW, y: CROC_BACK, w: CROC_BACK_HW * 2, h: 6, oneWay: true,
    })));
```
(constructor continues unchanged: registry, stall, health, crocs, NPCs, triggers, portals).

Note: the provider references `this.crocs`, which is assigned later in the constructor — safe, because providers only run inside `physicsStep()`.

**(c)** Delete the `_groundUnder(px, pyPrev)` and `_bankWall(x, py)` methods. Keep `_onBank(x)`.

**(d)** In `onEnter`, add `this.resetMotion();` as the first line.

**(e)** In `update(ts)`, replace the whole movement block — from `const pyPrev = G.py;` through the splash check — with:

```js
    const pyPrev      = G.py;
    const feetInWater = pyPrev >= WATER_Y - 0.5;

    // ── Player physics ────────────────────────────────────
    if (feetInWater) {
      // Firm current everywhere except the Delta, where the river spreads and
      // slows so you can wade freely toward the boat. Also no push mid-jump-launch.
      const inDelta = G.px < DELTA_START_X;
      const cur = (G.pvy >= -0.5 && !inDelta) ? CURRENT_SPD : 0;
      this.physicsStep(ts, { tuning: SWIM_TUNING, run: false, externalVx: -cur, edgeMargin: SPDHALF });
    } else {
      this.physicsStep(ts, { edgeMargin: SPDHALF });
    }

    // splash when the player breaks the surface (falling/wading in)
    if (pyPrev < WATER_Y && G.py >= WATER_Y && G.pvy > 1.2) {
      spawnParts(G.px, WATER_Y, '#bfe2dc', 12);
    }
```

**(f)** Replace the walk/wade animation block with `this.stepWalkAnim(ts);`.

**(g)** In `onKeyDown`, replace the jump handler:

```js
    if (key === 'z' || key === 'Z') {
      const surf = this._groundUnder(G.px, G.py);
      if (G.py >= surf - 1) { G.pvy = JUMP_VY; return true; }
    }
```
→
```js
    // Z : jump / lunge — off the bank, a reed, a croc-back, or the shallows.
    if (key === 'z' || key === 'Z') {
      const inWater = G.py >= WATER_Y - 0.5;
      if (this.tryJump(inWater ? SWIM_TUNING : this.tuning)) return true;
    }
```

- [ ] **Step 2: Syntax-check**

Run: `node --check frontend/worlds/nile/NileRealm.js`
Expected: clean. Grep: `grep -n "inputDx\|_groundUnder\|_bankWall" frontend/worlds/nile/NileRealm.js` → only the `_onBank` trigger-condition line remains referencing nothing deleted.

- [ ] **Step 3: Manual smoke test (docker)**

- Walk west on the city bank; walk off the edge → splash into the water; current drags west; swimming east nets a slow crawl (+0.6-ish).
- Jump from the riverbed reaches the bank top (72px rise) with Z held.
- Cannot walk into a bank side from the water (quay wall); can land on top.
- Reed-hop a gap; stand on a croc back — it slides out from under you; feet dry on a croc = no bite; feet in water near a croc = death + respawn at entry bank.
- Drown-the-baby / adopt fork unchanged; merchant stall opens; ↑ at the return gate → desert.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile/NileRealm.js
git commit -m "feat: migrate Nile to SolidRealm (bank/reed/croc solids, current as drift)"
```

---

### Task 6: Oasis migration

**Files:**
- Modify: `frontend/worlds/oasis/OasisRealm.js`

**Interfaces:**
- Consumes: `SolidRealm`; `TUNING`; oasis constants (`OASIS_FLOOR`, `POOL_FLOOR`, `POOL_WX`, `POOL_WIDTH`, `OASIS_WORLD_W`, …).
- Produces: `drawOasis(realm)` keeps reading `realm.px/py/camX/facing/frame/worldW/_statueRisen/_statueProgress` — the first five become GETTERS backed by `G`. All `this.px`-style WRITES must become `G.px` writes (ES modules are strict mode: assigning to a getter-only property throws).

Behavior contract: pool wading at 0.55 speed with a −6 flat jump + splash, dry floor at 440 / pool floor at 468 with free walk-in and walk-out (28px rise → `maxStepUp: 30`), statue rise animation, riddles, vault/atlantis portals, west-edge exit to the desert.

- [ ] **Step 1: Migrate the realm**

In `frontend/worlds/oasis/OasisRealm.js`:

**(a)** Imports:

```js
import { PhysicsRealm, RealmManager } from '../../engine/realm.js';
```
→
```js
import { RealmManager }               from '../../engine/realm.js';
import { SolidRealm }                 from '../../engine/solidrealm.js';
import { TUNING }                     from '../../engine/kinematics.js';
```
and drop `SPEED` from the constants import (keep `SPDHALF`).

**(b)** Class head + constructor: replace the `super(...)` options and the instance-state block:

```js
export class OasisRealm extends PhysicsRealm {
  constructor() {
    super('oasis', 'THE OASIS', {
      gravity:      0.5,
      worldW:       OASIS_WORLD_W,
      floor:        OASIS_FLOOR,
      maxFallSpeed: 14,
    });
    this.px       = 60;
    this.py       = OASIS_FLOOR;
    this.pvy      = 0;
    this.camX     = 0;
    this.facing   = 1;
    this.frame    = 0;
    this.moving   = false;
    this._wasInPool = false;
```
→
```js
// Pool wading: same 0.55 speed factor as the old realm; flat −6 hop.
const POOL_TUNING = {
  ...TUNING,
  walkMax: TUNING.walkMax * 0.55, runMax: TUNING.runMax * 0.55,
  jumpVy: -6, jumpVyPerVx: 0,
};

export class OasisRealm extends SolidRealm {
  constructor() {
    super('oasis', 'THE OASIS', {
      worldW:    OASIS_WORLD_W,
      maxStepUp: 30,          // pool floor is 28px below the banks — walk out freely
    });

    // ── Geometry: dry floor either side of the sunken pool floor ──
    this.solids.addStatic([
      { x: -100,                   y: OASIS_FLOOR, w: POOL_WX + 100,                         h: 300 },
      { x: POOL_WX,                y: POOL_FLOOR,  w: POOL_WIDTH,                            h: 300 },
      { x: POOL_WX + POOL_WIDTH,   y: OASIS_FLOOR, w: OASIS_WORLD_W - POOL_WX - POOL_WIDTH + 100, h: 300 },
    ]);
    this._wasInPool = false;
```

**(c)** Add G-backed getters right after the constructor (the draw file reads these off the realm):

```js
  // ── Draw-file compat: state lives in G now ────────────
  get px()     { return G.px; }
  get py()     { return G.py; }
  get camX()   { return G.camX; }
  get facing() { return G.facing; }
  get frame()  { return G.pframe; }
```

**(d)** Delete `_syncToG()` and its call. Rewrite `getPlayerPose()` to read `G`:

```js
  getPlayerPose() {
    return { px: G.px, py: G.py, camX: G.camX, pZ: 0, facing: G.facing, frame: G.pframe };
  }
```

**(e)** Convert every remaining instance-state WRITE to `G` (strict mode makes writes to getter-only properties throw — none may remain):
- `onEnter`: `this.px = …` → `G.px = …`; `this.py = OASIS_FLOOR` → `G.py = OASIS_FLOOR`; `this.pvy = 0` → delete (covered by `this.resetMotion()`, added as the first line of onEnter); `this.camX = …` → `G.camX = …`; `this.facing = …` → `G.facing = …`; `this.moving = false; this.frame = 0;` → `G.pmoving = false; G.pframe = 0;`.
- All reads `this.px` in conditions (`_nearSphinx`, portals, update, onKeyDown) may stay — the getters serve them.

**(f)** In `update(ts)`, replace the movement + gravity blocks:

```js
    // ── Horizontal movement ───────────────────────────────
    let dx = 0;
    const baseSpeed = inPool ? SPEED * 0.55 : SPEED;
    const speed = G.keys['Shift'] ? baseSpeed * 2 : baseSpeed;
    if (G.keys['ArrowLeft'])  { dx = -speed; this.facing = -1; }
    if (G.keys['ArrowRight']) { dx =  speed; this.facing =  1; }
    this.moving = dx !== 0;

    if (dx !== 0) this.px = this._clampX(this.px + dx, SPDHALF);
```
→
```js
    // ── Player physics (pool zone slows and softens the jump) ──
    this.physicsStep(ts, { tuning: inPool ? POOL_TUNING : this.tuning, edgeMargin: SPDHALF });
```
and DELETE the later gravity block:
```js
    // ── Gravity + jump ────────────────────────────────────
    const result = this._gravityStep(this.py, this.pvy, activeFloor);
    this.py  = result.py;
    this.pvy = result.pvy;
```
(the `activeFloor` const at the top of update() dies with it — remove).
Replace the walk-animation block with `this.stepWalkAnim(ts);` and
`this.camX = this._trackCameraX(this.camX, this.px);` with
`G.camX = this._trackCameraX(G.camX, G.px);`. Remove the `this._syncToG();` line.
The west-edge exit check `if (this.px <= SPDHALF + 2)` stays (getter reads G).

**(g)** In `onKeyDown`, replace the jump handler:

```js
    if (key === 'z' || key === 'Z') {
      const inPool  = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
      const jumpPow = inPool ? -6 : -9;
      if (this.py >= (inPool ? POOL_FLOOR : OASIS_FLOOR) - 1) {
        this.pvy = jumpPow;
        if (inPool) _spawnSplash(this.px, OASIS_FLOOR - 2);
        return true;
      }
    }
```
→
```js
    if (key === 'z' || key === 'Z') {
      const inPool = G.px >= POOL_WX && G.px <= POOL_WX + POOL_WIDTH;
      if (this.tryJump(inPool ? POOL_TUNING : this.tuning)) {
        if (inPool) _spawnSplash(G.px, OASIS_FLOOR - 2);
        return true;
      }
    }
```

- [ ] **Step 2: Syntax-check + write-scan**

Run: `node --check frontend/worlds/oasis/OasisRealm.js`
Expected: clean.
Run: `grep -n "this\.\(px\|py\|pvy\|camX\|facing\|frame\|moving\)\s*=" frontend/worlds/oasis/OasisRealm.js`
Expected: NO matches (any hit is a strict-mode crash on a getter).

- [ ] **Step 3: Manual smoke test (docker)**

- Enter from the desert; walk east with momentum; wade into the pool (slows, splash trigger fires); jump in pool is a soft hop; walk out of the pool without getting stuck (28px step-up).
- Sphinx riddles, vault descent (↓ at passage), statue rise + Atlantis dive (↓ in pool) all work; walking west past the edge returns to the desert.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/oasis/OasisRealm.js
git commit -m "feat: migrate Oasis to SolidRealm (pool floor solids + wade tuning)"
```

---

### Task 7: Cleanup, docs, full verification

**Files:**
- Modify: `frontend/engine/realm.js` (delete PhysicsRealm)
- Modify: `frontend/worlds/constants.js` (delete inputDx if unused)
- Modify: `frontend/worlds/WORLD_TEMPLATE.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `engine/realm.js` exports only `Realm` and `RealmManager`.

- [ ] **Step 1: Confirm PhysicsRealm and inputDx are orphaned**

Run: `grep -rn "PhysicsRealm\|inputDx\|_gravityStep" frontend --include="*.js"`
Expected: hits only in `engine/realm.js` and `worlds/constants.js` definitions. If any realm still references them, STOP — that realm's migration task is incomplete.

- [ ] **Step 2: Delete dead code**

- In `frontend/engine/realm.js`: delete the entire `PhysicsRealm` class and its comment banner (keep `Realm`, `RealmManager`; drop the now-unused `CW` import ONLY if nothing else in the file uses it — `RealmManager` does not).
- In `frontend/worlds/constants.js`: delete `inputDx` and its comment block plus the now-unused `import { G }`. Keep `SPEED`, `SPDHALF`, `LH`, `CAP_W`, `SLOPE` (SPDHALF/LH/CAP_W/SLOPE still have users; SPEED — grep first, delete if orphaned).

- [ ] **Step 3: Update docs**

- `frontend/worlds/WORLD_TEMPLATE.md`: replace every `PhysicsRealm` reference with `SolidRealm`; replace the terrain-interface guidance (`surfaceAt`/`canStepTo`) with geometry guidance: "define your terrain as solids in the constructor — `this.solids.addStatic([...])` for fixed rects, `this.solids.addProvider(fn)` for anything that moves or grows; call `this.physicsStep(ts)` in `update()` and `this.tryJump()` on Z."
- `CLAUDE.md` (repo root), Realm system section: replace the `PhysicsRealm` bullet with:
  ```
  - `SolidRealm` (`engine/solidrealm.js`) — Mario-style physics base for side-scrollers: velocity-driven kinematics (`engine/kinematics.js`, `TUNING` is the single source of movement feel) + solid-list AABB collision (`engine/physics2d.js`: walls, ceilings, bonkable blocks via `onBonk`, one-way + moving platforms, `contactDirection` for future stomp enemies). Realms declare geometry as static rects + providers; zones (pool/water) pass per-frame tuning overrides to `physicsStep()`.
  ```
  and update the world-structure table's class names if listed.

- [ ] **Step 4: Full verification**

```bash
cd frontend && node --test tests/
node --check engine/realm.js && node --check worlds/constants.js
```
Expected: all tests PASS, checks clean. Then a full in-game pass of the Task 4/5/6 smoke checklists after rebuild (all three realms + FlatRealm rooms and swim realms untouched-and-working, since realm.js changed).

- [ ] **Step 5: Commit**

```bash
git add frontend/engine/realm.js frontend/worlds/constants.js frontend/worlds/WORLD_TEMPLATE.md CLAUDE.md
git commit -m "chore: delete heightfield PhysicsRealm; document SolidRealm engine"
```
