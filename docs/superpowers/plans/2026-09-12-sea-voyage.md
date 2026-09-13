# The Sea Voyage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Tasks 7, 8 and 9 are INLINE-ONLY** (main session): each ends with publishing a look-dev Artifact and waiting for the user's screenshots. Do not dispatch them to a subagent.

**Goal:** The pharaoh buys a Letter of Passage at JUST POTS, boards a ship at the Nile Delta, and sails a WebGL open sea (Gerstner waves, physical buoyancy, a brooding storm) toward Crete, mooring in its bay.

**Architecture:** A new `sea` realm renders with three.js into a `<canvas id="gl">` stacked *under* the existing transparent 2D canvas, so dialogue, hints, transitions and mobile controls keep working. All simulation (waves, sailing, buoyancy, storm, events, narration, camera math, perf fallback) lives in pure, `node --test`-covered modules; three.js code only reads their state. Backend changes are catalogue data (realm, step, ware) plus tests.

**Tech Stack:** Vanilla JS ES modules (no npm/bundler), three.js 0.170.0 (vendored), Web Audio (`audio/sound.js`), FastAPI + pytest (backend).

**Spec:** `docs/superpowers/specs/2026-09-12-sea-voyage-design.md`

## Global Constraints

- No npm, no bundler, no build step. Native ES modules served by nginx.
- three.js is pinned to **0.170.0** — the last single-file build (0.171+ splits into `three.core.min.js`). Vendored at `frontend/vendor/three.module.min.js`; import-map entry `"three": "./vendor/three.module.min.js"`; `frontend/Dockerfile` must `COPY vendor/`.
- Only `frontend/worlds/sea/scene.js` and `frontend/worlds/sea/gfx/*.js` may import `three`. `SeaRealm.js` must never statically import `three` or `scene.js` (dynamic `import('./scene.js')` only) and must touch no DOM in its constructor.
- Pure modules — `waves.js`, `constants.js`, `voyage.js`, `narration.js`, `chasecam.js`, `perf.js` — import nothing outside that set, touch no DOM. Frontend tests: `cd frontend && node --test tests/*.test.js` (glob form; the bare directory fails on node 25).
- All simulation is dt-based; physics uses fixed `SUBSTEP = 1/120` s inside an accumulator; frame dt clamped to `MAX_DT = 0.1`.
- Direction convention everywhere: angle `a` points along world `(x, z) = (sin a, cos a)`; y is up; meters.
- Realm id is `sea`. No realm id in any API path. Backend changes are catalogue data only: `REALM_CATALOGUE["sea"]`, `STEP_CONFIG["crete_reached"]`, `SHOP_CATALOGUE["letter_of_passage"]` (`price: 8`, `kind: "keepsake"`).
- The server does not verify Letter ownership (accepted gap, documented in the spec). The boat checks `Inventory.owned('letter_of_passage')`.
- Guests: never call the API when `!Api.hasToken()`; arrival is a local `Flags.set` only.
- Shipmaster speaker string, exactly: `'THE SHIPMASTER  ✦  NON-REFUNDABLE VOYAGES'` (two spaces either side of ✦, matching existing NPCs).
- Copy voice: deadpan, MLM-satirical, matching `worlds/nile/dialogue.js`. Log lines start with `'✦ '` and use class `'hi'`.
- Viewport 780×540; renderer pixel ratio capped at 2.
- Backend tests: `docker compose exec backend python -m pytest <path> -v`.
- Branch `feat/sea-voyage` (already checked out). Commit at the end of every task. No push/PR until Task 15.

## Deviations from the spec (deliberate, small)

- `scene.js` is split into `scene.js` (composition) + `gfx/ocean.js`, `gfx/sky.js`, `gfx/storm.js`, `gfx/ship.js`, `gfx/landmarks.js` — focused files instead of one large one.
- Camera spring math and the perf fallback are extracted into pure, tested `chasecam.js` and `perf.js`.
- The look-dev spike publishes the **real** sea modules behind a throwaway harness page (`tools/sea-lookdev/index.html`, deleted in Task 15), so tuning edits the shipped code directly instead of porting params.
- The ocean's reflections/fog use a cheap sky function (`skyColorCheap`) — the full cloud noise per ocean pixel is too heavy for integrated GPUs; the dome blends to the same cheap colour at the horizon so fog matches.
- Dev panel label is `⛵ SEA` (`🌊` is already the Oasis button).

## File map

| File | Status | Responsibility |
|---|---|---|
| `frontend/worlds/sea/waves.js` | create | Gerstner params, `resolveWaves`, `displace`, `heightAt`, `normalAt`, `glslWaves` |
| `frontend/worlds/sea/constants.js` | create | Course geometry, tuning, landmarks, `courseToWorld`/`worldToCourse` |
| `frontend/worlds/sea/voyage.js` | create | `createVoyage`, `stepVoyage`, `polar`, `stormTarget`, `wrapAngle` |
| `frontend/worlds/sea/narration.js` | create | `NARRATION`, `createNarrationMemory`, `narrate` |
| `frontend/worlds/sea/chasecam.js` | create | `CHASE`, `createChaseCam`, `springAxis`, `stepChaseCam` |
| `frontend/worlds/sea/perf.js` | create | `createPerfMonitor` |
| `frontend/worlds/sea/scene.js` | create | `createSeaScene(canvas, { windAngle })` |
| `frontend/worlds/sea/gfx/{sky,ocean,storm,ship,landmarks}.js` | create | three.js visuals |
| `frontend/worlds/sea/dialogue.js` | create | At-sea Shipmaster dialogues |
| `frontend/worlds/sea/SeaRealm.js` | create | Realm lifecycle, input, events → narration/audio/dialogue |
| `frontend/engine/portal.js` | modify | add `use(fromId, toId)` |
| `frontend/engine/webgl.js` | create | `webglAvailable()` |
| `frontend/worlds/transitions.js` | modify | add `seaTransRender` |
| `frontend/worlds/manifest.js` | modify | register `SeaRealm` |
| `frontend/worlds/nile/NileRealm.js` | modify | boat → Shipmaster, boarding edge, return from sea |
| `frontend/worlds/nile/dialogue.js` | modify | `buildShipmasterDialogue`, `buildNoWebglDialogue` |
| `frontend/worlds/nile/shop/catalogue.js` | modify | Letter ware, `PER_ROW`, `TABLE_ROWS` |
| `frontend/worlds/nile/shop/StallOverlay.js` | modify | import `PER_ROW` from catalogue |
| `frontend/draw/ware-art.js` | modify | `letter_of_passage` icon |
| `frontend/audio/sound.js` | modify | `sea` theme, `setAmbience`, `playThunder` |
| `frontend/ui/dev-panel.js` | modify | `⛵ SEA` entry |
| `frontend/index.html`, `frontend/style.css`, `frontend/Dockerfile` | modify | import map, `#gl` canvas, vendor copy |
| `frontend/vendor/three.module.min.js` | create | vendored three.js 0.170.0 |
| `backend/app/{realms,steps,shop}.py` | modify | catalogue entries |
| `backend/tests/test_sea_voyage.py` | create | backend coverage |
| `backend/tests/test_shop_catalogue.py` | modify | ware count 19 |
| `tools/sea-lookdev/index.html` | create → delete | look-dev harness (throwaway) |
| `frontend/tests/{waves,voyage,buoyancy,narration,chasecam,perf,portal,ware-catalogue}.test.js` | create | pure-module tests |

---

### Task 1: Gerstner waves — the single wave source (`waves.js`)

**Files:**
- Create: `frontend/worlds/sea/waves.js`
- Test: `frontend/tests/waves.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `WAVES: Array<{dir:number(deg), L:number, A:number, Q:number}>`, constants `GRAVITY, AMP_BASE, AMP_GAIN, Q_BASE, Q_GAIN, MAX_STEEPNESS, SOLVE_ITERATIONS`
  - `baseSteepness(params?) → number`
  - `resolveWaves(storm:number, windAngle:number, params?) → Array<{dx,dz,k,w,A,Q}>`
  - `steepnessSum(comps) → number`
  - `displace(comps, x0, z0, t) → {x,y,z}`
  - `solveUndisplaced(comps, x, z, t) → {x0,z0}`
  - `heightAt(comps, x, z, t) → number`
  - `normalAt(comps, x, z, t) → {x,y,z}` (unit)
  - `glslWaves(windAngle, params?) → string` defining uniforms `uTime`, `uStorm` and `vec3 gerstner(vec2 p, float atten, out vec3 N, out float fold)`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/waves.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVES, MAX_STEEPNESS, baseSteepness, resolveWaves, steepnessSum,
  displace, heightAt, normalAt, glslWaves,
} from '../worlds/sea/waves.js';

const WIND = 0.6;

test('steepness stays within the no-loop limit across the storm range', () => {
  for (let i = 0; i <= 10; i++) {
    assert.ok(steepnessSum(resolveWaves(i / 10, WIND)) <= MAX_STEEPNESS + 1e-9);
  }
});

test('an over-steep param set is clamped to exactly the limit', () => {
  const steep = [{ dir: 0, L: 10, A: 3, Q: 1 }];
  assert.ok(Math.abs(steepnessSum(resolveWaves(1, 0, steep)) - MAX_STEEPNESS) < 1e-9);
});

test('storm raises wave amplitude', () => {
  const calm = resolveWaves(0.1, WIND), rough = resolveWaves(0.9, WIND);
  assert.ok(rough[0].A > calm[0].A * 2);
});

test('heightAt agrees with the displaced surface within 1 cm (fixed-point solve converges)', () => {
  const comps = resolveWaves(1, WIND);
  for (const [x0, z0, t] of [[0, 0, 0], [37.5, -12, 3.2], [-410, 905, 71.9], [1200, -1800, 240]]) {
    const p = displace(comps, x0, z0, t);
    assert.ok(Math.abs(heightAt(comps, p.x, p.z, t) - p.y) < 0.01, `at ${x0},${z0}`);
  }
});

test('flat params give a flat, upright surface', () => {
  const comps = resolveWaves(0.5, WIND, []);
  assert.equal(heightAt(comps, 12, 34, 5), 0);
  assert.deepEqual(normalAt(comps, 12, 34, 5), { x: 0, y: 1, z: 0 });
});

test('normals are unit length', () => {
  const n = normalAt(resolveWaves(0.8, WIND), 40, -70, 12);
  assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-9);
});

test('waves travel: the surface at a point changes over time', () => {
  const comps = resolveWaves(0.5, WIND);
  assert.notEqual(heightAt(comps, 5, 5, 0), heightAt(comps, 5, 5, 1.3));
});

test('glslWaves emits every component and the shared steepness constant', () => {
  const src = glslWaves(WIND);
  const comps = resolveWaves(0, WIND);
  assert.match(src, /vec3 gerstner\(vec2 p, float atten, out vec3 N, out float fold\)/);
  assert.match(src, /uniform float uTime;/);
  assert.match(src, /uniform float uStorm;/);
  assert.ok(src.includes(baseSteepness().toFixed(6)));
  for (const c of comps) {
    assert.ok(src.includes(c.k.toFixed(6)), 'k');
    assert.ok(src.includes(c.w.toFixed(6)), 'w');
    assert.ok(src.includes(c.dx.toFixed(6)), 'dx');
    assert.ok(src.includes(c.dz.toFixed(6)), 'dz');
  }
  assert.equal((src.match(/th = /g) || []).length, WAVES.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --test tests/waves.test.js`
Expected: FAIL — `Cannot find module '.../worlds/sea/waves.js'`

- [ ] **Step 3: Write the implementation**

Create `frontend/worlds/sea/waves.js`:

```js
// ── FILE: worlds/sea/waves.js ────────────────────────────
// Gerstner ocean — the SINGLE source of truth for the sea surface.
// Pure: imports nothing, touches no DOM or three.js. The GPU vertex shader is
// GENERATED from these params by glslWaves(), and the ship's buoyancy samples
// the same surface via heightAt(), so the two cannot drift apart.
//
// Conventions: meters, y up. A direction angle `a` points along
// (x, z) = (sin a, cos a) — the same convention as the ship's heading.

export const GRAVITY = 9.81;

// Storm scaling. At storm s ∈ [0,1]:
//   A = A_base · (AMP_BASE + AMP_GAIN·s)
//   Q = Q_base · (Q_BASE + Q_GAIN·s) · clampQ, where clampQ keeps Σ Q·k·A ≤ MAX_STEEPNESS
// (above that limit Gerstner crests loop over themselves).
export const AMP_BASE = 0.25;
export const AMP_GAIN = 1.75;
export const Q_BASE   = 0.3;
export const Q_GAIN   = 0.7;
export const MAX_STEEPNESS    = 0.95;
export const SOLVE_ITERATIONS = 12;

// dir: degrees relative to the wind · L: wavelength (m) · A: base amplitude (m) · Q: base steepness
export const WAVES = [
  { dir:   0, L: 96, A: 1.10, Q: 0.55 },   // long swell
  { dir:  18, L: 61, A: 0.70, Q: 0.55 },   // swell
  { dir: -14, L: 43, A: 0.50, Q: 0.60 },   // swell
  { dir:  38, L: 23, A: 0.22, Q: 0.70 },   // chop
  { dir: -32, L: 17, A: 0.16, Q: 0.70 },   // chop
  { dir:  25, L: 11, A: 0.09, Q: 0.70 },   // chop
  { dir: -40, L:  7, A: 0.05, Q: 0.70 },   // chop
];

/** Σ Q_base·k·A_base — storm-independent; the shader reuses it for the clamp. */
export function baseSteepness(params = WAVES) {
  return params.reduce((sum, p) => sum + p.Q * (2 * Math.PI / p.L) * p.A, 0);
}

/** Storm-resolved components: [{ dx, dz, k, w, A, Q }]. */
export function resolveWaves(storm, windAngle, params = WAVES) {
  const s      = Math.min(1, Math.max(0, storm));
  const ampK   = AMP_BASE + AMP_GAIN * s;
  const qK     = Q_BASE + Q_GAIN * s;
  const steep  = baseSteepness(params) * ampK * qK;
  const clampQ = steep > MAX_STEEPNESS ? MAX_STEEPNESS / steep : 1;
  return params.map(p => {
    const a = windAngle + p.dir * Math.PI / 180;
    const k = 2 * Math.PI / p.L;
    return {
      dx: Math.sin(a), dz: Math.cos(a), k, w: Math.sqrt(GRAVITY * k),
      A: p.A * ampK, Q: p.Q * qK * clampQ,
    };
  });
}

export function steepnessSum(comps) {
  return comps.reduce((sum, c) => sum + c.Q * c.k * c.A, 0);
}

/** Displaced surface point for the UNdisplaced grid point (x0, z0) at time t. */
export function displace(comps, x0, z0, t) {
  let x = x0, y = 0, z = z0;
  for (const c of comps) {
    const th  = c.k * (c.dx * x0 + c.dz * z0) - c.w * t;
    const cos = Math.cos(th);
    x += c.Q * c.A * c.dx * cos;
    z += c.Q * c.A * c.dz * cos;
    y += c.A * Math.sin(th);
  }
  return { x, y, z };
}

/** Gerstner moves water sideways, so invert it: find the grid point whose
    displaced position lands on world (x, z). A contraction while Σ Q·k·A < 1. */
export function solveUndisplaced(comps, x, z, t) {
  let x0 = x, z0 = z;
  for (let i = 0; i < SOLVE_ITERATIONS; i++) {
    const p = displace(comps, x0, z0, t);
    x0 += x - p.x;
    z0 += z - p.z;
  }
  return { x0, z0 };
}

/** Water surface height at world (x, z), time t. */
export function heightAt(comps, x, z, t) {
  const { x0, z0 } = solveUndisplaced(comps, x, z, t);
  return displace(comps, x0, z0, t).y;
}

/** Unit surface normal at world (x, z), time t. */
export function normalAt(comps, x, z, t) {
  const { x0, z0 } = solveUndisplaced(comps, x, z, t);
  let nx = 0, ny = 1, nz = 0;
  for (const c of comps) {
    const th = c.k * (c.dx * x0 + c.dz * z0) - c.w * t;
    const kA = c.k * c.A;
    nx -= c.dx * kA * Math.cos(th);
    nz -= c.dz * kA * Math.cos(th);
    ny -= c.Q * kA * Math.sin(th);
  }
  const len = Math.hypot(nx, ny, nz);
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** GLSL for the ocean vertex shader, generated from the same params.
    `atten` (0..1) fades waves far from the camera; the ship is always near it. */
export function glslWaves(windAngle, params = WAVES) {
  const comps = resolveWaves(0, windAngle, params);   // dx/dz/k/w are storm-independent
  const g = (v) => v.toFixed(6);
  const out = [
    '// Generated by worlds/sea/waves.js glslWaves() — do not hand-edit.',
    'uniform float uTime;',
    'uniform float uStorm;',
    'vec3 gerstner(vec2 p, float atten, out vec3 N, out float fold) {',
    `  float ampK = ${g(AMP_BASE)} + ${g(AMP_GAIN)} * uStorm;`,
    `  float qK = ${g(Q_BASE)} + ${g(Q_GAIN)} * uStorm;`,
    `  float steep = ${g(baseSteepness(params))} * ampK * qK;`,
    `  float clampQ = steep > ${g(MAX_STEEPNESS)} ? ${g(MAX_STEEPNESS)} / steep : 1.0;`,
    '  vec3 pos = vec3(p.x, 0.0, p.y);',
    '  vec3 n = vec3(0.0, 1.0, 0.0);',
    '  float th; float c; float s; float A; float Q;',
  ];
  params.forEach((p, i) => {
    const cmp = comps[i];
    out.push(
      `  A = ${g(p.A)} * ampK * atten; Q = ${g(p.Q)} * qK * clampQ;`,
      `  th = ${g(cmp.k)} * dot(vec2(${g(cmp.dx)}, ${g(cmp.dz)}), p) - ${g(cmp.w)} * uTime;`,
      '  c = cos(th); s = sin(th);',
      `  pos.x += Q * A * ${g(cmp.dx)} * c; pos.z += Q * A * ${g(cmp.dz)} * c; pos.y += A * s;`,
      `  n.x -= ${g(cmp.dx)} * ${g(cmp.k)} * A * c; n.z -= ${g(cmp.dz)} * ${g(cmp.k)} * A * c; n.y -= Q * ${g(cmp.k)} * A * s;`,
    );
  });
  out.push('  fold = n.y;', '  N = normalize(n);', '  return pos;', '}');
  return out.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && node --test tests/waves.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/sea/waves.js frontend/tests/waves.test.js
git commit -m "feat(sea): Gerstner wave model — one source for GPU and buoyancy"
```

---
### Task 2: Course, sailing, walls, storm and voyage events (`constants.js`, `voyage.js`)

**Files:**
- Create: `frontend/worlds/sea/constants.js`
- Create: `frontend/worlds/sea/voyage.js`
- Create: `frontend/tests/helpers/sea.js` (test helpers — not matched by the `tests/*.test.js` glob)
- Test: `frontend/tests/voyage.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 yet (buoyancy wires waves in Task 3).
- Produces:
  - `constants.js`: `DEPARTURE, CRETE_BAY, COURSE_LEN, COURSE_HEADING, CORRIDOR_HALF, OUTER_LIMIT, BACK_LIMIT, FRONT_LIMIT, WALL_DRIFT, WALL_TURN, BAY_RADIUS, BAY_BOUNDARY, BAY_REARM, WIND_SPEED, WIND_VEER_MAX, CURRENT_SPEED, SAIL, RUDDER, HULL, SUBSTEP, MAX_DT, STORM, WAKE, LANDMARK_RADIUS, LANDMARKS, CRETE_ISLAND, courseToWorld(along, lateral) → {x,z}, worldToCourse(x, z) → {along, lateral}`
  - `voyage.js`: `wrapAngle(a)` (also consumed by `gfx/ship.js`), `polar(offWind) → 0..1`, `stormTarget(v) → 0..1`, `createVoyage({ rng?, waveParams? }) → VoyageState`, `stepVoyage(v, input, dt) → Event[]`
  - `VoyageState` fields read by later tasks: `t, x, z, heading, speed, rudder, sail, windAngle, drive, storm, arrived, hull{y,vy,pitch,pitchVel,roll,rollVel}, wake[{x,z,t}], nextFlash, rng`
  - `input = { steer: -1..1 (+1 turns LEFT), trim: -1..1 (+1 raises sail) }`
  - Event types: `departure, first_swell, strayed, in_irons, crete_clearer, arrived, bay_exit`, `{type:'storm_rising', level}`, `{type:'landmark_near', id}` (+ `lightning` in Task 3)
  - `tests/helpers/sea.js`: `mulberry32(seed) → () => number`, `sail(v, seconds, fps, policy) → Event[]`, `steerToward(angle) → policy`

- [ ] **Step 1: Write the test helpers**

Create `frontend/tests/helpers/sea.js`:

```js
// Shared helpers for the sea simulation tests (not a test file itself).
import { stepVoyage, wrapAngle } from '../../worlds/sea/voyage.js';

/** Deterministic PRNG so lightning/narration tests are repeatable. */
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Step a voyage for `seconds` at `fps`; policy(v) → input. Returns every event. */
export function sail(v, seconds, fps, policy = () => ({})) {
  const events = [];
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) events.push(...stepVoyage(v, policy(v), 1 / fps));
  return events;
}

/** A helmsman: full sail, rudder proportional to the heading error. */
export function steerToward(angle) {
  return (v) => ({ steer: Math.max(-1, Math.min(1, wrapAngle(angle - v.heading) * 3)), trim: 1 });
}
```

- [ ] **Step 2: Write the failing test**

Create `frontend/tests/voyage.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoyage, stepVoyage, polar, stormTarget, wrapAngle } from '../worlds/sea/voyage.js';
import {
  COURSE_HEADING, COURSE_LEN, CRETE_BAY, OUTER_LIMIT, SAIL, STORM, BAY_BOUNDARY,
  courseToWorld, worldToCourse,
} from '../worlds/sea/constants.js';
import { sail, steerToward } from './helpers/sea.js';

const place = (v, along, lateral) => { const p = courseToWorld(along, lateral); v.x = p.x; v.z = p.z; };

test('course frame round-trips', () => {
  const p = courseToWorld(812, -143);
  const c = worldToCourse(p.x, p.z);
  assert.ok(Math.abs(c.along - 812) < 1e-9 && Math.abs(c.lateral + 143) < 1e-9);
  const bay = worldToCourse(CRETE_BAY.x, CRETE_BAY.z);
  assert.ok(Math.abs(bay.along - COURSE_LEN) < 1e-9 && Math.abs(bay.lateral) < 1e-9);
});

test('wrapAngle keeps angles in (-π, π]', () => {
  assert.equal(wrapAngle(0.5), 0.5);
  assert.ok(Math.abs(wrapAngle(-7) - (-7 + 2 * Math.PI)) < 1e-12);
  assert.ok(Math.abs(Math.abs(wrapAngle(3 * Math.PI)) - Math.PI) < 1e-12);
});

test('polar: no drive in irons, strongest dead downwind, never decreasing', () => {
  assert.equal(polar(0), 0);
  assert.equal(polar(SAIL.irons - 0.01), 0);
  assert.ok(Math.abs(polar(Math.PI / 2) - 0.9) < 1e-12);
  assert.equal(polar(Math.PI), 1);
  let prev = 0;
  for (let i = 0; i <= 100; i++) { const p = polar(Math.PI * i / 100); assert.ok(p >= prev - 1e-12); prev = p; }
});

test('departure fires once, on the first step', () => {
  const v = createVoyage();
  const events = sail(v, 2, 60, () => ({}));
  assert.equal(events.filter(e => e.type === 'departure').length, 1);
  assert.equal(events[0].type, 'departure');
});

test('speed converges to terminal velocity downwind at full sail (traced through drag)', () => {
  const v = createVoyage();
  sail(v, 60, 60, () => ({ trim: 1 }));
  const terminal = Math.sqrt(SAIL.drive / SAIL.drag);
  assert.ok(Math.abs(v.speed - terminal) / terminal < 0.01, `speed ${v.speed}`);
});

test('in irons the ship barely moves, and says so', () => {
  const v = createVoyage();
  v.heading = wrapAngle(COURSE_HEADING + Math.PI);          // bow straight into the wind
  const events = sail(v, 30, 60, () => ({ trim: 1 }));
  assert.ok(v.speed < 0.5, `speed ${v.speed}`);
  assert.ok(events.some(e => e.type === 'in_irons'));
});

test('steer +1 turns left (heading increases)', () => {
  const v = createVoyage();
  v.speed = 8;
  sail(v, 1, 60, () => ({ steer: 1, trim: 1 }));
  assert.ok(wrapAngle(v.heading - COURSE_HEADING) > 0);
});

test('a stopped ship cannot spin', () => {
  const v = createVoyage();
  v.sail = 0; v.speed = 0;
  sail(v, 5, 60, () => ({ steer: 1, trim: -1 }));
  assert.ok(Math.abs(wrapAngle(v.heading - COURSE_HEADING)) < 1e-9);
});

test('sailing straight for Crete arrives in 180–300 s', () => {
  const v = createVoyage();
  let t = 0;
  while (!v.arrived && t < 400) {
    stepVoyage(v, steerToward(Math.atan2(CRETE_BAY.x - v.x, CRETE_BAY.z - v.z))(v), 1 / 60);
    t += 1 / 60;
  }
  assert.ok(v.arrived, 'never arrived');
  assert.ok(t >= 180 && t <= 300, `arrived at ${t.toFixed(1)} s`);
});

test('steering hard away from the course never escapes the outer limit', () => {
  const v = createVoyage();
  const policy = steerToward(COURSE_HEADING - Math.PI / 2);   // beam reach, straight off the line
  let maxLat = 0; const events = [];
  for (let i = 0; i < 600 * 60; i++) {
    events.push(...stepVoyage(v, policy(v), 1 / 60));
    maxLat = Math.max(maxLat, Math.abs(worldToCourse(v.x, v.z).lateral));
  }
  assert.ok(maxLat <= OUTER_LIMIT + 5, `max lateral ${maxLat.toFixed(1)}`);
  assert.ok(events.some(e => e.type === 'strayed'));
});

test('storm target ramps with progress and rises off course', () => {
  const v = createVoyage();
  assert.ok(Math.abs(stormTarget(v) - 0.1) < 1e-9);
  place(v, COURSE_LEN / 2, 0);   assert.ok(Math.abs(stormTarget(v) - 0.35) < 1e-9);
  place(v, COURSE_LEN, 0);       assert.ok(Math.abs(stormTarget(v) - 0.75) < 1e-9);
  place(v, 1200, OUTER_LIMIT);   assert.ok(Math.abs(stormTarget(v) - 0.70) < 1e-9);
  v.arrived = true;              assert.equal(stormTarget(v), STORM.moored);
});

test('storm intensity converges to its target', () => {
  const v = createVoyage();
  place(v, 1200, 0);
  v.sail = 0;
  sail(v, 60, 60, () => ({ trim: -1 }));
  assert.ok(Math.abs(v.storm - stormTarget(v)) < 0.01, `storm ${v.storm}`);
});

test('storm_rising fires once per threshold', () => {
  const v = createVoyage();
  place(v, COURSE_LEN - 250, 0);          // storm target 0.75
  v.sail = 0;
  const events = sail(v, 60, 60, () => ({ trim: -1 }));
  const levels = events.filter(e => e.type === 'storm_rising').map(e => e.level);
  assert.deepEqual(levels, STORM.marks);
});

test('landmark_near fires once per landmark', () => {
  const v = createVoyage();
  place(v, 500, 140);                      // the wreck
  v.sail = 0;
  const events = sail(v, 3, 60, () => ({ trim: -1 }));
  assert.equal(events.filter(e => e.type === 'landmark_near' && e.id === 'wreck').length, 1);
});

test('arrival switches off the pull: a becalmed, moored ship stays put', () => {
  const v = createVoyage();
  place(v, COURSE_LEN - 300, 0);
  const events = [];
  for (let i = 0; i < 60 * 60 && !v.arrived; i++) events.push(...stepVoyage(v, { trim: 1 }, 1 / 60));
  assert.ok(events.some(e => e.type === 'arrived'));
  assert.equal(stormTarget(v), STORM.moored);
  v.sail = 0; v.speed = 0;
  const x = v.x, z = v.z;
  sail(v, 30, 60, () => ({ trim: -1 }));
  assert.ok(Math.hypot(v.x - x, v.z - z) < 0.01);
});

test('moored: sailing out of the bay prompts once and the boundary holds', () => {
  const v = createVoyage();
  v.x = CRETE_BAY.x; v.z = CRETE_BAY.z; v.arrived = true;
  v.heading = wrapAngle(COURSE_HEADING + Math.PI);   // straight back out of the bay
  const events = []; let maxD = 0;
  for (let i = 0; i < 300 * 60; i++) {
    events.push(...stepVoyage(v, { trim: 1 }, 1 / 60));
    maxD = Math.max(maxD, Math.hypot(v.x - CRETE_BAY.x, v.z - CRETE_BAY.z));
  }
  assert.ok(maxD <= BAY_BOUNDARY + 5, `max ${maxD.toFixed(1)}`);
  assert.equal(events.filter(e => e.type === 'bay_exit').length, 1);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && node --test tests/voyage.test.js`
Expected: FAIL — `Cannot find module '.../worlds/sea/voyage.js'`

- [ ] **Step 4: Write `constants.js`**

Create `frontend/worlds/sea/constants.js`:

```js
// ── FILE: worlds/sea/constants.js ────────────────────────
// Layout + tuning for THE SEA. Pure data (imports nothing).
// World frame: meters, y up; a direction angle `a` points along (x,z) = (sin a, cos a).
// Departure (the Delta) is the origin; Crete's bay lies ~2.4 km out.

export const DEPARTURE      = { x: 0, z: 0 };
export const CRETE_BAY      = { x: -1400, z: -1950 };
export const COURSE_LEN     = Math.hypot(CRETE_BAY.x - DEPARTURE.x, CRETE_BAY.z - DEPARTURE.z);
export const COURSE_HEADING = Math.atan2(CRETE_BAY.x - DEPARTURE.x, CRETE_BAY.z - DEPARTURE.z);

export const CORRIDOR_HALF = 260;                 // free wandering either side of the course line
export const OUTER_LIMIT   = 700;                 // soft wall: the sea turns you back past this
export const BACK_LIMIT    = -300;                // soft wall behind the Delta (along-course m)
export const FRONT_LIMIT   = COURSE_LEN + 300;    // soft wall short of Crete's cliffs
export const WALL_DRIFT    = 3;                   // m/s pushed back in, at 50 m past a wall
export const WALL_TURN     = 0.4;                 // rad/s the sea swings the bow back (beats full rudder)

export const BAY_RADIUS    = 220;                 // entering this radius of CRETE_BAY = arrival
export const BAY_BOUNDARY  = 520;                 // moored: crossing this outward prompts "sail home?"
export const BAY_REARM     = 460;                 // back inside this re-arms that prompt

export const WIND_SPEED    = 11;                  // m/s — visual/audio only; drive is SAIL.drive
export const WIND_VEER_MAX = 0.9;                 // rad the wind veers toward the line at OUTER_LIMIT
export const CURRENT_SPEED = 0.6;                 // m/s drift toward Crete (off after arrival)

export const SAIL = {
  rate:  0.6,                                     // trim change per second while ↑/↓ held
  start: 0.5,                                     // trim at departure
  drive: 1.5,                                     // m/s² at full sail, dead downwind
  drag:  0.015,                                   // quadratic → terminal speed √(drive/drag) = 10 m/s
  irons: 40 * Math.PI / 180,                      // within this of the wind's source: no drive
};

export const RUDDER = {
  max:      0.6,                                  // rudder angle at full input (rad)
  tau:      0.35,                                 // seconds for the rudder to ease toward input
  turnGain: 0.02,                                 // yaw rate = speed · rudder · turnGain (rad/s)
};

export const HULL = {
  halfLen: 9, halfBeam: 2.4,
  kHeave:  6, zetaHeave: 0.5,
  kPitch:  5, zetaPitch: 0.55,
  kRoll:   4, zetaRoll:  0.4,
  heelMax: 0.14,                                  // rad of lean at full sail on a beam wind
};

export const SUBSTEP = 1 / 120;                   // fixed physics step (s)
export const MAX_DT  = 0.1;                       // a long frame (tab switch) is clamped to this

export const STORM = {
  tau:       6,                                   // seconds for intensity to ease toward target
  offCourse: 0.35,                                // extra intensity at OUTER_LIMIT
  moored:    0.2,                                 // target once arrived
  marks:     [0.3, 0.5, 0.7],                     // storm_rising narration thresholds
  flashFrom: 0.25,                                // lightning begins above this intensity
};

export const WAKE = { every: 0.25, max: 32 };     // seconds between wake points; ring size

export const LANDMARK_RADIUS = 260;
export const LANDMARKS = [
  { id: 'wreck',       along:  500, lateral:  140 },
  { id: 'signal_rock', along: 1150, lateral: -190 },
  { id: 'bull_horns',  along: 1750, lateral:  120 },
];
export const CRETE_ISLAND = { along: COURSE_LEN + 1100, lateral: 0, radius: 900, height: 460 };  // shore ≈ FRONT_LIMIT + 80 m

// Course frame: `along` runs Delta → Crete; `lateral` is positive to the course's right.
const _F = { x: Math.sin(COURSE_HEADING), z: Math.cos(COURSE_HEADING) };
const _R = { x: -Math.cos(COURSE_HEADING), z: Math.sin(COURSE_HEADING) };

export function courseToWorld(along, lateral) {
  return { x: DEPARTURE.x + _F.x * along + _R.x * lateral, z: DEPARTURE.z + _F.z * along + _R.z * lateral };
}

export function worldToCourse(x, z) {
  const dx = x - DEPARTURE.x, dz = z - DEPARTURE.z;
  return { along: dx * _F.x + dz * _F.z, lateral: dx * _R.x + dz * _R.z };
}
```

- [ ] **Step 5: Write `voyage.js`**

Create `frontend/worlds/sea/voyage.js`:

```js
// ── FILE: worlds/sea/voyage.js ───────────────────────────
// The voyage simulation — pure (no DOM, no three.js). SeaRealm steps it with
// real elapsed time; scene.js only reads it. Fixed SUBSTEP steps inside an
// accumulator make the ship behave identically at 30, 60 or 144 fps.
//
// stepVoyage(v, input, dt) mutates `v` and returns this frame's events:
//   { type: 'departure' | 'first_swell' | 'strayed' | 'in_irons'
//         | 'crete_clearer' | 'arrived' | 'bay_exit' }
//   { type: 'storm_rising', level }    { type: 'landmark_near', id }
// input = { steer: -1..1 (+1 turns LEFT), trim: -1..1 (+1 raises sail) }

import {
  DEPARTURE, CRETE_BAY, COURSE_LEN, COURSE_HEADING,
  CORRIDOR_HALF, OUTER_LIMIT, BACK_LIMIT, FRONT_LIMIT, WALL_DRIFT, WALL_TURN,
  BAY_RADIUS, BAY_BOUNDARY, BAY_REARM,
  WIND_VEER_MAX, CURRENT_SPEED, SAIL, RUDDER, SUBSTEP, MAX_DT, STORM,
  LANDMARKS, LANDMARK_RADIUS, courseToWorld, worldToCourse,
} from './constants.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const LANDMARK_POS = LANDMARKS.map(l => ({ id: l.id, ...courseToWorld(l.along, l.lateral) }));

// Course axes: F along the course, R to its right (lateral +).
const FX = Math.sin(COURSE_HEADING),  FZ = Math.cos(COURSE_HEADING);
const RX = -Math.cos(COURSE_HEADING), RZ = Math.sin(COURSE_HEADING);

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Sail drive fraction by angle off the wind's SOURCE (0 = bow into the wind, π = dead downwind). */
export function polar(offWind) {
  const a = Math.abs(offWind);
  if (a < SAIL.irons) return 0;
  if (a < Math.PI / 2) return 0.9 * smoothstep(SAIL.irons, Math.PI / 2, a);
  return 0.9 + 0.1 * (a - Math.PI / 2) / (Math.PI / 2);
}

/** Storm intensity the sea eases toward at the ship's position. */
export function stormTarget(v) {
  if (v.arrived) return STORM.moored;
  const { along, lateral } = worldToCourse(v.x, v.z);
  const p    = clamp(along / COURSE_LEN, 0, 1);
  const ramp = 0.1 + 0.25 * smoothstep(0, 0.25, p) + 0.4 * smoothstep(0.6, 0.95, p);
  const off  = STORM.offCourse * clamp((Math.abs(lateral) - CORRIDOR_HALF) / (OUTER_LIMIT - CORRIDOR_HALF), 0, 1);
  return clamp(ramp + off, 0, 1);
}

export function createVoyage({ rng = Math.random, waveParams } = {}) {
  return {
    t: 0, acc: 0, rng, waveParams,
    x: DEPARTURE.x, z: DEPARTURE.z,
    heading: COURSE_HEADING, speed: 0, rudder: 0, sail: SAIL.start,
    windAngle: COURSE_HEADING,              // direction the wind blows TOWARD
    drive: 0,                               // last substep's drive (m/s²)
    storm: 0.1, arrived: false,
    hull: { y: 0, vy: 0, pitch: 0, pitchVel: 0, roll: 0, rollVel: 0 },
    wake: [], wakeTimer: 0,
    ironsTime: 0, nextFlash: 8,
    once: {},                               // one-shot event keys already emitted this voyage
    armed: { strayed: true, irons: true, bayExit: true },
  };
}

export function stepVoyage(v, input, dt) {
  const events = [];
  if (!v.once.departure) { v.once.departure = true; events.push({ type: 'departure' }); }
  v.acc += clamp(dt || 0, 0, MAX_DT);
  while (v.acc >= SUBSTEP) {
    v.acc -= SUBSTEP;
    _substep(v, input || {}, SUBSTEP, events);
  }
  return events;
}

function _substep(v, input, h, events) {
  v.t += h;
  const steer = clamp(input.steer ?? 0, -1, 1);
  const trim  = clamp(input.trim ?? 0, -1, 1);

  // ── Controls: trim ramps, the rudder eases, and turning needs way on ──
  v.sail    = clamp(v.sail + trim * SAIL.rate * h, 0, 1);
  v.rudder += (steer * RUDDER.max - v.rudder) * (1 - Math.exp(-h / RUDDER.tau));
  v.heading = wrapAngle(v.heading + v.speed * v.rudder * RUDDER.turnGain * h);

  const { along, lateral } = worldToCourse(v.x, v.z);
  if (Math.abs(lateral) > OUTER_LIMIT || along < BACK_LIMIT) {
    // The sea itself swings the bow back toward Crete — stronger than full rudder.
    v.heading = wrapAngle(v.heading + clamp(wrapAngle(COURSE_HEADING - v.heading), -1, 1) * WALL_TURN * h);
  }

  // ── Wind: steady in the corridor, veering back toward the line outside it.
  //    Moored, it swings abeam so nothing pins the ship against the shore. ──
  const excess = clamp((Math.abs(lateral) - CORRIDOR_HALF) / (OUTER_LIMIT - CORRIDOR_HALF), 0, 1);
  v.windAngle = v.arrived
    ? COURSE_HEADING + Math.PI / 2
    : COURSE_HEADING + Math.sign(lateral) * excess * WIND_VEER_MAX;

  // ── Drive against quadratic drag; speed is along the bow and never negative ──
  const off = Math.abs(wrapAngle(v.heading - (v.windAngle + Math.PI)));
  v.drive = v.sail * polar(off) * SAIL.drive;
  v.speed = Math.max(0, v.speed + (v.drive - SAIL.drag * v.speed * v.speed) * h);

  // ── Ground velocity = bow + current, limited by the soft walls ──
  const cur = v.arrived ? 0 : CURRENT_SPEED;
  let vx = Math.sin(v.heading) * v.speed + FX * cur;
  let vz = Math.cos(v.heading) * v.speed + FZ * cur;
  [vx, vz] = _walls(v, along, lateral, vx, vz);
  v.x += vx * h;
  v.z += vz * h;

  // ── Storm eases toward its target ──
  v.storm += (stormTarget(v) - v.storm) * (1 - Math.exp(-h / STORM.tau));

  _events(v, h, events);
}

/** Past a limit: cancel outward velocity and drift back in (overshoot ≤ one substep). */
function _axis(pos, min, max, vel) {
  if (pos > max) return Math.min(vel, 0) - WALL_DRIFT * Math.min(1, (pos - max) / 50);
  if (pos < min) return Math.max(vel, 0) + WALL_DRIFT * Math.min(1, (min - pos) / 50);
  return vel;
}

function _walls(v, along, lateral, vx, vz) {
  const va = _axis(along, BACK_LIMIT, FRONT_LIMIT, vx * FX + vz * FZ);
  const vl = _axis(lateral, -OUTER_LIMIT, OUTER_LIMIT, vx * RX + vz * RZ);
  vx = FX * va + RX * vl;
  vz = FZ * va + RZ * vl;
  if (v.arrived) {   // moored: a radial wall around the bay
    const bx = v.x - CRETE_BAY.x, bz = v.z - CRETE_BAY.z, d = Math.hypot(bx, bz);
    if (d > BAY_BOUNDARY) {
      const ux = bx / d, uz = bz / d, out = vx * ux + vz * uz;
      const drift = WALL_DRIFT * Math.min(1, (d - BAY_BOUNDARY) / 50);
      if (out > 0) { vx -= ux * out; vz -= uz * out; }
      vx -= ux * drift; vz -= uz * drift;
    }
  }
  return [vx, vz];
}

function _events(v, h, events) {
  const { along, lateral } = worldToCourse(v.x, v.z);
  const once = (key, evt) => { if (!v.once[key]) { v.once[key] = true; events.push(evt); } };

  if (along > 150)               once('first_swell', { type: 'first_swell' });
  if (along >= COURSE_LEN / 2)   once('crete_clearer', { type: 'crete_clearer' });
  for (const m of STORM.marks) if (v.storm >= m) once(`storm_${m}`, { type: 'storm_rising', level: m });
  for (const lm of LANDMARK_POS) {
    if (Math.hypot(v.x - lm.x, v.z - lm.z) < LANDMARK_RADIUS) once(`lm_${lm.id}`, { type: 'landmark_near', id: lm.id });
  }

  // Strayed: re-arms once back well inside the corridor.
  if (Math.abs(lateral) > CORRIDOR_HALF) {
    if (v.armed.strayed) { v.armed.strayed = false; events.push({ type: 'strayed' }); }
  } else if (Math.abs(lateral) < CORRIDOR_HALF - 40) {
    v.armed.strayed = true;
  }

  // In irons: sail up, no drive, barely moving — for 3 s.
  if (v.sail > 0.3 && v.drive === 0 && v.speed < 1) {
    v.ironsTime += h;
    if (v.ironsTime > 3 && v.armed.irons) { v.armed.irons = false; events.push({ type: 'in_irons' }); }
  } else {
    v.ironsTime = 0;
    v.armed.irons = true;
  }

  // Arrival, then the bay-exit prompt (re-arms back inside BAY_REARM).
  const bay = Math.hypot(v.x - CRETE_BAY.x, v.z - CRETE_BAY.z);
  if (!v.arrived && bay < BAY_RADIUS) { v.arrived = true; events.push({ type: 'arrived' }); }
  if (v.arrived) {
    if (bay > BAY_BOUNDARY && v.armed.bayExit) { v.armed.bayExit = false; events.push({ type: 'bay_exit' }); }
    else if (bay < BAY_REARM) v.armed.bayExit = true;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && node --test tests/voyage.test.js`
Expected: PASS (16 tests). If "arrives in 180–300 s" or "outer limit" fails, fix the model — do **not** widen the test bounds; they are the spec's voyage length and wall guarantee.

- [ ] **Step 7: Run the whole frontend suite**

Run: `cd frontend && node --test tests/*.test.js`
Expected: PASS (all existing + new)

- [ ] **Step 8: Commit**

```bash
git add frontend/worlds/sea/constants.js frontend/worlds/sea/voyage.js frontend/tests/helpers/sea.js frontend/tests/voyage.test.js
git commit -m "feat(sea): voyage sim — sailing, wind pull, soft walls, storm, events"
```

---
### Task 3: Buoyancy, wake and lightning scheduling (`voyage.js`)

**Files:**
- Modify: `frontend/worlds/sea/voyage.js`
- Test: `frontend/tests/buoyancy.test.js`

**Interfaces:**
- Consumes: `resolveWaves`, `heightAt` (Task 1); `HULL`, `WAKE`, `STORM`, `COURSE_HEADING`, `courseToWorld`, `worldToCourse` (Task 2); `mulberry32`, `sail` (Task 2 helpers).
- Produces (on `VoyageState`, read by `scene.js` and `SeaRealm.js`):
  - `hull.y` (m), `hull.pitch` (rad, bow-up +), `hull.roll` (rad), `hull.vy` (m/s, negative = slamming down)
  - `wake: Array<{x, z, t}>`, oldest first, at most `WAKE.max`
  - Event `{ type: 'lightning', x, z, distance, power }` (`power` 0.4–1)

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/buoyancy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoyage, polar } from '../worlds/sea/voyage.js';
import { COURSE_HEADING, HULL, WAKE, worldToCourse } from '../worlds/sea/constants.js';
import { mulberry32, sail } from './helpers/sea.js';

test('on flat water the hull settles to rest within 5 s (residual < 1 cm)', () => {
  const v = createVoyage({ waveParams: [] });
  v.hull.y = 2; v.hull.pitch = 0.2; v.hull.roll = -0.2; v.sail = 0;
  sail(v, 5, 60, () => ({ trim: -1 }));
  assert.ok(Math.abs(v.hull.y) < 0.01, `y ${v.hull.y}`);
  assert.ok(Math.abs(v.hull.pitch) < 0.01, `pitch ${v.hull.pitch}`);
  assert.ok(Math.abs(v.hull.roll) < 0.02, `roll ${v.hull.roll}`);
});

test('rough water heaves and pitches the hull', () => {
  const v = createVoyage();
  v.storm = 0.9;
  let minY = Infinity, maxY = -Infinity, maxPitch = 0;
  for (let i = 0; i < 180; i++) {
    sail(v, 1 / 60, 60, () => ({ trim: 1 }));
    minY = Math.min(minY, v.hull.y); maxY = Math.max(maxY, v.hull.y);
    maxPitch = Math.max(maxPitch, Math.abs(v.hull.pitch));
  }
  assert.ok(maxY - minY > 0.2, `heave range ${maxY - minY}`);
  assert.ok(maxPitch > 0.005, `pitch ${maxPitch}`);
});

test('a beam wind heels the ship AWAY from the wind (sign pinned by hand)', () => {
  // Convention: +roll leans the mast to STARBOARD (three.js rotation.z about the bow
  // axis; the ship's local +x is port). Heading COURSE_HEADING − π/2 puts the wind
  // (blowing toward COURSE_HEADING) on the starboard beam, so the ship must lean to
  // PORT: roll < 0. Derived by hand — never recompute this from the implementation.
  const v = createVoyage({ waveParams: [] });
  v.heading = COURSE_HEADING - Math.PI / 2;
  v.sail = 1;
  sail(v, 10, 60, () => ({ trim: 1 }));
  const expected = -HULL.heelMax * polar(Math.PI / 2);
  assert.ok(v.hull.roll < 0, `leans into the wind: roll ${v.hull.roll}`);
  assert.ok(Math.abs(v.hull.roll - expected) < 0.01, `roll ${v.hull.roll} vs ${expected}`);
});

test('30 fps and 60 fps produce the same voyage', () => {
  const policy = (v) => ({ steer: v.t < 4 ? 1 : 0, trim: 1 });
  const a = createVoyage({ rng: mulberry32(7) });
  const b = createVoyage({ rng: mulberry32(7) });
  sail(a, 10, 30, policy);
  sail(b, 10, 60, policy);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.5, 'position');
  assert.ok(Math.abs(a.heading - b.heading) < 0.02, 'heading');
  assert.ok(Math.abs(a.hull.y - b.hull.y) < 0.05, 'heave');
  assert.ok(Math.abs(a.hull.pitch - b.hull.pitch) < 0.01, 'pitch');
});

test('the wake is a bounded ring, oldest first, newest at the ship', () => {
  const v = createVoyage();
  sail(v, 20, 60, () => ({ trim: 1 }));
  assert.equal(v.wake.length, WAKE.max);
  for (let i = 1; i < v.wake.length; i++) assert.ok(v.wake[i].t > v.wake[i - 1].t);
  const last = v.wake[v.wake.length - 1];
  assert.ok(Math.hypot(last.x - v.x, last.z - v.z) < 5);
});

test('a stormy sea throws lightning ahead of the ship', () => {
  const v = createVoyage({ rng: mulberry32(3) });
  v.storm = 0.9; v.nextFlash = 0.5;
  const bolt = sail(v, 1, 60, () => ({})).find(e => e.type === 'lightning');
  assert.ok(bolt, 'no lightning');
  assert.ok(bolt.distance > 0);
  assert.ok(bolt.power >= 0.4 && bolt.power <= 1);
  assert.ok(worldToCourse(bolt.x, bolt.z).along > worldToCourse(v.x, v.z).along + 500);
});

test('a calm sea throws no lightning', () => {
  const v = createVoyage({ rng: mulberry32(3) });
  v.sail = 0;
  const events = sail(v, 60, 60, () => ({ trim: -1 }));
  assert.equal(events.filter(e => e.type === 'lightning').length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --test tests/buoyancy.test.js`
Expected: FAIL — flat-water heave stays at `y 2` (no buoyancy yet), wake length 0, no lightning.

- [ ] **Step 3: Implement**

In `frontend/worlds/sea/voyage.js`:

1. Extend the header comment's event list with:
```js
//   { type: 'lightning', x, z, distance, power }
```

2. Add the waves import above the constants import, and add `HULL, WAKE` to the constants import list:
```js
import { resolveWaves, heightAt } from './waves.js';
```

3. In `_substep`, replace
```js
  v.drive = v.sail * polar(off) * SAIL.drive;
```
with
```js
  const pol = polar(off);
  v.drive = v.sail * pol * SAIL.drive;
```

4. In `_substep`, replace the final line `  _events(v, h, events);` with
```js
  _hull(v, h, pol);
  _wake(v, h);
  _lightning(v, h, events);
  _events(v, h, events);
```

5. Add these functions below `_walls`:
```js
/** Five hull samples on the shared wave surface drive heave, pitch and roll
    through damped springs; sail force adds heel away from the wind. */
function _hull(v, h, pol) {
  const comps = resolveWaves(v.storm, COURSE_HEADING, v.waveParams);
  const fx = Math.sin(v.heading),  fz = Math.cos(v.heading);
  const rx = -Math.cos(v.heading), rz = Math.sin(v.heading);
  const at = (fwd, right) => heightAt(comps, v.x + fx * fwd + rx * right, v.z + fz * fwd + rz * right, v.t);
  const bow  = at(HULL.halfLen, 0),   stern = at(-HULL.halfLen, 0);
  const port = at(0, -HULL.halfBeam), star  = at(0, HULL.halfBeam), mid = at(0, 0);
  const hl = v.hull;
  const spring = (pos, vel, target, k, zeta) => vel + (k * (target - pos) - 2 * zeta * Math.sqrt(k) * vel) * h;

  hl.vy = spring(hl.y, hl.vy, (bow + stern + port + star + mid) / 5, HULL.kHeave, HULL.zetaHeave);
  hl.y += hl.vy * h;

  hl.pitchVel = spring(hl.pitch, hl.pitchVel, Math.atan2(bow - stern, 2 * HULL.halfLen), HULL.kPitch, HULL.zetaPitch);
  hl.pitch += hl.pitchVel * h;

  // +roll leans to starboard; wind pushes the rig to leeward, so lean away from it.
  const heel = HULL.heelMax * v.sail * pol * Math.sin(wrapAngle(v.heading - v.windAngle));
  hl.rollVel = spring(hl.roll, hl.rollVel, Math.atan2(port - star, 2 * HULL.halfBeam) + heel, HULL.kRoll, HULL.zetaRoll);
  hl.roll += hl.rollVel * h;
}

/** Drop a wake point every WAKE.every seconds into a bounded ring. */
function _wake(v, h) {
  v.wakeTimer += h;
  if (v.wakeTimer < WAKE.every) return;
  v.wakeTimer -= WAKE.every;
  v.wake.push({ x: v.x, z: v.z, t: v.t });
  if (v.wake.length > WAKE.max) v.wake.shift();
}

/** Above STORM.flashFrom, strikes land ahead of the ship, more often as the storm grows. */
function _lightning(v, h, events) {
  if (v.storm < STORM.flashFrom) return;
  v.nextFlash -= h;
  if (v.nextFlash > 0) return;
  const r = v.rng;
  const u = (v.storm - STORM.flashFrom) / (1 - STORM.flashFrom);
  const along = worldToCourse(v.x, v.z).along + 600 + r() * 1900;
  const p = courseToWorld(along, (r() - 0.5) * 1600);
  events.push({
    type: 'lightning', x: p.x, z: p.z,
    distance: Math.hypot(p.x - v.x, p.z - v.z),
    power: 0.4 + 0.6 * u * r(),
  });
  v.nextFlash = (14 + (2.5 - 14) * u) * (0.6 + 0.8 * r());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && node --test tests/*.test.js`
Expected: PASS — `buoyancy.test.js` (7 tests) and the Task 2 `voyage.test.js` still green. If "flat water settles" fails on roll, it is the heel term (sail is 0 there, so heel must be 0) — check the `pol`/`v.sail` wiring, not the tolerance.

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/sea/voyage.js frontend/tests/buoyancy.test.js
git commit -m "feat(sea): hull buoyancy on the shared wave surface, wake ring, lightning"
```

---
### Task 4: Narration table (`narration.js`)

**Files:**
- Create: `frontend/worlds/sea/narration.js`
- Test: `frontend/tests/narration.test.js`

**Interfaces:**
- Consumes: event shapes from Tasks 2–3 (`{type, id?, level?}`).
- Produces: `NARRATION`, `createNarrationMemory() → {last:{}, done:{}}`, `narrate(events, nowSec, memory, rng?) → string[]` (each line already prefixed `'✦ '`). **Returns lines only — never imports `ui/panels.js`;** `SeaRealm` calls `log(line, 'hi')`.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/narration.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NARRATION, createNarrationMemory, narrate } from '../worlds/sea/narration.js';

const first = () => 0;   // rng → always the first line

test('once events speak a single time per voyage', () => {
  const mem = createNarrationMemory();
  assert.equal(narrate([{ type: 'departure' }], 0, mem, first).length, 1);
  assert.equal(narrate([{ type: 'departure' }], 500, mem, first).length, 0);
});

test('lines carry the log prefix', () => {
  const [line] = narrate([{ type: 'departure' }], 0, createNarrationMemory(), first);
  assert.equal(line, '✦ ' + NARRATION.departure.lines[0]);
});

test('cooldown events respect their cooldown', () => {
  const mem = createNarrationMemory();
  const cd = NARRATION.strayed.cooldown;
  assert.equal(narrate([{ type: 'strayed' }], 10, mem, first).length, 1);
  assert.equal(narrate([{ type: 'strayed' }], 10 + cd - 1, mem, first).length, 0);
  assert.equal(narrate([{ type: 'strayed' }], 10 + cd + 1, mem, first).length, 1);
});

test('landmarks and storm levels are keyed separately', () => {
  const mem = createNarrationMemory();
  const lines = narrate([
    { type: 'landmark_near', id: 'wreck' },
    { type: 'landmark_near', id: 'signal_rock' },
    { type: 'storm_rising', level: 0.3 },
    { type: 'storm_rising', level: 0.5 },
  ], 0, mem, first);
  assert.equal(lines.length, 4);
  assert.equal(narrate([{ type: 'landmark_near', id: 'wreck' }], 1, mem, first).length, 0);
});

test('events without lines are silent', () => {
  const mem = createNarrationMemory();
  assert.deepEqual(narrate([{ type: 'arrived' }, { type: 'landmark_near', id: 'nope' }], 0, mem, first), []);
});

test('only the first lightning is narrated', () => {
  const mem = createNarrationMemory();
  const bolts = [{ type: 'lightning', x: 0, z: 0, distance: 900, power: 0.8 }];
  assert.equal(narrate(bolts, 0, mem, first).length, 1);
  assert.equal(narrate(bolts, 300, mem, first).length, 0);
});

test('rng picks among a table entry\'s lines', () => {
  const lines = NARRATION.strayed.lines;
  const [line] = narrate([{ type: 'strayed' }], 0, createNarrationMemory(), () => 0.999);
  assert.equal(line, '✦ ' + lines[lines.length - 1]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --test tests/narration.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `frontend/worlds/sea/narration.js`:

```js
// ── FILE: worlds/sea/narration.js ────────────────────────
// Voyage events → log lines. Pure: returns lines; SeaRealm calls log().
// `once` entries speak a single time per voyage (per id/level); `cooldown`
// entries speak at most once every N seconds. Events with no entry are silent.

export const NARRATION = {
  departure: { once: true, lines: [
    'The Delta lets go of you. The sea does not ask your name. It asks for nothing. That is how you know it will take everything.',
  ]},
  first_swell: { once: true, lines: [
    'The first swell lifts the hull and sets it down again, gently, the way a creditor first says hello.',
    'Open water. The river had banks. The sea has terms and conditions.',
  ]},
  strayed: { cooldown: 45, lines: [
    'You leave the course. The wind notices. The wind files a report.',
    'Off the line. The sea does not forbid it. It simply charges more.',
    'Wander if you like. Every heading on this water was sold to someone before you.',
  ]},
  in_irons: { cooldown: 30, lines: [
    'The sail hangs slack, pointed straight at the wind. You have found the one direction nothing will pay for.',
    'In irons. The ship waits for you to stop arguing with the weather.',
  ]},
  storm_rising: { once: true, byLevel: {
    0.3: ['The clouds ahead thicken, like a ledger nobody wants to open.'],
    0.5: ['The swell climbs. Spray reaches the pharaoh at the prow. The pharaoh does not bow.'],
    0.7: ['The storm leans over the water. It has been expecting you for some time.'],
  }},
  landmark_near: { once: true, byId: {
    wreck:       ['A ship lies half-sunk, pots still bobbing around it. A previous voyage. Also paid in full.'],
    signal_rock: ['A fire gutters on a lone rock. Someone is still keeping it lit. No one has told them it is over.'],
    bull_horns:  ['Stone horns rise from a reef — a bull, carved by people who respect bulls far too much.'],
  }},
  crete_clearer: { once: true, lines: [
    'The shape on the horizon sharpens into a mountain. An island. Something about it is waiting.',
  ]},
  lightning: { once: true, lines: [
    'Lightning walks across the water ahead. The thunder takes its time. It knows you are coming to it.',
  ]},
};

export function createNarrationMemory() {
  return { last: {}, done: {} };
}

function _key(evt) {
  return evt.type + (evt.id != null ? ':' + evt.id : '') + (evt.level != null ? ':' + evt.level : '');
}

export function narrate(events, now, memory, rng = Math.random) {
  const out = [];
  for (const evt of events) {
    const entry = NARRATION[evt.type];
    if (!entry) continue;
    const lines = entry.byId ? entry.byId[evt.id] : entry.byLevel ? entry.byLevel[evt.level] : entry.lines;
    if (!lines || lines.length === 0) continue;
    if (entry.once) {
      const key = _key(evt);
      if (memory.done[key]) continue;
      memory.done[key] = true;
    }
    if (entry.cooldown) {
      const last = memory.last[evt.type];
      if (last != null && now - last < entry.cooldown) continue;
      memory.last[evt.type] = now;
    }
    out.push('✦ ' + lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))]);
  }
  return out;
}
```

Note: `lightning` events carry `x/z/distance/power` but no `id`/`level`, so their once-key is just `lightning` — only the first strike speaks.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && node --test tests/narration.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/sea/narration.js frontend/tests/narration.test.js
git commit -m "feat(sea): voyage narration table with once/cooldown rules"
```

---

### Task 5: Chase camera math and perf fallback (`chasecam.js`, `perf.js`)

**Files:**
- Create: `frontend/worlds/sea/chasecam.js`
- Create: `frontend/worlds/sea/perf.js`
- Test: `frontend/tests/chasecam.test.js`, `frontend/tests/perf.test.js`

**Interfaces:**
- Consumes: `VoyageState` fields `x, z, heading, speed, hull.y, hull.roll` (Task 2/3).
- Produces:
  - `CHASE`, `createChaseCam() → Cam`, `chaseTarget(v) → {x,y,z,lookX,lookY,lookZ}`, `springAxis(pos, vel, target, omega, dt) → [pos, vel]`, `stepChaseCam(cam, v, dt) → Cam` where `Cam = {ready,x,y,z,vx,vy,vz,lookX,lookY,lookZ,roll,fov}`
  - `createPerfMonitor({thresholdMs?, windowSec?, chunkSec?}) → { sample(frameMs) → boolean, fired:boolean }` — `sample` returns `true` exactly once, when degradation should happen.

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/chasecam.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHASE, createChaseCam, chaseTarget, springAxis, stepChaseCam } from '../worlds/sea/chasecam.js';

const ship = (over = {}) => ({ x: 0, z: 0, heading: 0, speed: 0, hull: { y: 0, roll: 0 }, ...over });

test('the spring approaches a still target without overshoot', () => {
  let pos = 10, vel = 0, prev = pos;
  for (let i = 0; i < 240; i++) {
    [pos, vel] = springAxis(pos, vel, 0, CHASE.omega, 1 / 60);
    assert.ok(pos >= 0, 'overshot');
    assert.ok(pos <= prev + 1e-12, 'not monotone');
    prev = pos;
  }
  assert.ok(pos < 0.05, `after 4 s: ${pos}`);
});

test('the spring is frame-rate independent', () => {
  let a = [10, 0], b = [10, 0];
  for (let i = 0; i < 120; i++) a = springAxis(a[0], a[1], 0, CHASE.omega, 1 / 30);
  for (let i = 0; i < 240; i++) b = springAxis(b[0], b[1], 0, CHASE.omega, 1 / 60);
  assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
});

test('the camera sits behind and above the stern, looking past the bow', () => {
  const t = chaseTarget(ship({ heading: 0 }));           // bow points +z
  assert.ok(Math.abs(t.z + CHASE.back) < 1e-9 && Math.abs(t.x) < 1e-9);
  assert.equal(t.y, CHASE.up);
  assert.ok(Math.abs(t.lookZ - CHASE.lookAhead) < 1e-9);
});

test('first step snaps to the target; roll and fov follow the ship', () => {
  const cam = createChaseCam();
  const v = ship({ x: 5, z: 7, speed: 10, hull: { y: 1, roll: 0.5 } });
  stepChaseCam(cam, v, 1 / 60);
  const t = chaseTarget(v);
  assert.equal(cam.x, t.x); assert.equal(cam.z, t.z);
  assert.ok(Math.abs(cam.roll - 0.5 * CHASE.rollShare) < 1e-12);
  assert.ok(cam.fov > CHASE.fovBase);
});
```

Create `frontend/tests/perf.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerfMonitor } from '../worlds/sea/perf.js';

const run = (mon, frameMs, seconds) => {
  let fires = 0;
  for (let t = 0; t < seconds * 1000; t += frameMs) if (mon.sample(frameMs)) fires++;
  return fires;
};

test('a healthy 60 fps never degrades', () => {
  assert.equal(run(createPerfMonitor(), 16.7, 30), 0);
});

test('sustained slow frames degrade exactly once', () => {
  const mon = createPerfMonitor();
  assert.equal(run(mon, 40, 10), 1);
  assert.equal(mon.fired, true);
  assert.equal(run(mon, 40, 10), 0);
});

test('a brief slowdown followed by recovery does not degrade', () => {
  const mon = createPerfMonitor();
  run(mon, 40, 2);
  run(mon, 16.7, 2);
  assert.equal(run(mon, 40, 2), 0);
});

test('tab-switch hitches are ignored', () => {
  const mon = createPerfMonitor();
  for (let i = 0; i < 20; i++) assert.equal(mon.sample(2000), false);
  assert.equal(mon.fired, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && node --test tests/chasecam.test.js tests/perf.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

Create `frontend/worlds/sea/chasecam.js`:

```js
// ── FILE: worlds/sea/chasecam.js ─────────────────────────
// Chase-camera math — pure. A critically damped spring solved EXACTLY per
// frame (not integrated), so it is frame-rate independent and never
// overshoots a still target. scene.js copies the result onto a three camera.

export const CHASE = {
  back: 16, up: 7,             // m behind / above the hull
  lookAhead: 14, lookUp: 2.5,  // look target ahead of the bow
  omega: 2.2,                  // spring stiffness (rad/s) — lower = lazier lag on turns
  rollShare: 0.2,              // share of the ship's roll the camera takes
  fovBase: 52, fovPerSpeed: 0.6,
};

export function createChaseCam() {
  return { ready: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
           lookX: 0, lookY: 0, lookZ: 0, roll: 0, fov: CHASE.fovBase };
}

export function chaseTarget(v) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  return {
    x: v.x - fx * CHASE.back, y: v.hull.y + CHASE.up, z: v.z - fz * CHASE.back,
    lookX: v.x + fx * CHASE.lookAhead, lookY: v.hull.y + CHASE.lookUp, lookZ: v.z + fz * CHASE.lookAhead,
  };
}

/** Exact critically damped step toward `target`: δ(t) = (δ0 + (v0 + ωδ0)t)·e^(−ωt). */
export function springAxis(pos, vel, target, omega, dt) {
  const delta = pos - target;
  const tmp   = (vel + omega * delta) * dt;
  const e     = Math.exp(-omega * dt);
  return [target + (delta + tmp) * e, (vel - omega * tmp) * e];
}

export function stepChaseCam(cam, v, dt) {
  const t = chaseTarget(v);
  if (!cam.ready) {
    Object.assign(cam, { ready: true, x: t.x, y: t.y, z: t.z, vx: 0, vy: 0, vz: 0 });
  } else {
    [cam.x, cam.vx] = springAxis(cam.x, cam.vx, t.x, CHASE.omega, dt);
    [cam.y, cam.vy] = springAxis(cam.y, cam.vy, t.y, CHASE.omega, dt);
    [cam.z, cam.vz] = springAxis(cam.z, cam.vz, t.z, CHASE.omega, dt);
  }
  cam.lookX = t.lookX; cam.lookY = t.lookY; cam.lookZ = t.lookZ;
  cam.roll = v.hull.roll * CHASE.rollShare;
  cam.fov  = CHASE.fovBase + CHASE.fovPerSpeed * v.speed;
  return cam;
}
```

Create `frontend/worlds/sea/perf.js`:

```js
// ── FILE: worlds/sea/perf.js ─────────────────────────────
// One-shot quality fallback. Averages frame time over half-second chunks; if
// the average stays above thresholdMs for windowSec, sample() returns true
// once (scene.js then halves the ocean grid and drops rain). Frames > 250 ms
// are tab switches / hitches and ignored.

export function createPerfMonitor({ thresholdMs = 25, windowSec = 3, chunkSec = 0.5 } = {}) {
  let chunkMs = 0, frames = 0, overSec = 0, fired = false;
  return {
    get fired() { return fired; },
    sample(frameMs) {
      if (fired || !(frameMs > 0) || frameMs > 250) return false;
      chunkMs += frameMs; frames++;
      if (chunkMs < chunkSec * 1000) return false;
      overSec = (chunkMs / frames > thresholdMs) ? overSec + chunkMs / 1000 : 0;
      chunkMs = 0; frames = 0;
      if (overSec < windowSec) return false;
      fired = true;
      return true;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && node --test tests/chasecam.test.js tests/perf.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/sea/chasecam.js frontend/worlds/sea/perf.js frontend/tests/chasecam.test.js frontend/tests/perf.test.js
git commit -m "feat(sea): exact critically-damped chase cam + one-shot perf fallback"
```

---

### Task 6: Fire a portal from code (`PortalRegistry.use`)

**Files:**
- Modify: `frontend/engine/portal.js`
- Test: `frontend/tests/portal.test.js`

**Interfaces:**
- Consumes: `RealmManager` (`engine/realm.js`, existing).
- Produces: `PortalRegistry.use(fromId, toId) → boolean` — fires the registered edge (condition → `onUse` → transition or instant swap); `false` if unregistered or its condition fails. `handleKey` behaviour is unchanged.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/portal.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PortalRegistry } from '../engine/portal.js';
import { RealmManager } from '../engine/realm.js';

const fakeRealm = (id) => ({ id, onEnter() {}, onExit() {} });

beforeEach(() => {
  PortalRegistry._portals = [];
  RealmManager._realms = {};
  RealmManager._transition = null;
  RealmManager.register(fakeRealm('a')).register(fakeRealm('b'));
  RealmManager.currentId = 'a';
});

test('use fires a registered key-less edge immediately', () => {
  let used = 0;
  PortalRegistry.register({ from: 'a', to: 'b', key: null, onUse: () => used++ });
  assert.equal(PortalRegistry.use('a', 'b'), true);
  assert.equal(RealmManager.currentId, 'b');
  assert.equal(used, 1);
});

test('use refuses an edge that is not registered', () => {
  assert.equal(PortalRegistry.use('a', 'b'), false);
  assert.equal(RealmManager.currentId, 'a');
});

test('use respects the edge condition', () => {
  let open = false;
  PortalRegistry.register({ from: 'a', to: 'b', key: null, condition: () => open });
  assert.equal(PortalRegistry.use('a', 'b'), false);
  open = true;
  assert.equal(PortalRegistry.use('a', 'b'), true);
});

test('use schedules an animated transition when the edge has one', () => {
  PortalRegistry.register({ from: 'a', to: 'b', key: null, transition: () => {}, duration: 500 });
  assert.equal(PortalRegistry.use('a', 'b'), true);
  assert.equal(RealmManager.isTransitioning, true);
  assert.equal(RealmManager.currentId, 'a');
});

test('handleKey still fires keyed edges', () => {
  PortalRegistry.register({ from: 'a', to: 'b', key: 'ArrowUp' });
  assert.equal(PortalRegistry.handleKey('ArrowUp', 'a'), true);
  assert.equal(RealmManager.currentId, 'b');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --test tests/portal.test.js`
Expected: FAIL — `PortalRegistry.use is not a function` (the `handleKey` test passes).

- [ ] **Step 3: Implement**

In `frontend/engine/portal.js`, replace the body of `handleKey`'s firing block

```js
      p.onUse?.();
      if (p.transition) {
        RealmManager.scheduleTransition(p.toId, { duration: p.duration, render: p.transition });
      } else {
        RealmManager.transitionTo(p.toId);
      }
      return true;
```

with

```js
      this._fire(p);
      return true;
```

and add these two methods after `handleKey` (before `exitsFrom`):

```js
  /**
   * Fire a registered edge from code — for exits chosen in a dialogue rather
   * than by a key (e.g. boarding the ship at the Nile Delta).
   * Returns false if the edge isn't registered or its condition fails.
   *
   * @param {string} fromId  source realm id
   * @param {string} toId    destination realm id
   */
  use(fromId, toId) {
    const p = this._portals.find(q => q.fromId === fromId && q.toId === toId);
    if (!p || (p.condition && !p.condition())) return false;
    this._fire(p);
    return true;
  },

  _fire(p) {
    p.onUse?.();
    if (p.transition) {
      RealmManager.scheduleTransition(p.toId, { duration: p.duration, render: p.transition });
    } else {
      RealmManager.transitionTo(p.toId);
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && node --test tests/*.test.js`
Expected: PASS (whole suite)

- [ ] **Step 5: Commit**

```bash
git add frontend/engine/portal.js frontend/tests/portal.test.js
git commit -m "feat(engine): PortalRegistry.use — fire a registered edge from code"
```

---
### Task 7: Look-dev I — ocean, sky, chase cam (INLINE-ONLY: Artifact + user screenshots)

**Files:**
- Create: `frontend/worlds/sea/gfx/sky.js`
- Create: `frontend/worlds/sea/gfx/ocean.js`
- Create: `frontend/worlds/sea/scene.js`
- Create: `tools/sea-lookdev/index.html` (throwaway harness; deleted in Task 15)

**Interfaces:**
- Consumes: `glslWaves` (Task 1); `COURSE_HEADING, courseToWorld, WAKE` (Task 2); `createVoyage, stepVoyage` + `VoyageState` (Tasks 2–3); `createChaseCam, stepChaseCam`, `createPerfMonitor` (Task 5).
- Produces:
  - `sky.js`: `SKY_GLSL` (defines uniforms `uWindAngle, uStorm, uFlash, uFlashDir, uSkyTime` and functions `skyBase(dir)`, `skyColorCheap(dir)`, `skyColor(dir)`, `fbm(p)`), `createSky(windAngle) → { mesh, update(camera, v, flash, flashDir) }`
  - `ocean.js`: `createOcean(windAngle, { grid? }) → { mesh, update(camera, v, flash, flashDir), degrade() }`
  - `scene.js`: `createSeaScene(canvas, { windAngle }) → { render(v, dt), flash(evt), dispose() }`, `VIEW_W = 780`, `VIEW_H = 540`

- [ ] **Step 1: Write `gfx/sky.js`**

```js
// ── FILE: worlds/sea/gfx/sky.js ──────────────────────────
// Dusk sky dome + storm clouds. SKY_GLSL is shared with the ocean shader so
// reflections and fog use the same colours as the dome.

import * as THREE from 'three';

export const SKY_GLSL = /* glsl */`
uniform float uWindAngle;
uniform float uStorm;
uniform float uFlash;
uniform vec3  uFlashDir;
uniform float uSkyTime;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// +1 looking toward Crete (downwind), -1 looking back toward Egypt.
float aheadness(vec3 dir) {
  return dot(normalize(dir.xz + vec2(1e-5)), vec2(sin(uWindAngle), cos(uWindAngle)));
}

vec3 skyBase(vec3 dir) {
  float ahead = aheadness(dir);
  vec3 amber  = vec3(0.62, 0.30, 0.14);
  vec3 bruise = vec3(0.30, 0.16, 0.20);
  vec3 slate  = vec3(0.10, 0.12, 0.16);
  vec3 indigo = vec3(0.03, 0.035, 0.07);
  // The amber band behind you narrows as the storm rises.
  float band = 1.0 - smoothstep(-0.9, 0.1 + 0.5 * uStorm, ahead);
  vec3 horizon = mix(slate, mix(bruise, amber, band), band);
  vec3 col = mix(horizon, indigo, pow(clamp(dir.y, 0.0, 1.0), 0.45));
  return col * (1.0 - 0.35 * uStorm);
}

float cloudCover(vec3 dir) {
  float ahead = aheadness(dir);
  return clamp(mix(0.25, 0.85, uStorm) * smoothstep(-0.5, 0.7, ahead) + 0.45 * uStorm, 0.0, 1.0);
}

// Cheap version for ocean reflections and fog — no per-pixel noise.
vec3 skyColorCheap(vec3 dir) {
  vec3 col = mix(skyBase(dir), vec3(0.08, 0.085, 0.10), cloudCover(dir) * 0.7);
  float lit = pow(max(dot(dir, uFlashDir), 0.0), 6.0) * uFlash;
  return col + vec3(0.75, 0.8, 1.0) * lit * 0.8 + vec3(0.5, 0.55, 0.7) * uFlash * 0.06;
}

vec3 skyColor(vec3 dir) {
  float up = max(dir.y, 0.0);
  float ahead = aheadness(dir);
  vec2 wind = vec2(sin(uWindAngle), cos(uWindAngle));
  vec2 uv = dir.xz / (up + 0.12) * 0.9 + wind * uSkyTime * 0.012;
  float cover = cloudCover(dir);
  float d = smoothstep(1.0 - cover, 1.0 - cover + 0.35, fbm(uv));
  // The anvil: one towering mass low over Crete.
  float anvil = smoothstep(0.93, 1.0, ahead) * (1.0 - smoothstep(0.0, 0.32 + 0.1 * fbm(dir.xz * 6.0), up));
  d = clamp(max(d, anvil * (0.6 + 0.4 * fbm(dir.xz * 9.0 + uSkyTime * 0.01))), 0.0, 1.0);
  vec3 cloud = mix(vec3(0.05, 0.055, 0.07), vec3(0.16, 0.15, 0.17), fbm(uv * 1.7));
  cloud += vec3(0.75, 0.8, 1.0) * pow(max(dot(dir, uFlashDir), 0.0), 6.0) * uFlash * 1.6;
  vec3 col = mix(skyBase(dir), cloud, d);
  col += vec3(0.5, 0.55, 0.7) * uFlash * 0.06;
  // At the horizon, converge on the cheap colour so ocean fog meets the dome seamlessly.
  return mix(skyColorCheap(dir), col, smoothstep(0.0, 0.08, dir.y));
}
`;

export function createSky(windAngle) {
  const uniforms = {
    uWindAngle: { value: windAngle }, uStorm: { value: 0.1 }, uFlash: { value: 0 },
    uFlashDir: { value: new THREE.Vector3(0, 1, 0) }, uSkyTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;   // pinned to the far plane
      }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    update(camera, v, flash, flashDir) {
      mesh.position.copy(camera.position);
      uniforms.uStorm.value = v.storm;
      uniforms.uSkyTime.value = v.t;
      uniforms.uFlash.value = flash;
      uniforms.uFlashDir.value.copy(flashDir);
    },
  };
}
```

- [ ] **Step 2: Write `gfx/ocean.js`**

```js
// ── FILE: worlds/sea/gfx/ocean.js ────────────────────────
// The ocean: a camera-following, centre-dense grid displaced by the GENERATED
// Gerstner function (waves.js), shaded with Fresnel sky reflection, crest glow,
// crest + wake foam, lightning glints, and fog into the horizon colour.

import * as THREE from 'three';
import { glslWaves } from '../waves.js';
import { SKY_GLSL } from './sky.js';
import { WAKE } from '../constants.js';

const EXTENT = 4200;   // grid half-size (m)
const SNAP   = 4;      // the grid moves with the camera in whole steps of this

/** (n+1)² vertices; spacing ≈1.2 m under the camera growing to ≈60 m at the edge. */
function buildGrid(n) {
  const pos  = new Float32Array((n + 1) * (n + 1) * 3);
  const warp = (u) => Math.sign(u) * (0.04 * Math.abs(u) + 0.96 * Math.pow(Math.abs(u), 2.6)) * EXTENT;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = (j * (n + 1) + i) * 3;
      pos[k] = warp(i / n * 2 - 1); pos[k + 1] = 0; pos[k + 2] = warp(j / n * 2 - 1);
    }
  }
  const idx = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createOcean(windAngle, { grid = 280 } = {}) {
  const uniforms = {
    uTime: { value: 0 }, uStorm: { value: 0.1 }, uSkyTime: { value: 0 },
    uWindAngle: { value: windAngle }, uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector3(0, 1, 0) },
    uOffset: { value: new THREE.Vector2() }, uCamPos: { value: new THREE.Vector3() }, uShip: { value: new THREE.Vector2() },
    uDeep:  { value: new THREE.Color(0.004, 0.020, 0.028) },
    uCrest: { value: new THREE.Color(0.030, 0.160, 0.140) },
    uWake:  { value: Array.from({ length: WAKE.max }, () => new THREE.Vector3(0, 1e4, 1e4)) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: glslWaves(windAngle) + /* glsl */`
      uniform vec2 uOffset;
      uniform vec3 uCamPos;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vFold;
      void main() {
        vec2 p = position.xz + uOffset;
        float atten = 1.0 - smoothstep(900.0, 3600.0, length(p - uCamPos.xz));
        vec3 N; float fold;
        vec3 w = gerstner(p, atten, N, fold);
        vWorld = w; vNormal = N; vFold = fold;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      uniform vec3 uCamPos;
      uniform vec3 uDeep;
      uniform vec3 uCrest;
      uniform vec2 uShip;
      uniform vec3 uWake[${WAKE.max}];
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vFold;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 toCam = uCamPos - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);

        // Body colour: near-black depths, a green-teal glow through high crests.
        vec3 col = mix(uDeep, uCrest, clamp(vWorld.y / (0.8 + 2.5 * uStorm), 0.0, 1.0) * 0.7);
        col = mix(col, skyColorCheap(R), fres);
        col += vec3(0.8, 0.85, 1.0) * pow(max(dot(R, uFlashDir), 0.0), 80.0) * uFlash * 2.5;

        // Crest foam where the surface pinches (fold < 1), broken up by noise.
        float foam = clamp((0.86 - vFold) / 0.22, 0.0, 1.0)
                   * smoothstep(0.35, 0.75, fbm(vWorld.xz * 0.22 + uSkyTime * 0.05));
        // Wake foam along the ship's recent track (z = seconds since laid).
        if (length(vWorld.xz - uShip) < 140.0) {
          for (int i = 0; i < ${WAKE.max}; i++) {
            float age = uWake[i].z;
            float d = length(vWorld.xz - uWake[i].xy);
            foam = max(foam, (1.0 - smoothstep(1.5 + age * 0.45, 3.0 + age * 0.9, d)) * exp(-age * 0.18) * 0.85);
          }
        }
        col = mix(col, vec3(0.62, 0.66, 0.68), foam);

        // Fog into the horizon colour in this exact direction.
        float fog = 1.0 - exp(-pow(dist * (0.00032 + 0.0005 * uStorm), 1.5));
        col = mix(col, skyColorCheap(normalize(vec3(-V.x, 0.015, -V.z))), clamp(fog, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(buildGrid(grid), material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;

  return {
    mesh,
    update(camera, v, flash, flashDir) {
      uniforms.uOffset.value.set(Math.round(camera.position.x / SNAP) * SNAP, Math.round(camera.position.z / SNAP) * SNAP);
      uniforms.uCamPos.value.copy(camera.position);
      uniforms.uTime.value = v.t;
      uniforms.uSkyTime.value = v.t;
      uniforms.uStorm.value = v.storm;
      uniforms.uFlash.value = flash;
      uniforms.uFlashDir.value.copy(flashDir);
      uniforms.uShip.value.set(v.x, v.z);
      for (let i = 0; i < WAKE.max; i++) {
        const w = v.wake[v.wake.length - 1 - i];
        if (w) uniforms.uWake.value[i].set(w.x, w.z, v.t - w.t);
        else   uniforms.uWake.value[i].set(0, 1e4, 1e4);
      }
    },
    degrade() {
      mesh.geometry.dispose();
      mesh.geometry = buildGrid(Math.floor(grid / 2));
    },
  };
}
```

- [ ] **Step 3: Write `scene.js`** (placeholder ship box until Task 9)

```js
// ── FILE: worlds/sea/scene.js ────────────────────────────
// THE SEA's three.js scene. Loaded lazily (dynamic import) by SeaRealm and by
// the look-dev harness — never at boot. Reads voyage state; owns no game logic.

import * as THREE from 'three';
import { createSky }         from './gfx/sky.js';
import { createOcean }       from './gfx/ocean.js';
import { createChaseCam, stepChaseCam } from './chasecam.js';
import { createPerfMonitor } from './perf.js';

export const VIEW_W = 780;
export const VIEW_H = 540;

export function createSeaScene(canvas, { windAngle }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(VIEW_W, VIEW_H);                 // also pins the CSS size to 780×540
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, VIEW_W / VIEW_H, 0.5, 9000);

  const sky   = createSky(windAngle);
  const ocean = createOcean(windAngle);
  scene.add(sky.mesh, ocean.mesh);

  // A low amber sun behind (toward Egypt) and a cold sky fill.
  scene.add(new THREE.HemisphereLight(0x3a4260, 0x0a0c10, 0.9));
  const sun = new THREE.DirectionalLight(0xffa060, 0.8);
  scene.add(sun, sun.target);

  // PLACEHOLDER ship — replaced by gfx/ship.js in Task 9.
  const ship = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2, 18), new THREE.MeshStandardMaterial({ color: 0x8a7a3a }));
  scene.add(ship);

  const cam     = createChaseCam();
  const perf    = createPerfMonitor();
  const noFlash = new THREE.Vector3(0, 1, 0);
  let last = performance.now();

  return {
    render(v, dt) {
      const now = performance.now();
      if (perf.sample(now - last)) ocean.degrade();
      last = now;

      stepChaseCam(cam, v, dt);
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
      camera.rotateZ(cam.roll);
      if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }

      sun.position.set(v.x - Math.sin(windAngle) * 800, 90, v.z - Math.cos(windAngle) * 800);
      sun.target.position.set(v.x, 0, v.z);

      ship.position.set(v.x, v.hull.y, v.z);
      ship.rotation.set(-v.hull.pitch, v.heading, v.hull.roll, 'YXZ');

      sky.update(camera, v, 0, noFlash);
      ocean.update(camera, v, 0, noFlash);
      renderer.render(scene, camera);
    },
    flash() {},
    dispose() { renderer.dispose(); },
  };
}
```

- [ ] **Step 4: Syntax-check the three.js modules**

Run: `cd frontend && node --check worlds/sea/scene.js && node --check worlds/sea/gfx/sky.js && node --check worlds/sea/gfx/ocean.js && echo ok`
Expected: `ok` (`--check` parses only; the bare `three` specifier is not resolved)

- [ ] **Step 5: Load the artifact-design skill**

The Artifact tool requires invoking the `artifact-design` skill before writing the page. This is an internal dev tool — commit to a single dark look, minimal chrome.

- [ ] **Step 6: Write the harness `tools/sea-lookdev/index.html`**

```html
<title>Sea Lookdev</title>
<style>
  :root { --bg:#0b0e13; --fg:#c9d2dc; --muted:#7d8894; --line:#232a33; --accent:#d9a441; }
  body { background:var(--bg); color:var(--fg); font:13px/1.4 ui-monospace, Menlo, monospace; padding-inline:16px; padding-block:16px; }
  h1 { font-size:14px; margin:0 0 8px; color:var(--accent); letter-spacing:.08em; }
  .stage { overflow-x:auto; }
  #gl { display:block; border:1px solid var(--line); outline:none; }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:10px; }
  button { background:#151a21; color:var(--fg); border:1px solid var(--line); padding:6px 10px; font:inherit; cursor:pointer; }
  button:hover { border-color:var(--accent); }
  label { display:inline-flex; gap:6px; align-items:center; }
  #hud { color:var(--muted); white-space:pre-wrap; margin-top:8px; }
</style>
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js" } }</script>

<h1>SEA LOOKDEV — click the view, then ← → steer · ↑ ↓ sail</h1>
<div class="stage"><canvas id="gl" width="780" height="540" tabindex="0"></canvas></div>
<div class="row">
  <label>storm <input id="storm" type="range" min="0" max="1" step="0.01" value="0.1"></label>
  <label><input id="auto" type="checkbox" checked> follow voyage</label>
  <button data-along="0">Delta</button>
  <button data-along="500">Wreck</button>
  <button data-along="1150">Signal rock</button>
  <button data-along="1750">Bull horns</button>
  <button data-along="2150">Bay approach</button>
  <button id="bolt">⚡ Strike</button>
</div>
<div id="hud"></div>

<script type="module">
  import { createVoyage, stepVoyage } from './sea/voyage.js';
  import { COURSE_HEADING, courseToWorld } from './sea/constants.js';
  import { createSeaScene } from './sea/scene.js';

  const canvas = document.getElementById('gl');
  const storm = document.getElementById('storm');
  const auto = document.getElementById('auto');
  const hud = document.getElementById('hud');
  const keys = {};
  canvas.addEventListener('keydown', e => { keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); });
  canvas.addEventListener('keyup', e => { keys[e.key] = false; });

  const v = createVoyage();
  let sea;
  try { sea = createSeaScene(canvas, { windAngle: COURSE_HEADING }); }
  catch (err) { hud.textContent = 'Scene failed: ' + err.message; throw err; }

  document.querySelectorAll('[data-along]').forEach(b => b.addEventListener('click', () => {
    const p = courseToWorld(Number(b.dataset.along), 0);
    Object.assign(v, { x: p.x, z: p.z, heading: COURSE_HEADING, arrived: false });
    canvas.focus();
  }));
  document.getElementById('bolt').addEventListener('click', () => {
    const x = v.x + Math.sin(v.heading) * 900, z = v.z + Math.cos(v.heading) * 900;
    sea.flash({ type: 'lightning', x, z, distance: 900, power: 1 });
    canvas.focus();
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const input = {
      steer: (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0),
      trim:  (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0),
    };
    const events = stepVoyage(v, input, dt);
    if (auto.checked) storm.value = v.storm.toFixed(2); else v.storm = Number(storm.value);
    for (const e of events) if (e.type === 'lightning') sea.flash(e);
    sea.render(v, dt);
    hud.textContent = `speed ${v.speed.toFixed(1)} m/s · sail ${Math.round(v.sail * 100)}% · storm ${v.storm.toFixed(2)} · t ${v.t.toFixed(0)} s ${v.arrived ? '· ARRIVED' : ''}`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
</script>
```

- [ ] **Step 7: Publish the look-dev Artifact**

Call the Artifact tool:
- `file_path`: `tools/sea-lookdev/index.html`
- `favicon`: `🌊`
- `description`: `Look-dev harness for THE SEA realm — steer the ship and tune the ocean, sky and storm.`
- `files`:
```json
{
  "sea/waves.js":     "frontend/worlds/sea/waves.js",
  "sea/constants.js": "frontend/worlds/sea/constants.js",
  "sea/voyage.js":    "frontend/worlds/sea/voyage.js",
  "sea/chasecam.js":  "frontend/worlds/sea/chasecam.js",
  "sea/perf.js":      "frontend/worlds/sea/perf.js",
  "sea/scene.js":     "frontend/worlds/sea/scene.js",
  "sea/gfx/sky.js":   "frontend/worlds/sea/gfx/sky.js",
  "sea/gfx/ocean.js": "frontend/worlds/sea/gfx/ocean.js"
}
```
If the page shows "Scene failed", read the message, fix, republish (same `file_path`).

- [ ] **Step 8: CHECKPOINT — user screenshot loop**

Ask the user to open the artifact link and send screenshots of: (a) the Delta with "follow voyage" on; (b) storm slider at 0.5; (c) storm slider at 0.9; (d) steering hard left for ~5 s. Iterate on what they report — the tuning surface is: sky colours in `skyBase` (amber/bruise/slate/indigo), `uDeep`/`uCrest`, foam threshold `0.86`/`0.22`, fog density `0.00032 + 0.0005 * uStorm`, `renderer.toneMappingExposure`, `CHASE` in `chasecam.js`, and `WAVES`/`AMP_GAIN` in `waves.js`. After every edit to a wave or chase-cam module, re-run `cd frontend && node --test tests/*.test.js` (tuning must not break the tests), then republish. Continue only when the user says the ocean + sky look right.

- [ ] **Step 9: Commit**

```bash
git add frontend/worlds/sea/scene.js frontend/worlds/sea/gfx/sky.js frontend/worlds/sea/gfx/ocean.js tools/sea-lookdev/index.html frontend/worlds/sea/waves.js frontend/worlds/sea/chasecam.js
git commit -m "feat(sea): WebGL ocean + dusk sky + chase cam, tuned via look-dev harness"
```

---
### Task 8: Look-dev II — lightning and rain (INLINE-ONLY: Artifact + user screenshots)

**Files:**
- Create: `frontend/worlds/sea/gfx/storm.js`
- Modify: `frontend/worlds/sea/scene.js`
- Modify: `tools/sea-lookdev/index.html` (republish only; no code change needed)

**Interfaces:**
- Consumes: lightning events `{x, z, distance, power}` (Task 3); `VoyageState.storm, t, windAngle`; `createSky/createOcean.update(camera, v, flash, flashDir)` (Task 7).
- Produces: `createStorm({ rng? }) → { group, flashDir: THREE.Vector3, flashLevel: number (getter), flash(evt), update(dt, v, camera), disableRain() }`. `createSeaScene(...).flash(evt)` now shows the strike.

- [ ] **Step 1: Write `gfx/storm.js`**

```js
// ── FILE: worlds/sea/gfx/storm.js ────────────────────────
// Lightning (flash envelope, a cold directional light, jagged bolts for near
// strikes) and wind-slanted rain in a box that follows the camera.

import * as THREE from 'three';

const RAIN_COUNT = 1400;
const RAIN_BOX   = 60;      // half-size (m) of the rain volume around the camera
const BOLT_NEAR  = 1800;    // strikes closer than this draw a visible bolt

function boltGeometry(x, z, rng) {
  let pts = [new THREE.Vector3(x + (rng() - 0.5) * 200, 900, z + (rng() - 0.5) * 200), new THREE.Vector3(x, 0, z)];
  for (let level = 0; level < 6; level++) {           // midpoint displacement → a jagged bolt
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const mid = a.clone().lerp(b, 0.5);
      const jitter = a.distanceTo(b) * 0.18;
      mid.x += (rng() - 0.5) * jitter;
      mid.z += (rng() - 0.5) * jitter;
      next.push(mid, b);
    }
    pts = next;
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export function createStorm({ rng = Math.random } = {}) {
  const group = new THREE.Group();

  // ── Rain: line segments wrapped inside a camera-centred box ──
  const rainPos = new Float32Array(RAIN_COUNT * 6);
  const seeds   = new Float32Array(RAIN_COUNT * 3);
  for (let i = 0; i < RAIN_COUNT; i++) {
    seeds[i * 3]     = rng() * RAIN_BOX * 2 - RAIN_BOX;
    seeds[i * 3 + 1] = rng() * RAIN_BOX;
    seeds[i * 3 + 2] = rng() * RAIN_BOX * 2 - RAIN_BOX;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0x9aa4b4, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);

  // ── Lightning ──
  const flashLight = new THREE.DirectionalLight(0xc8d4ff, 0);
  group.add(flashLight, flashLight.target);
  const flashDir = new THREE.Vector3(0, 1, 0);
  const flashes = [];          // { t0, power, x, z, bolt }
  let clock = 0, flashLevel = 0, rainEnabled = true;

  const wrap = (v, size) => ((v % size) + size * 1.5) % size - size / 2;

  return {
    group, flashDir,
    get flashLevel() { return flashLevel; },

    disableRain() { rainEnabled = false; rain.visible = false; },

    flash(evt) {
      const f = { t0: clock, power: evt.power, x: evt.x, z: evt.z, bolt: null };
      if (evt.distance < BOLT_NEAR) {
        f.bolt = new THREE.Line(boltGeometry(evt.x, evt.z, rng),
          new THREE.LineBasicMaterial({ color: 0xeef2ff, transparent: true, opacity: 1 }));
        f.bolt.frustumCulled = false;
        group.add(f.bolt);
      }
      flashes.push(f);
    },

    update(dt, v, camera) {
      clock += dt;

      // Flash envelope: a strike, a flicker ~160 ms later, then a fade.
      flashLevel = 0;
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i], age = clock - f.t0;
        const env = f.power * (Math.exp(-age / 0.09) + 0.6 * Math.exp(-Math.abs(age - 0.16) / 0.05));
        if (env > flashLevel) {
          flashLevel = env;
          flashDir.set(f.x - camera.position.x, 350, f.z - camera.position.z).normalize();
        }
        if (f.bolt) f.bolt.material.opacity = age < 0.22 ? (Math.sin(age * 90) > -0.3 ? 1 : 0.2) : 0;
        if (age > 1.2) {
          if (f.bolt) { group.remove(f.bolt); f.bolt.geometry.dispose(); f.bolt.material.dispose(); }
          flashes.splice(i, 1);
        }
      }
      flashLight.intensity = flashLevel * 4;
      flashLight.position.copy(camera.position).addScaledVector(flashDir, 500);
      flashLight.target.position.copy(camera.position);

      // Rain fades in from storm 0.5 to 0.7.
      const level = rainEnabled ? Math.min(1, Math.max(0, (v.storm - 0.5) / 0.2)) : 0;
      rain.visible = level > 0;
      if (level === 0) return;
      rainMat.opacity = 0.55 * level;
      const fall = 26;
      const wx = Math.sin(v.windAngle) * 6, wz = Math.cos(v.windAngle) * 6;
      const { x: cx, y: cy, z: cz } = camera.position;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const k = i * 3, o = i * 6;
        const x = cx + wrap(seeds[k] + v.t * wx, RAIN_BOX * 2);
        const y = cy + wrap(seeds[k + 1] - v.t * fall, RAIN_BOX);
        const z = cz + wrap(seeds[k + 2] + v.t * wz, RAIN_BOX * 2);
        rainPos[o]     = x;              rainPos[o + 1] = y;       rainPos[o + 2] = z;
        rainPos[o + 3] = x - wx * 0.05;  rainPos[o + 4] = y + 1.3; rainPos[o + 5] = z - wz * 0.05;
      }
      rainGeo.attributes.position.needsUpdate = true;
    },
  };
}
```

- [ ] **Step 2: Wire the storm into `scene.js`**

In `frontend/worlds/sea/scene.js`:

1. Add the import below `createOcean`:
```js
import { createStorm }       from './gfx/storm.js';
```

2. Replace `  scene.add(sky.mesh, ocean.mesh);` with:
```js
  const storm = createStorm();
  scene.add(sky.mesh, ocean.mesh, storm.group);
```

3. Delete the line `  const noFlash = new THREE.Vector3(0, 1, 0);`.

4. Replace `      if (perf.sample(now - last)) ocean.degrade();` with:
```js
      if (perf.sample(now - last)) { ocean.degrade(); storm.disableRain(); }
```

5. Replace
```js
      sky.update(camera, v, 0, noFlash);
      ocean.update(camera, v, 0, noFlash);
```
with
```js
      storm.update(dt, v, camera);
      sky.update(camera, v, storm.flashLevel, storm.flashDir);
      ocean.update(camera, v, storm.flashLevel, storm.flashDir);
```

6. Replace `    flash() {},` with:
```js
    flash(evt) { storm.flash(evt); },
```

- [ ] **Step 3: Syntax-check**

Run: `cd frontend && node --check worlds/sea/gfx/storm.js && node --check worlds/sea/scene.js && echo ok`
Expected: `ok`

- [ ] **Step 4: Republish the look-dev Artifact**

Same Artifact call as Task 7 Step 7 (same `file_path`, omit `favicon`), with one more `files` entry:
```json
{ "sea/gfx/storm.js": "frontend/worlds/sea/gfx/storm.js" }
```
(`files` left out are kept; also re-send `sea/scene.js` since it changed.)

- [ ] **Step 5: CHECKPOINT — user screenshot loop**

Ask the user for screenshots of: (a) storm slider 0.9 with rain; (b) the moment right after pressing **⚡ Strike** (bolt visible, sky and water lit); (c) "Bay approach" with "follow voyage" on, waiting for natural strikes. Tuning surface: flash envelope constants, `flashLight.intensity` factor, cloud `lit` gain in `skyColor`, rain `opacity`/`fall`/count. Republish after each change. Continue when the user approves the storm.

- [ ] **Step 6: Commit**

```bash
git add frontend/worlds/sea/gfx/storm.js frontend/worlds/sea/scene.js frontend/worlds/sea/gfx/sky.js frontend/worlds/sea/gfx/ocean.js
git commit -m "feat(sea): lightning strikes, flash lighting and wind-driven rain"
```

---
### Task 9: Look-dev III — the ship, landmarks and Crete (INLINE-ONLY: Artifact + user screenshots)

**Files:**
- Create: `frontend/worlds/sea/gfx/ship.js`
- Create: `frontend/worlds/sea/gfx/landmarks.js`
- Modify: `frontend/worlds/sea/scene.js`

**Interfaces:**
- Consumes: `HULL, SAIL, LANDMARKS, CRETE_ISLAND, COURSE_HEADING, courseToWorld` (Task 2); `wrapAngle` (Task 2); `resolveWaves, heightAt` (Task 1); `VoyageState` (`x, z, t, heading, speed, sail, drive, rudder, windAngle, hull.{y,vy,pitch,roll}`).
- Produces:
  - `createShip() → { group, spray: THREE.Points, update(v, dt) }` — the ship's local +z is the bow.
  - `createLandmarks() → { group, update(v, comps) }`
  - `scene.js` gains exponential fog on standard materials (ship, landmarks, Crete).

- [ ] **Step 1: Write `gfx/ship.js`**

```js
// ── FILE: worlds/sea/gfx/ship.js ─────────────────────────
// The pharaoh's papyrus-reed ship from generated geometry (no model files):
// a curved reed hull with upturned ends, Eye of Horus, mast and square linen
// sail that fills with the wind, steering oar, the pharaoh at the prow, and
// bow spray when the hull slams into a wave. Local +z is the bow.

import * as THREE from 'three';
import { HULL, SAIL } from '../constants.js';
import { wrapAngle } from '../voyage.js';

const REED = 0x8a7a3a, REED_DARK = 0x4e4020, LINEN = 0xd8ccb0, GOLD = 0xc8a040, WOOD = 0x5a3a1c;
const SPRAY_MAX = 180;

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });

/** Bottom half of a unit sphere stretched into a reed hull; both ends curl up, the stern higher. */
function hullGeometry() {
  const g = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const zn    = p.getZ(i);                                  // -1 stern … +1 bow
    const taper = 1 - Math.pow(Math.abs(zn), 3) * 0.85;
    const lift  = Math.max(0, (Math.abs(zn) - 0.5) / 0.5);
    p.setXYZ(i,
      p.getX(i) * HULL.halfBeam * taper,
      p.getY(i) * 1.4 + lift * lift * (zn < 0 ? 4.2 : 2.6),
      zn * HULL.halfLen);
  }
  g.computeVertexNormals();
  return g;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const eyeTexture = () => canvasTexture(128, 64, (x, w, h) => {
  x.fillStyle = '#d8c89a'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#101418'; x.lineWidth = 6;
  x.beginPath(); x.ellipse(64, 26, 34, 14, 0, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#1f4f8a'; x.beginPath(); x.arc(64, 26, 9, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(30, 12); x.lineTo(98, 8); x.stroke();                          // brow
  x.beginPath(); x.moveTo(56, 40); x.lineTo(50, 60); x.stroke();                         // teardrop
  x.beginPath(); x.moveTo(72, 40); x.quadraticCurveTo(98, 64, 108, 44); x.stroke();      // spiral tail
});

const nemesTexture = () => canvasTexture(32, 64, (x, w, h) => {
  for (let y = 0; y < h; y += 8) { x.fillStyle = (y / 8) % 2 ? '#1f4f8a' : '#d8b048'; x.fillRect(0, y, w, 8); }
});

function pharaoh() {
  const g = new THREE.Group();
  const robe   = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 1.5, 10), mat(0xeae4d4));
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.18, 12), mat(GOLD, { metalness: 0.6, roughness: 0.4 }));
  const head   = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat(0x9a6a44));
  const nemes  = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.5),
    new THREE.MeshStandardMaterial({ map: nemesTexture(), roughness: 0.6 }));
  const cape   = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3, 4, 8),
    mat(0x7a1a14, { side: THREE.DoubleSide, flatShading: false }));
  robe.position.y = 0.75;
  collar.position.y = 1.52;
  head.position.y = 1.86;
  nemes.position.set(0, 1.98, -0.04);
  cape.position.set(0, 0.95, -0.36);
  g.add(robe, collar, head, nemes, cape);
  g.scale.setScalar(1.25);
  return { group: g, cape, capeBase: cape.geometry.attributes.position.array.slice() };
}

export function createShip() {
  const group = new THREE.Group();

  // ── Hull, deck, papyrus bindings, stern curl, eyes ──
  group.add(new THREE.Mesh(hullGeometry(), mat(REED)));
  const deck = new THREE.Mesh(new THREE.BoxGeometry(HULL.halfBeam * 1.5, 0.12, HULL.halfLen * 1.3), mat(REED_DARK));
  deck.position.y = 0.02;
  group.add(deck);
  for (const zn of [-0.82, -0.68, 0.68, 0.82]) {
    const taper = 1 - Math.pow(Math.abs(zn), 3) * 0.85;
    const lift  = (Math.abs(zn) - 0.5) / 0.5;
    const band  = new THREE.Mesh(new THREE.BoxGeometry(HULL.halfBeam * 2 * taper + 0.15, 0.22, 0.35), mat(REED_DARK));
    band.position.set(0, lift * lift * (zn < 0 ? 4.2 : 2.6) + 0.05, zn * HULL.halfLen);
    group.add(band);
  }
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 8, 18, Math.PI * 1.3), mat(REED));
  curl.position.set(0, 4.8, -HULL.halfLen * 0.98);
  curl.rotation.y = Math.PI / 2;
  group.add(curl);
  const eyeMat = new THREE.MeshStandardMaterial({ map: eyeTexture(), roughness: 0.7 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), eyeMat);
    eye.position.set(side * HULL.halfBeam * 0.62, 1.0, HULL.halfLen * 0.66);
    eye.rotation.y = side * Math.PI / 2;
    group.add(eye);
  }

  // ── Mast, yard and sail (the rig pivots at the top yard so furling gathers upward) ──
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), mat(WOOD));
  mast.position.set(0, 4.5, 1.0);
  group.add(mast);
  const rig = new THREE.Group();
  rig.position.set(0, 8.6, 1.15);
  const topYard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7.4, 6), mat(WOOD));
  topYard.rotation.z = Math.PI / 2;
  const sailGeo  = new THREE.PlaneGeometry(7, 5.4, 14, 10);
  const sailBase = sailGeo.attributes.position.array.slice();
  const sail = new THREE.Mesh(sailGeo, mat(LINEN, { side: THREE.DoubleSide, flatShading: false }));
  sail.position.y = -2.7;
  const bottomYard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.4, 6), mat(WOOD));
  bottomYard.rotation.z = Math.PI / 2;
  bottomYard.position.y = -2.7;
  sail.add(bottomYard);
  rig.add(topYard, sail);
  group.add(rig);

  // ── Steering oar (pivots with the rudder) ──
  const oar = new THREE.Group();
  oar.position.set(HULL.halfBeam * 0.8, 2.6, -HULL.halfLen * 0.72);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.5, 6), mat(WOOD));
  shaft.rotation.x = 1.0;
  shaft.position.set(0, -1.76, -2.73);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.6), mat(WOOD));
  blade.rotation.x = 1.0;
  blade.position.set(0, -3.5, -5.46);
  oar.add(shaft, blade);
  group.add(oar);

  // ── The pharaoh at the prow ──
  const ph = pharaoh();
  ph.group.position.set(0, 0.1, HULL.halfLen * 0.52);
  group.add(ph.group);

  // ── Bow spray (world-space particles; added to the scene separately) ──
  const sprayPos  = new Float32Array(SPRAY_MAX * 3).fill(-1e4);
  const sprayVel  = new Float32Array(SPRAY_MAX * 3);
  const sprayLife = new Float32Array(SPRAY_MAX);
  const sprayGeo  = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  const spray = new THREE.Points(sprayGeo,
    new THREE.PointsMaterial({ color: 0xdfe8ea, size: 0.35, transparent: true, opacity: 0.8, depthWrite: false }));
  spray.frustumCulled = false;
  let nextSpray = 0, sprayCooldown = 0;

  return {
    group, spray,
    update(v, dt) {
      group.position.set(v.x, v.hull.y, v.z);
      group.rotation.set(-v.hull.pitch, v.heading, v.hull.roll, 'YXZ');

      // Sail: furls upward with trim, swings toward the wind, fills with drive,
      // luffs (flutters) when it has none.
      rig.scale.y    = 0.12 + 0.88 * v.sail;
      rig.rotation.y = Math.max(-0.6, Math.min(0.6, wrapAngle(v.windAngle - v.heading) * 0.5));
      const fill = Math.min(1, v.drive / (SAIL.drive * 0.9));
      const sp = sailGeo.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        const bx = sailBase[i * 3], by = sailBase[i * 3 + 1];
        const u = bx / 3.5, w = by / 2.7;
        const bulge   = (1 - u * u) * (1 - w * w);
        const flutter = Math.sin(v.t * 11 + bx * 1.7 + by) * 0.12 * (1 - fill) * (1 - w) * 0.5;
        sp.setZ(i, bulge * fill * 1.2 + flutter);
      }
      sp.needsUpdate = true;
      sailGeo.computeVertexNormals();

      oar.rotation.y = -v.rudder * 1.4;

      // Cape: pinned at the shoulders, trailing and flapping with speed.
      const cp = ph.cape.geometry.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        const y = ph.capeBase[i * 3 + 1];
        const amount = (0.65 - y) / 1.3;
        cp.setZ(i, -amount * (0.25 + v.speed * 0.03) + Math.sin(v.t * 7 + y * 4) * 0.08 * amount);
      }
      cp.needsUpdate = true;

      // Bow spray when the hull slams down at speed.
      sprayCooldown -= dt;
      if (v.hull.vy < -1.2 && v.speed > 3 && sprayCooldown <= 0) {
        sprayCooldown = 0.35;
        const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
        const bx = v.x + fx * HULL.halfLen, bz = v.z + fz * HULL.halfLen, by = v.hull.y + 0.5;
        for (let n = 0; n < 16; n++) {
          const i = nextSpray; nextSpray = (nextSpray + 1) % SPRAY_MAX;
          sprayPos.set([bx + (Math.random() - 0.5) * 2, by, bz + (Math.random() - 0.5) * 2], i * 3);
          sprayVel.set([fx * v.speed * 0.4 + (Math.random() - 0.5) * 4, 3 + Math.random() * 4,
                        fz * v.speed * 0.4 + (Math.random() - 0.5) * 4], i * 3);
          sprayLife[i] = 1.2;
        }
      }
      for (let i = 0; i < SPRAY_MAX; i++) {
        if (sprayLife[i] <= 0) { sprayPos[i * 3 + 1] = -1e4; continue; }
        sprayLife[i] -= dt;
        sprayVel[i * 3 + 1] -= 9.81 * dt;
        sprayPos[i * 3]     += sprayVel[i * 3] * dt;
        sprayPos[i * 3 + 1] += sprayVel[i * 3 + 1] * dt;
        sprayPos[i * 3 + 2] += sprayVel[i * 3 + 2] * dt;
      }
      sprayGeo.attributes.position.needsUpdate = true;
    },
  };
}
```

- [ ] **Step 2: Write `gfx/landmarks.js`**

```js
// ── FILE: worlds/sea/gfx/landmarks.js ────────────────────
// Things to pass on the way, and the destination: a half-sunk wreck with
// bobbing JUST POTS crates, a lone rock with a signal fire, Minoan bull horns
// on a reef, and Crete itself — Mount Ida, a pale beach, Knossos' red columns.

import * as THREE from 'three';
import { LANDMARKS, CRETE_ISLAND, COURSE_HEADING, courseToWorld } from '../constants.js';
import { heightAt } from '../waves.js';

const stone = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
const glow  = (color) => new THREE.MeshBasicMaterial({ color });

/** Deterministic, position-hashed jitter — shared vertices move together, so no cracks. */
function roughen(geo, amount) {
  const p = geo.attributes.position;
  const h = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s) - 0.5; };
  for (let i = 0; i < p.count; i++) {
    const x = +p.getX(i).toFixed(3), y = +p.getY(i).toFixed(3), z = +p.getZ(i).toFixed(3);
    p.setXYZ(i, x + h(x, y, z) * amount, y + h(y, z, x) * amount, z + h(z, x, y) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

function wreck() {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 15), stone(0x3a2a1a));
  hull.position.y = -0.6;
  hull.rotation.set(0.18, 0.4, 0.55);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 5.5, 6), stone(0x2e2216));
  mast.position.set(0.8, 2.2, 2);
  mast.rotation.z = -0.7;
  group.add(hull, mast);
  const crates = [];
  for (let i = 0; i < 6; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), stone(0x7a5a2e));
    crate.userData.off = { x: Math.cos(i * 2.1) * (6 + i * 1.5), z: Math.sin(i * 2.1) * (6 + i * 1.5) };
    crates.push(crate);
    group.add(crate);
  }
  return { group, crates };
}

function signalRock() {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(roughen(new THREE.DodecahedronGeometry(14, 1), 2.5), stone(0x2a2824));
  rock.scale.set(1, 1.3, 0.9);
  rock.position.y = 4;
  const fire  = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), glow(0xff8a30));
  fire.position.y = 21.5;
  const light = new THREE.PointLight(0xff7a2a, 600, 240, 2);
  light.position.y = 23;
  group.add(rock, fire, light);
  return { group, fire, light };
}

function bullHorns() {
  const group = new THREE.Group();
  const reef = new THREE.Mesh(roughen(new THREE.DodecahedronGeometry(7, 1), 1.4), stone(0x3a3630));
  reef.scale.set(1.6, 0.6, 1.2);
  reef.position.y = 0.5;
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2.2), stone(0xb8ae98));
  base.position.y = 2.6;
  group.add(reef, base);
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 2, 3, 0),  new THREE.Vector3(side * 4.5, 6, 0),
      new THREE.Vector3(side * 5, 10, 0), new THREE.Vector3(side * 3.6, 13.5, 0),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.9, 8), stone(0xb8ae98)));
  }
  return { group };
}

function crete() {
  const group = new THREE.Group();
  const { radius: r, height: h } = CRETE_ISLAND;
  const land = new THREE.Mesh(roughen(new THREE.ConeGeometry(r, h, 48, 10), 30), stone(0x24211e));
  land.position.y = h / 2 - 40;
  land.scale.set(1.3, 1, 0.8);
  const ida = new THREE.Mesh(roughen(new THREE.ConeGeometry(r * 0.35, h * 0.9, 24, 6), 18), stone(0x1e1c1a));
  ida.position.set(r * 0.2, h * 0.9, -r * 0.1);
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.05, 8, 64, 1, true), stone(0x8a8068));
  beach.scale.set(1.3, 1, 0.8);
  group.add(land, ida, beach);

  // Knossos on the bay-facing shore (local -z faces back along the course).
  const palace = new THREE.Group();
  palace.position.set(0, 10, -r * 0.8 * 0.96);
  for (let i = 0; i < 8; i++) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.0, 14, 10), stone(0x8a2a1a));   // Minoan: wider at the top
    column.position.set((i - 3.5) * 5, 7, 0);
    palace.add(column);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(42, 2.5, 4), stone(0x6a5a3a));
  lintel.position.y = 15.2;
  palace.add(lintel);
  for (const x of [-19, -6, 6, 19]) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), glow(0xffa040));
    flame.position.set(x, 4, -3);
    palace.add(flame);
  }
  const torch = new THREE.PointLight(0xff8a30, 900, 420, 2);
  torch.position.set(0, 8, -8);
  palace.add(torch);
  group.add(palace);
  return { group, torch };
}

export function createLandmarks() {
  const group = new THREE.Group();
  const at = Object.fromEntries(LANDMARKS.map(l => [l.id, courseToWorld(l.along, l.lateral)]));

  const w = wreck();
  w.group.position.set(at.wreck.x, 0, at.wreck.z);
  const s = signalRock();
  s.group.position.set(at.signal_rock.x, 0, at.signal_rock.z);
  const b = bullHorns();
  b.group.position.set(at.bull_horns.x, 0, at.bull_horns.z);
  b.group.rotation.y = COURSE_HEADING;              // the horns face the approaching ship
  const c = crete();
  const cp = courseToWorld(CRETE_ISLAND.along, CRETE_ISLAND.lateral);
  c.group.position.set(cp.x, 0, cp.z);
  c.group.rotation.y = COURSE_HEADING;
  group.add(w.group, s.group, b.group, c.group);

  return {
    group,
    update(v, comps) {
      w.crates.forEach((crate, i) => {
        const o = crate.userData.off;
        crate.position.set(o.x, heightAt(comps, at.wreck.x + o.x, at.wreck.z + o.z, v.t) + 0.2, o.z);
        crate.rotation.set(Math.sin(v.t * 0.9 + i) * 0.25, i, Math.cos(v.t * 0.7 + i) * 0.25);
      });
      s.light.intensity = 600 + Math.sin(v.t * 13) * 120 + Math.sin(v.t * 7.3) * 90;
      s.fire.scale.setScalar(1 + Math.sin(v.t * 17) * 0.15);
      c.torch.intensity = 900 + Math.sin(v.t * 11) * 150;
    },
  };
}
```

- [ ] **Step 3: Replace the placeholder ship in `scene.js` and add fog**

In `frontend/worlds/sea/scene.js`:

1. Add imports below `createStorm`:
```js
import { createShip }        from './gfx/ship.js';
import { createLandmarks }   from './gfx/landmarks.js';
import { resolveWaves }      from './waves.js';
```

2. Replace
```js
  // PLACEHOLDER ship — replaced by gfx/ship.js in Task 9.
  const ship = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2, 18), new THREE.MeshStandardMaterial({ color: 0x8a7a3a }));
  scene.add(ship);
```
with
```js
  const ship      = createShip();
  const landmarks = createLandmarks();
  scene.add(ship.group, ship.spray, landmarks.group);
  // Standard materials (ship, landmarks, Crete) fog toward the horizon slate;
  // the sky and ocean shaders do their own.
  scene.fog = new THREE.FogExp2(0x1a1f28, 0.0004);
```

3. Replace
```js
      ship.position.set(v.x, v.hull.y, v.z);
      ship.rotation.set(-v.hull.pitch, v.heading, v.hull.roll, 'YXZ');
```
with
```js
      ship.update(v, dt);
      landmarks.update(v, resolveWaves(v.storm, windAngle));
      scene.fog.density = 0.00032 + 0.0005 * v.storm;
      scene.fog.color.setRGB(0.10, 0.12, 0.16).multiplyScalar(1 - 0.35 * v.storm);
```

- [ ] **Step 4: Syntax-check and run the suite**

Run: `cd frontend && node --check worlds/sea/gfx/ship.js && node --check worlds/sea/gfx/landmarks.js && node --check worlds/sea/scene.js && node --test tests/*.test.js`
Expected: checks silent, all tests PASS (Task 2 constants changed nothing tested).

- [ ] **Step 5: Republish the look-dev Artifact**

Same call as Task 7 Step 7 (same `file_path`, no `favicon`), `files` adding:
```json
{
  "sea/scene.js":         "frontend/worlds/sea/scene.js",
  "sea/gfx/ship.js":      "frontend/worlds/sea/gfx/ship.js",
  "sea/gfx/landmarks.js": "frontend/worlds/sea/gfx/landmarks.js"
}
```

- [ ] **Step 6: CHECKPOINT — user screenshot loop**

Ask the user for screenshots of: (a) the ship at the Delta, sail full and then furled (↓); (b) "Wreck"; (c) "Signal rock"; (d) "Bull horns"; (e) "Bay approach" showing Crete and Knossos; (f) steering hard (the oar swings, the sail swings toward the wind). Confirm the heel leans *away* from the wind. The sim's sign is pinned by a hand-derived Task 3 test, so if the render leans into the wind the bug is `ship.js`'s rotation convention (`group.rotation.set(-pitch, heading, roll, 'YXZ')`), not `voyage.js` — fix it there. Tuning surface: ship proportions/colours, landmark scale/positions (`LANDMARKS` in `constants.js`), light intensities, fog density. Republish after each change; continue on user approval.

- [ ] **Step 7: Commit**

```bash
git add frontend/worlds/sea/gfx/ship.js frontend/worlds/sea/gfx/landmarks.js frontend/worlds/sea/scene.js frontend/worlds/sea/constants.js frontend/worlds/sea/voyage.js frontend/tests
git commit -m "feat(sea): reed ship with pharaoh, wreck, signal rock, bull horns and Crete"
```

---
### Task 10: The `sea` realm in the game (vendor three.js, `#gl` canvas, `SeaRealm`, dev panel)

**Files:**
- Create: `frontend/vendor/three.module.min.js` (downloaded)
- Modify: `frontend/Dockerfile`
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Create: `frontend/worlds/sea/dialogue.js`
- Create: `frontend/worlds/sea/SeaRealm.js`
- Modify: `frontend/worlds/transitions.js` (add `seaTransRender`)
- Modify: `frontend/worlds/manifest.js`
- Modify: `frontend/ui/dev-panel.js`

**Interfaces:**
- Consumes: `createSeaScene(canvas, {windAngle}) → {render, flash}` (Tasks 7–9, via dynamic import only); `createVoyage, stepVoyage` (Tasks 2–3); `createNarrationMemory, narrate` (Task 4); `PortalRegistry.use` (Task 6); existing `DialogueManager`, `Dialogue`, `Flags`, `Events`, `G.keys`, `Api.hasToken/post`, `log`, `X/CW/CH`, `Inventory`.
- Produces:
  - `SeaRealm` (id `'sea'`) registered in the manifest; registers edge `sea → nile` (key-less, `seaTransRender`, 2200 ms); listens for `Events 'sea:preload'`.
  - `seaTransRender(progress)` exported from `worlds/transitions.js` (Task 13 uses it for `nile → sea`).
  - `buildSeaMenuDialogue({ arrived, onTurnBack })`, `buildArrivalDialogue()`, `buildBayExitDialogue({ onSailHome })`, `SHIPMASTER` (speaker string) from `worlds/sea/dialogue.js`.
  - Flag `crete_reached` set locally on arrival; `POST /api/progress {step_id:'crete_reached'}` when `Api.hasToken()`.

- [ ] **Step 1: Vendor three.js 0.170.0 and verify it is a single file**

```bash
mkdir -p frontend/vendor
curl -fL https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js -o frontend/vendor/three.module.min.js
wc -c < frontend/vendor/three.module.min.js
grep -c 'from"\./' frontend/vendor/three.module.min.js || true
```
Expected: size ≈ `691648`; the grep prints `0` (no relative imports → single file). If it prints anything else, the wrong version was fetched — stop.

- [ ] **Step 2: Copy `vendor/` into the Docker image**

In `frontend/Dockerfile`, after `COPY worlds/     /usr/share/nginx/html/worlds/` add:
```dockerfile
COPY vendor/     /usr/share/nginx/html/vendor/
```
(Local compose bind-mounts `./frontend`, so a missing COPY would work locally and 404 in the image — Step 11 verifies the image itself.)

- [ ] **Step 3: Import map, `#gl` canvas, help row in `index.html`**

1. Immediately **before** `<script type="module" src="main.js"></script>` add:
```html
<!-- three.js 0.170.0 (MIT) — vendored single-file build, fetched only when THE SEA is entered. -->
<script type="importmap">{ "imports": { "three": "./vendor/three.module.min.js" } }</script>
```

2. In `#cc`, add the WebGL canvas **before** the 2D canvas (DOM order = paint order, so `#c` and every later overlay stay above it):
```html
    <canvas id="gl" width="780" height="540" hidden></canvas>
    <canvas id="c" width="780" height="540"></canvas>
```

3. In the help panel's `▶ CONTROLS` section, after the `SPACE … interact` row, add:
```html
      <div class="help-row"><span class="help-key">AT SEA</span><span class="help-val">← → steer · ↑ ↓ sail · SPACE shipmaster</span></div>
```

- [ ] **Step 4: Stack the canvases in `style.css`**

After the `canvas{display:block;…}` rule (line 55) add:
```css
/* THE SEA: WebGL canvas under the transparent 2D canvas (DOM order paints #c on top) */
#c{position:relative}
#gl{position:absolute;top:0;left:0;image-rendering:auto}
#gl[hidden]{display:none}
```
(`#gl[hidden]` is required: the global `canvas{display:block}` rule would otherwise override the `hidden` attribute.)

- [ ] **Step 5: Add `seaTransRender` to `worlds/transitions.js`**

Append at the end of the file:
```js
// ── THE SEA (nile ↔ sea) ─────────────────────────────────
// The light drains into a storm-dark, a horizon line draws across, and slanted
// rain thickens. The sea fades itself in from this same dark on arrival.
export function seaTransRender(progress) {
  const p = progress;
  const dark = Math.min(1, p / 0.7);
  X.save();
  X.fillStyle = `rgba(6, 10, 16, ${dark * dark * (3 - 2 * dark)})`;
  X.fillRect(0, 0, CW, CH);
  const lineW = CW * Math.min(1, p / 0.55);
  X.globalAlpha = 0.7 * (1 - Math.max(0, (p - 0.75) / 0.25));
  X.fillStyle = '#9aa8b8';
  X.fillRect((CW - lineW) / 2, CH * 0.52, lineW, 2);
  X.strokeStyle = '#8894a4';
  X.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const sx = (_tRnd(i * 3.1) * CW + p * 180) % CW;
    const sy = (_tRnd(i * 7.7) * CH + p * 900) % CH;
    X.globalAlpha = p * (0.15 + _tRnd(i) * 0.35);
    X.beginPath(); X.moveTo(sx, sy); X.lineTo(sx - 6, sy + 18); X.stroke();
  }
  X.restore();
}
```

- [ ] **Step 6: Write `worlds/sea/dialogue.js`**

```js
// ── FILE: worlds/sea/dialogue.js ─────────────────────────
// The Shipmaster, at sea. He honours the Letter; he does not read it.
//   • buildSeaMenuDialogue  — SPACE at sea: keep sailing / turn back
//   • buildArrivalDialogue  — entering Crete's bay
//   • buildBayExitDialogue  — sailing out of the bay once moored

import { Dialogue } from '../../engine/dialogue.js';

export const SHIPMASTER = 'THE SHIPMASTER  ✦  NON-REFUNDABLE VOYAGES';

export function buildSeaMenuDialogue({ arrived, onTurnBack }) {
  return new Dialogue({
    start: {
      speaker: SHIPMASTER,
      text: arrived
        ? 'WE ARE ANCHORED OFF CRETE.\nTHE ISLAND IS NOT TAKING VISITORS.\nTHE VIEW IS INCLUDED IN YOUR PASSAGE.'
        : 'THE HEADING IS CRETE.\nTHE WIND AGREES.\nTHE WIND IS PAID TO AGREE.',
      choices: [
        { label: 'Keep sailing', next: null },
        { label: arrived ? 'Sail home — the Delta' : 'Turn back — the Delta', next: 'confirm' },
      ],
    },
    confirm: {
      speaker: SHIPMASTER,
      text: 'AS YOU WISH.\nYOUR LETTER REMAINS VALID.\nTHE SEA WILL BE HERE.\nTHE SEA IS ALWAYS HERE. THAT IS ITS WHOLE BUSINESS MODEL.',
      onComplete: onTurnBack,
      next: null,
    },
  });
}

export function buildArrivalDialogue() {
  return new Dialogue({
    start: {
      speaker: SHIPMASTER,
      text: 'CRETE.\nKING MINOS KEEPS A LABYRINTH HERE.\nSOMETHING IN IT KEEPS HIM.',
      next: 'anchor',
    },
    anchor: {
      speaker: SHIPMASTER,
      text: 'THE ISLAND IS NOT TAKING VISITORS.\nYOU MAY ANCHOR AND ADMIRE IT.\nADMIRATION IS FREE.\nIT IS THE ONLY THING HERE THAT IS.',
      next: null,
    },
  });
}

export function buildBayExitDialogue({ onSailHome }) {
  return new Dialogue({
    start: {
      speaker: SHIPMASTER,
      text: 'LEAVING THE BAY.\nSHALL I SET A COURSE FOR THE DELTA?',
      choices: [
        { label: 'Sail home — the Delta', action: onSailHome, next: null },
        { label: 'Stay a while',          next: null },
      ],
    },
  });
}
```

- [ ] **Step 7: Write `worlds/sea/SeaRealm.js`**

```js
// ── FILE: worlds/sea/SeaRealm.js ─────────────────────────
// THE SEA — the voyage from the Nile Delta toward Crete, rendered in WebGL.
//
// Unlike every other realm, this one does not draw its world on the 2D canvas:
// three.js renders into #gl, which sits UNDER the transparent #c. The 2D canvas
// still carries overlays (the loading beat, the fade-in, dialogue, transitions).
//
// three.js loads lazily: this module never imports it (or scene.js) statically,
// and the constructor touches no DOM — the manifest constructs every realm at boot.

import { Realm, RealmManager } from '../../engine/realm.js';
import { PortalRegistry }  from '../../engine/portal.js';
import { DialogueManager } from '../../engine/dialogue.js';
import { Flags }           from '../../engine/flags.js';
import { Events }          from '../../engine/events.js';
import { X, CW, CH }       from '../../engine/canvas.js';
import { G }               from '../../game/state.js';
import { Api }             from '../../game/api.js';
import { log }             from '../../ui/panels.js';
import { seaTransRender }  from '../transitions.js';
import { COURSE_HEADING }  from './constants.js';
import { createVoyage, stepVoyage }       from './voyage.js';
import { createNarrationMemory, narrate } from './narration.js';
import { buildSeaMenuDialogue, buildArrivalDialogue, buildBayExitDialogue } from './dialogue.js';

const FADE_MS = 1200;

let _sceneModule = null;
/** Start (or reuse) the lazy scene import; a failed import can be retried. */
function loadScene() {
  _sceneModule ??= import('./scene.js').catch(err => { _sceneModule = null; throw err; });
  return _sceneModule;
}

export class SeaRealm extends Realm {
  constructor() {
    super('sea', 'THE SEA');
    this._gl = null;
    this._scene = null;
    this._readyAt = 0;
    this._lastTs = null;
    this._dt = 0;
    this.voyage = null;
    this._narration = null;

    // Back to the Delta — by turning back, or by sailing out of Crete's bay.
    PortalRegistry.register({
      from: 'sea', to: 'nile', key: null,
      onUse: () => { G.shake = 4; },
      transition: seaTransRender, duration: 2200,
    });

    // The Shipmaster's dialogue at the Delta asks for the scene early, so it
    // has usually finished loading by the time the player boards.
    Events.on('sea:preload', () => { loadScene().catch(() => {}); });
  }

  // No 2D pharaoh here — the pharaoh stands at the prow in the 3D scene.
  getPlayerPose() { return null; }

  onEnter() {
    this._gl ??= document.getElementById('gl');
    this._gl.hidden = false;
    this.voyage = createVoyage();
    this._narration = createNarrationMemory();
    this._lastTs = null;
    this._readyAt = performance.now();
    if (this._scene) return;
    loadScene()
      .then(mod => {
        if (RealmManager.currentId !== 'sea' || this._scene) return;
        this._scene = mod.createSeaScene(this._gl, { windAngle: COURSE_HEADING });
        this._readyAt = performance.now();
      })
      .catch(err => {
        console.error('[sea] scene failed to load', err);
        log('✦ The sea will not take this vessel. The ship returns you to the Delta.', 'hi');
        PortalRegistry.use('sea', 'nile');
      });
  }

  onExit() {
    if (this._gl) this._gl.hidden = true;
  }

  update(ts) {
    const now = ts / 1000;
    this._dt = this._lastTs == null ? 0 : Math.min(0.1, now - this._lastTs);
    this._lastTs = now;
    if (!this._scene || !this.voyage) return;           // hold at the Delta until the sails are raised

    const helm = DialogueManager.isActive()
      ? { steer: 0, trim: 0 }                           // hands off the tiller while talking
      : {
          steer: (G.keys.ArrowLeft ? 1 : 0) - (G.keys.ArrowRight ? 1 : 0),
          trim:  (G.keys.ArrowUp ? 1 : 0) - (G.keys.ArrowDown ? 1 : 0),
        };
    const events = stepVoyage(this.voyage, helm, this._dt);
    for (const line of narrate(events, this.voyage.t, this._narration)) log(line, 'hi');
    for (const e of events) this._onEvent(e);
  }

  _onEvent(e) {
    if (e.type === 'lightning') {
      this._scene.flash(e);
    } else if (e.type === 'arrived') {
      this._recordArrival();
      DialogueManager.start(buildArrivalDialogue());
    } else if (e.type === 'bay_exit') {
      DialogueManager.start(buildBayExitDialogue({ onSailHome: () => PortalRegistry.use('sea', 'nile') }));
    }
  }

  _recordArrival() {
    Flags.set('crete_reached', true);   // instant and local; /api/state strips it — the server records it below
    if (Api.hasToken()) Api.post('/api/progress', { step_id: 'crete_reached' }).catch(() => {});
  }

  render() {
    if (this._scene) {
      this._scene.render(this.voyage, this._dt);
      const fade = 1 - (performance.now() - this._readyAt) / FADE_MS;
      if (fade > 0) { X.fillStyle = `rgba(6, 10, 16, ${fade})`; X.fillRect(0, 0, CW, CH); }
    } else {
      X.fillStyle = '#060a10';
      X.fillRect(0, 0, CW, CH);
      X.fillStyle = '#9aa8b8';
      X.font = '10px monospace';
      X.textAlign = 'center';
      X.fillText('THE SAILS ARE BEING RAISED' + '.'.repeat(1 + Math.floor(performance.now() / 400) % 3), CW / 2, CH / 2);
      X.textAlign = 'left';
    }
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (key === ' ' && this._scene) {
      DialogueManager.start(buildSeaMenuDialogue({
        arrived: this.voyage.arrived,
        onTurnBack: () => PortalRegistry.use('sea', 'nile'),
      }));
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 8: Register the realm in `worlds/manifest.js`**

Add the import after `CouncilRealm`:
```js
import { SeaRealm }      from './sea/SeaRealm.js';
```
and append to `ALL_REALMS` after `new CouncilRealm(),`:
```js
  new SeaRealm(),
```

- [ ] **Step 9: Dev panel `⛵ SEA` entry**

In `frontend/ui/dev-panel.js`:

1. Add the import after the `Api` import:
```js
import { Inventory }       from '../game/inventory.js';
```

2. Append to the `REALMS` array after the `nile` entry:
```js
  {
    id: 'sea', label: '⛵ SEA',
    setup() {
      // Local Letter so the Delta boat works too; the server grant for accounts.
      if (!Inventory.owned('letter_of_passage')) Inventory.addLocal('letter_of_passage');
      _devUnlock('nile', 'sea');
    },
  },
```
(`_devUnlock('sea')` returns 404 until Task 11 adds `sea` to `REALM_CATALOGUE`; it is fire-and-forget, so the teleport still works.)

- [ ] **Step 10: Syntax-check and run the suite**

Run:
```bash
cd frontend && for f in worlds/sea/SeaRealm.js worlds/sea/dialogue.js worlds/transitions.js worlds/manifest.js ui/dev-panel.js; do node --check $f || exit 1; done && node --test tests/*.test.js
```
Expected: no syntax errors; all tests PASS.

- [ ] **Step 11: Verify the shipped image serves three.js**

```bash
docker build -t ps-frontend-check frontend
docker run --rm ps-frontend-check ls -l /usr/share/nginx/html/vendor/three.module.min.js
docker run --rm -d -p 5199:80 --name ps-frontend-check ps-frontend-check
curl -sI http://localhost:5199/vendor/three.module.min.js | grep -iE "^HTTP|content-type"
docker stop ps-frontend-check
```
Expected: the file is listed; `HTTP/1.1 200 OK` and `Content-Type: application/javascript`. (A standalone `docker build` — not the bind-mounted compose service — is what proves the `COPY vendor/` line works.)

- [ ] **Step 12: MILESTONE — sail from the dev panel (user-verified)**

The Stop hook rebuilds the frontend container. Ask the user to hard-reload `http://localhost:5173`, press backtick, click **⛵ SEA**, and confirm: "THE SAILS ARE BEING RAISED" then a fade into the ocean; ← → steer and ↑ ↓ trim; log narration appears; SPACE opens the Shipmaster menu; **Turn back** plays the storm wipe and returns to the Nile; panels, log, and dialogue box still work. Logged-in users will also see "The way is barred." in the log on entering the sea — expected until Task 11 adds the `sea` grant (guests have no socket, so they won't). Fix anything else reported before committing.

- [ ] **Step 13: Commit**

```bash
git add frontend/vendor/three.module.min.js frontend/Dockerfile frontend/index.html frontend/style.css frontend/worlds/sea/dialogue.js frontend/worlds/sea/SeaRealm.js frontend/worlds/transitions.js frontend/worlds/manifest.js frontend/ui/dev-panel.js
git commit -m "feat(sea): THE SEA realm — vendored three.js, stacked WebGL canvas, voyage loop"
```

---
### Task 11: Backend catalogue data — realm, arrival step, ware

**Files:**
- Modify: `backend/app/realms.py` (`REALM_CATALOGUE`)
- Modify: `backend/app/steps.py` (`STEP_CONFIG`)
- Modify: `backend/app/shop.py` (`SHOP_CATALOGUE`)
- Modify: `backend/tests/test_shop_catalogue.py`
- Create: `backend/tests/test_sea_voyage.py`

**Interfaces:**
- Consumes: existing `grant_realm`, `invalidate_unlock_cache`, `ChannelRegistry`, `_on_realm_enter`, conftest `make_user`/`auth_headers`/`TestingSessionLocal`.
- Produces: realm `sea` (rule `requires_realms: ["nile"]`), step `crete_reached` (requires `sea`; server-owned flag `crete_reached`), ware `letter_of_passage` (keepsake, 8). No new routes.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_sea_voyage.py`:

```python
"""THE SEA: the realm grant, the arrival step, and the Letter of Passage ware.

All three are catalogue data — no new routes. The Letter check itself is
client-side for now (no requires_items rule primitive; see the design spec).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.channels import ChannelRegistry
from app.realms import grant_realm, invalidate_unlock_cache
from tests.conftest import TestingSessionLocal, make_user, auth_headers


@pytest.fixture(autouse=True)
def _clear_unlock_cache():
    invalidate_unlock_cache()
    yield
    invalidate_unlock_cache()


@pytest.fixture(autouse=True)
def _silence_ws():
    with patch("app.realms.manager") as mgr:
        mgr.send_to_user = AsyncMock()
        yield mgr


async def _grant(uid, realm):
    async with TestingSessionLocal() as db:
        await grant_realm(db, uid, realm, "test")


# ── The realm ─────────────────────────────────────────────

async def test_evaluate_grants_sea_once_the_nile_is_open(client):
    uid = await make_user()
    await _grant(uid, "nile")
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={}, headers=auth_headers(uid))).json()
    assert "sea" in body["newly_unlocked"]


async def test_evaluate_withholds_sea_without_the_nile(client):
    uid = await make_user()
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={}, headers=auth_headers(uid))).json()
    assert "sea" not in body["unlocked"]


# ── The arrival step ──────────────────────────────────────

async def test_crete_reached_is_refused_before_sailing(client):
    uid = await make_user()
    async with client as c:
        res = await c.post("/api/progress", json={"step_id": "crete_reached"}, headers=auth_headers(uid))
    assert res.status_code == 403


async def test_crete_reached_is_recorded_once_at_sea(client):
    uid = await make_user()
    await _grant(uid, "nile")
    await _grant(uid, "sea")
    async with client as c:
        res = await c.post("/api/progress", json={"step_id": "crete_reached"}, headers=auth_headers(uid))
        me = (await c.get("/api/me", headers=auth_headers(uid))).json()
    assert res.status_code == 200
    assert me["flags"]["crete_reached"] is True


async def test_forged_crete_reached_flag_is_stripped(client):
    """A future Crete realm will read this flag — it must not be console-writable."""
    uid = await make_user()
    async with client as c:
        await c.put("/api/state", json={"flags": {"crete_reached": True, "nile_baby": "adopted"}},
                    headers=auth_headers(uid))
        me = (await c.get("/api/me", headers=auth_headers(uid))).json()
    assert "crete_reached" not in me["flags"]
    assert me["flags"]["nile_baby"] == "adopted"


# ── The ware ──────────────────────────────────────────────

async def test_letter_of_passage_is_a_keepsake_bought_once(client):
    uid = await make_user(earned=20.0)
    async with client as c:
        first  = await c.post("/api/shop/buy", json={"item_id": "letter_of_passage"}, headers=auth_headers(uid))
        second = await c.post("/api/shop/buy", json={"item_id": "letter_of_passage"}, headers=auth_headers(uid))
    assert first.status_code == 200
    assert first.json()["earned"] == 12.0
    assert {"item_id": "letter_of_passage", "quantity": 1, "equipped": False} in first.json()["inventory"]
    assert second.status_code == 409


# ── The WS gate ───────────────────────────────────────────

async def _enter(uid, realm, reg, ws):
    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {"username": "buyer", "projection_session": None,
                                     "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0}
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws, uid, "buyer", {"realm": realm, "owner_id": uid})


async def test_ws_realm_enter_sea_is_gated_on_the_grant():
    uid = await make_user()
    reg = ChannelRegistry()
    ws = MagicMock()
    ws.send_json = AsyncMock()
    await reg.join(ws, (uid, "world"))

    await _enter(uid, "sea", reg, ws)
    assert ws not in reg.peers((uid, "sea"))

    await _grant(uid, "sea")
    invalidate_unlock_cache(uid)
    await _enter(uid, "sea", reg, ws)
    assert ws in reg.peers((uid, "sea"))
```

In `backend/tests/test_shop_catalogue.py`, change

```python
    for new_id in ("secret_recursion", "secret_fire", "attentive_reel", "self_equity"):
        assert new_id in SHOP_CATALOGUE
    assert len(SHOP_CATALOGUE) == 18
```
to
```python
    for new_id in ("secret_recursion", "secret_fire", "attentive_reel", "self_equity", "letter_of_passage"):
        assert new_id in SHOP_CATALOGUE
    assert len(SHOP_CATALOGUE) == 19
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec backend python -m pytest tests/test_sea_voyage.py tests/test_shop_catalogue.py -v`
Expected: FAIL — `sea` never granted, `crete_reached` → 404 "Unknown step.", `letter_of_passage` → 404, catalogue count 18.

- [ ] **Step 3: Add the catalogue entries**

`backend/app/realms.py` — append to `REALM_CATALOGUE` after `council`:
```python
    "sea": {
        "dir": "sea", "module": "/worlds/sea/SeaRealm.js",
        "export": "SeaRealm", "sort": 8,
        # Boarding also needs a Letter of Passage, checked client-side for now:
        # there is no requires_items primitive and the voyage gates nothing of
        # value yet. Add requires_items when a Crete realm makes arrival matter.
        "unlock_rule": {"requires_realms": ["nile"]},
    },
```

`backend/app/steps.py` — append to `STEP_CONFIG` after `upline_accepted`:
```python
    # Reaching Crete's bay by sea — the input a future Crete realm will read.
    "crete_reached": {
        "requires": {"requires_realms": ["sea"]},
        "sets_flag": "crete_reached",
    },
```

`backend/app/shop.py` — append to `SHOP_CATALOGUE` after `self_equity`:
```python
    "letter_of_passage":  {"name": "A Letter of Passage",                    "price": 8,  "kind": "keepsake"},
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `docker compose exec backend python -m pytest tests/test_sea_voyage.py tests/test_shop_catalogue.py -v`
Expected: PASS (8 + 4)

- [ ] **Step 5: Run the full backend suite**

Run: `docker compose exec backend python -m pytest -q`
Expected: all PASS (in particular `test_catalogue_realm_dependencies_all_exist`, `test_state_strips_reserved_realm_gate_flags`, and the shop/unlock suites).

- [ ] **Step 6: Commit**

```bash
git add backend/app/realms.py backend/app/steps.py backend/app/shop.py backend/tests/test_sea_voyage.py backend/tests/test_shop_catalogue.py
git commit -m "feat(backend): sea realm, crete_reached step, Letter of Passage ware"
```

---

### Task 12: The Letter of Passage at JUST POTS (frontend)

**Files:**
- Modify: `frontend/worlds/nile/shop/catalogue.js`
- Modify: `frontend/worlds/nile/shop/StallOverlay.js`
- Modify: `frontend/draw/ware-art.js`
- Test: `frontend/tests/ware-catalogue.test.js`

**Interfaces:**
- Consumes: `SHOP_CATALOGUE["letter_of_passage"]` (Task 11) via the existing `GET /api/config` → `getShop()`.
- Produces: `WARES` entry `letter_of_passage`, `WARE_RETORTS.letter_of_passage`, exported `PER_ROW = 10` and `TABLE_ROWS = 2` from `catalogue.js`; `drawWareArt(X, 'letter_of_passage', …)` icon.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/ware-catalogue.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WARES, WARES_BY_ID, WARE_RETORTS, PER_ROW, TABLE_ROWS } from '../worlds/nile/shop/catalogue.js';

test('every ware fits on the stall table (rowY has exactly TABLE_ROWS rows)', () => {
  assert.ok(WARES.length <= PER_ROW * TABLE_ROWS, `${WARES.length} wares > ${PER_ROW}×${TABLE_ROWS}`);
});

test('the Letter of Passage is on sale with a pitch and a retort', () => {
  const letter = WARES_BY_ID.letter_of_passage;
  assert.ok(letter, 'missing ware');
  assert.equal(letter.art, 'letter_of_passage');
  assert.ok(letter.blurb.length > 0);
  assert.ok(WARE_RETORTS.letter_of_passage);
});

test('ware ids are unique', () => {
  assert.equal(new Set(WARES.map(w => w.id)).size, WARES.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --test tests/ware-catalogue.test.js`
Expected: FAIL — `PER_ROW`/`TABLE_ROWS` undefined and the Letter missing.

- [ ] **Step 3: Add the ware, retort and layout constants to `catalogue.js`**

1. Append to `WARES`, after the `self_equity` entry:
```js
  { id: 'letter_of_passage',  name: 'A Letter of Passage',           tier: 'RELICS',      art: 'letter_of_passage',
    blurb: 'PASSAGE TO AN ISLAND THAT IS NOT READY FOR YOU.\nIT WILL BE READY WHEN YOU HAVE PAID.\nIT IS ALWAYS READY WHEN YOU HAVE PAID.' },
```

2. Add to `WARE_RETORTS`, after `astral_lens`:
```js
  letter_of_passage: 'SEALED. THE SHIPMASTER AT THE RIVER MOUTH WILL HONOUR IT. HE HONOURS EVERYTHING. HE READS NOTHING.',
```

3. Directly after the `WARES_BY_ID` export add:
```js
// Stall table layout: wares are laid out TABLE_ROWS rows of PER_ROW. StallOverlay's
// rowY has exactly TABLE_ROWS entries — a ware past PER_ROW × TABLE_ROWS would
// draw at an undefined row (NaN) and vanish, so the catalogue test pins this.
export const TABLE_ROWS = 2;
export const PER_ROW    = 10;
```

- [ ] **Step 4: Use the shared `PER_ROW` in `StallOverlay.js`**

1. Delete the line `const PER_ROW = 9;       // wares per row laid on the table (2 rows for 17)`.
2. Add `PER_ROW` to the existing catalogue import on line 13, e.g.
```js
import { WARES, GENERIC_RETORTS, WARE_RETORTS, POOR_RETORTS, OWNED_RETORTS, PER_ROW } from './catalogue.js';
```
(keep whatever else that import line already names).

- [ ] **Step 5: Draw the icon in `draw/ware-art.js`**

Add to the `ICON` object (e.g. after `bronze_coin`):
```js
  letter_of_passage(X, x, y, s, t) {
    X.fillStyle = '#e2d2a6'; X.fillRect(x - s*0.28, y - s*0.24, s*0.56, s*0.48);           // folded papyrus
    X.fillStyle = '#c8b484'; X.fillRect(x - s*0.28, y - s*0.24, s*0.56, s*0.06);
    X.strokeStyle = '#3a6a8a'; X.lineWidth = Math.max(1, s*0.04);                           // the wave glyph
    X.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = x - s*0.2 + i * s*0.4 / 12, py = y - s*0.02 + Math.sin(i*0.9 + t/400) * s*0.05;
      if (i === 0) X.moveTo(px, py); else X.lineTo(px, py);
    }
    X.stroke();
    X.fillStyle = '#9a2a1e'; X.beginPath(); X.arc(x + s*0.14, y + s*0.14, s*0.09, 0, Math.PI*2); X.fill();   // wax seal
    X.fillStyle = '#c84a3a'; X.fillRect(x + s*0.11, y + s*0.11, s*0.03, s*0.03);
  },
```

- [ ] **Step 6: Run tests and syntax checks**

Run: `cd frontend && node --test tests/*.test.js && node --check worlds/nile/shop/StallOverlay.js && node --check draw/ware-art.js`
Expected: all PASS, no syntax errors.

- [ ] **Step 7: Verify in the running game (user)**

Ask the user to hard-reload, walk to JUST POTS (or dev-teleport to 🐊 NILE), step inside, and confirm: 19 wares across two rows of 10/9, the Letter shows its icon and `$8`, buying it plays the retort and it appears under RELICS & KEEPSAKES; as a guest too.

- [ ] **Step 8: Commit**

```bash
git add frontend/worlds/nile/shop/catalogue.js frontend/worlds/nile/shop/StallOverlay.js frontend/draw/ware-art.js frontend/tests/ware-catalogue.test.js
git commit -m "feat(nile): sell the Letter of Passage at JUST POTS; stall fits 20 wares"
```

---
### Task 13: Boarding at the Nile Delta (Shipmaster, boarding edge, return from the sea)

**Files:**
- Create: `frontend/engine/webgl.js`
- Modify: `frontend/worlds/nile/dialogue.js`
- Modify: `frontend/worlds/nile/NileRealm.js`

**Interfaces:**
- Consumes: `PortalRegistry.use` (Task 6); `seaTransRender` and `SHIPMASTER` (Task 10); `SeaRealm` listening for `Events 'sea:preload'` (Task 10); `Inventory.owned('letter_of_passage')` (Task 12); `POST /api/unlocks/evaluate` granting `sea` (Task 11).
- Produces: `webglAvailable() → boolean` (cached); `buildShipmasterDialogue({ hasLetter: () => boolean, onBoard: () => void })`, `buildNoWebglDialogue()`; the live `nile → sea` edge; `NileRealm.onEnter('sea')` placing the player beside the boat.

- [ ] **Step 1: Write `engine/webgl.js`**

```js
// ── FILE: engine/webgl.js ────────────────────────────────
// Capability probe for WebGL2 (THE SEA renders with three.js, which needs it).
// Cached after the first call; the probe context is released immediately.

let _ok = null;

export function webglAvailable() {
  if (_ok !== null) return _ok;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    _ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    _ok = false;
  }
  return _ok;
}
```

- [ ] **Step 2: Add the Shipmaster to `worlds/nile/dialogue.js`**

1. Add to the header's builder list:
```js
//   • buildShipmasterDialogue — the reed boat at the river mouth: passage to the sea
//   • buildNoWebglDialogue    — the sea refuses a vessel that cannot render water
```

2. Append at the end of the file:
```js
// ── Shipmaster ───────────────────────────────────────────
// Stands at the reed boat in the Delta. He does not sell passage — he honours
// the Letter the Merchant sold you. Opening this dialogue asks THE SEA to start
// loading, so the scene is usually ready by the time you board.
// Nodes: start → board (with a Letter) | no_letter (without)

export function buildShipmasterDialogue({ hasLetter, onBoard }) {
  return new Dialogue({
    start: {
      speaker: SHIPMASTER,
      text: 'A SHIP, PHARAOH. POINTED AT THE OPEN SEA.\nIT GOES WHERE THE LETTER SAYS.\nTHE LETTER ALWAYS SAYS THE SAME THING.',
      onEnter: () => Events.emit('sea:preload'),
      choices: [
        { label: '✦ Board the ship',   condition: hasLetter,         next: 'board'     },
        { label: 'How do I board?',    condition: () => !hasLetter(), next: 'no_letter' },
        { label: 'Leave',                                              next: null        },
      ],
    },
    no_letter: {
      speaker: SHIPMASTER,
      text: 'WITH A LETTER OF PASSAGE.\nI DO NOT SELL PASSAGE. I HONOUR IT.\nTHE MERCHANT UPRIVER SELLS IT.\nTHE MERCHANT SELLS EVERYTHING UPRIVER.',
      next: null,
    },
    board: {
      speaker: SHIPMASTER,
      text: 'YOUR LETTER IS IN ORDER.\nIT IS ALWAYS IN ORDER. THAT IS WHAT YOU PAID FOR.\nMIND THE STORM. IT IS NOT INCLUDED.',
      onComplete: onBoard,
      next: null,
    },
  });
}

export function buildNoWebglDialogue() {
  return new Dialogue({
    start: {
      speaker: SHIPMASTER,
      text: 'THE SEA WILL NOT TAKE THIS VESSEL.\nSOMETHING IN YOUR VESSEL CANNOT RENDER WATER.\nI DO NOT MAKE THE RULES. I DO NOT EVEN READ THEM.',
      next: null,
    },
  });
}
```
3. Add to the imports at the top of the file, next to the `Dialogue` import (`sea/dialogue.js` imports only `engine/dialogue.js`, so this adds no cycle):
```js
import { SHIPMASTER } from '../sea/dialogue.js';   // one speaker string for the Shipmaster, at the Delta and at sea
```
(`Dialogue` and `Events` are already imported.)

- [ ] **Step 3: Wire boarding into `NileRealm.js`**

1. Imports — `PortalRegistry`, `DialogueManager`, `G`, `log`, `BOAT_X` and `RIVERBED_Y` are already imported. Add exactly these three after `import { log } from '../../ui/panels.js';`:
```js
import { Api }                            from '../../game/api.js';
import { Inventory }                      from '../../game/inventory.js';
import { webglAvailable }                 from '../../engine/webgl.js';
```
change `import { desertTransRender } from '../transitions.js';` to
```js
import { desertTransRender, seaTransRender } from '../transitions.js';
```
and add the two builders to the `./dialogue.js` import list:
```js
  buildShipmasterDialogue,
  buildNoWebglDialogue,
```

2. Replace the reed-boat block
```js
    // The reed boat at the river mouth — seeds a future chapter across the sea
    // (no travel yet; the destination is unrevealed to the player).
    const boat = new Entity('boat', BOAT_X, RIVERBED_Y - 8);
    boat.interactRange = 72;
    boat.onInteract = () => {
      log('✦ A reed boat, pointed at the open sea.', 'hi');
      setTimeout(() => log('It faces something past the horizon. Too far to make out what.', ''), 600);
      setTimeout(() => log('Not yet. The sea is not ready for you.', ''), 1200);
    };
    this.registry.register(boat);
```
with
```js
    // The reed boat at the river mouth — the Shipmaster honours a Letter of
    // Passage (sold at JUST POTS) and carries you out onto THE SEA.
    const boat = new Entity('boat', BOAT_X, RIVERBED_Y - 8);
    boat.interactRange = 72;
    boat.onInteract = () => DialogueManager.start(buildShipmasterDialogue({
      hasLetter: () => Inventory.owned('letter_of_passage'),
      onBoard:   () => this._board(),
    }));
    this.registry.register(boat);
```

3. Replace the disabled seed edge
```js
    // ── Disabled outbound portal — seeds the future across-the-sea chapter.
    //    Destination intentionally unnamed (the player doesn't know it yet). ──
    PortalRegistry.register({
      from: 'nile', to: 'sea',
      key: null, condition: () => false,
    });
```
with
```js
    // ── Boarding edge: the reed boat → THE SEA. Key-less — fired from the
    //    Shipmaster's dialogue via PortalRegistry.use (see _board). ──
    PortalRegistry.register({
      from: 'nile', to: 'sea',
      key: null,
      condition: () => Inventory.owned('letter_of_passage'),
      onUse: () => { G.shake = 4; log('✦ You step aboard. The Delta lets go of the rope.', 'hi'); },
      transition: seaTransRender, duration: 2200,
    });
```

4. Add this method after `_onBank(x)`:
```js
  /** Board the ship. Called from the Shipmaster dialogue's onComplete — which
      runs just BEFORE that dialogue closes, so yield first: starting another
      dialogue synchronously would be closed out from under us. */
  async _board() {
    await null;
    if (!webglAvailable()) { DialogueManager.start(buildNoWebglDialogue()); return; }
    if (Api.hasToken()) {
      // The Nile is granted directly (invites.py) without an evaluation pass,
      // so `sea` has to be claimed here or the WS realm gate would bar the channel.
      try { await Api.post('/api/unlocks/evaluate', {}); } catch { /* offline: the voyage still sails */ }
    }
    PortalRegistry.use('nile', 'sea');
  }
```

5. Replace `onEnter(fromId)`'s body
```js
    this.resetMotion();
    if (fromId === 'world') {
      G.px = NILE_ENTRY_X; G.py = BANK_Y; G.pvy = 0;
      G.camX = Math.max(0, G.px - CW / 2);
    }
    G.pZ = 0;
    this.health.setImmunity(1500);
    G.camY = 0;
    G.shake = 6;
    log('✦ You walk west, and the sand turns to mud. The sun is setting on this side of the river.', 'hi');
```
with
```js
    this.resetMotion();
    if (fromId === 'world') {
      G.px = NILE_ENTRY_X; G.py = BANK_Y; G.pvy = 0;
      G.camX = Math.max(0, G.px - CW / 2);
    } else if (fromId === 'sea') {
      // Back from the voyage: wading in the calm Delta, beside the boat.
      G.px = BOAT_X + 70; G.py = RIVERBED_Y; G.pvy = 0;
      G.camX = Math.max(0, G.px - CW / 2);
    }
    G.pZ = 0;
    this.health.setImmunity(1500);
    G.camY = 0;
    G.shake = 6;
    log(fromId === 'sea'
      ? '✦ The ship noses back into the Delta reeds. The river takes you back without comment.'
      : '✦ You walk west, and the sand turns to mud. The sun is setting on this side of the river.', 'hi');
```

- [ ] **Step 4: Syntax-check and run the suite**

Run: `cd frontend && node --check engine/webgl.js && node --check worlds/nile/dialogue.js && node --check worlds/nile/NileRealm.js && node --test tests/*.test.js`
Expected: no syntax errors; all tests PASS.

- [ ] **Step 5: Verify both paths in the running game (user)**

Ask the user to hard-reload and, **logged in**, then again **as a guest**:
1. Walk (or dev-teleport 🐊 NILE, then wade) to the reed boat in the Delta, SPACE → Shipmaster; without a Letter only "How do I board?" / "Leave" show.
2. Buy the Letter at JUST POTS, return → "✦ Board the ship" → storm wipe → the sea.
3. SPACE → Turn back → wipe → standing beside the boat in the Delta, with the "noses back into the Delta reeds" log line.
4. Logged in only: the log shows no "The way is barred." after boarding (the evaluate call granted `sea` before `realm_enter`).

- [ ] **Step 6: Commit**

```bash
git add frontend/engine/webgl.js frontend/worlds/nile/dialogue.js frontend/worlds/nile/NileRealm.js
git commit -m "feat(nile): the Shipmaster — board the reed boat for THE SEA with a Letter of Passage"
```

---
### Task 14: Sea audio — theme, storm-tracking ambience, thunder

**Files:**
- Modify: `frontend/audio/sound.js`
- Modify: `frontend/worlds/sea/SeaRealm.js`

**Interfaces:**
- Consumes: lightning events `{distance, power}` (Task 3); `voyage.storm` (Task 2); `realm:enter → SoundManager.playRealm(id)` wiring already in `main.js`.
- Produces: `THEMES.sea` + `REALM_THEME.sea`; noise tracks may set `ambience: true`; `SoundManager.setAmbience(level: 0..1)`; `SoundManager.playThunder(delaySec, power)`.

- [ ] **Step 1: Ambience plumbing in `sound.js`**

1. In the `SoundManagerClass` constructor, after `this._oscillators  = [];` add:
```js
    this._ambienceLevel = 1;    // gain for theme noise tracks flagged `ambience` (the sea's wind + surf)
    this._ambienceNodes = [];
```

2. In `_stop()`, after `this._oscillators = [];` add:
```js
    this._ambienceNodes = [];
```

3. In `_scheduleTrack`'s noise handler, replace
```js
      src.loop   = true;
      src.connect(env);
      env.connect(filter);
```
with
```js
      src.loop   = true;
      src.connect(env);
      if (track.ambience) {
        // Per-track gain (not shared — a shared node would cross-feed every
        // track's noise through every other track's filter).
        const amb = ctx.createGain();
        amb.gain.value = this._ambienceLevel;
        env.connect(amb);
        amb.connect(filter);
        this._ambienceNodes.push(amb);
      } else {
        env.connect(filter);
      }
```

4. Add `sea` to `REALM_THEME`:
```js
  sea:      'sea',
```

5. Add these public methods right after `stop() { … }`:
```js
  /** Swell or hush the current theme's `ambience` noise tracks (0..1). */
  setAmbience(level) {
    this._ambienceLevel = Math.max(0, Math.min(1, level));
    if (!this._ctx) return;
    for (const node of this._ambienceNodes) {
      node.gain.setTargetAtTime(this._ambienceLevel, this._ctx.currentTime, 0.5);
    }
  }

  /** One rolling thunderclap: brown-noise rumble, low-passed, arriving after
      delaySec (distance / speed of sound). power 0..1 scales loudness and bite. */
  playThunder(delaySec = 0, power = 1) {
    if (!this._enabled) return;
    this._ensureCtx();
    const ctx = this._ctx;
    if (ctx.state === 'suspended') return;
    const t   = ctx.currentTime + Math.max(0, delaySec);
    const dur = 2.8 + power * 1.8;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.15; data[i] = last; }

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180 + 420 * power;
    const env  = ctx.createGain();
    const peak = 0.35 * power;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.06);
    env.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(lp);
    lp.connect(env);
    env.connect(this._masterGain);
    env.connect(this._reverb);
    src.start(t);
    src.stop(t + dur);
  }
```

- [ ] **Step 2: The `sea` theme**

In `THEMES`, insert immediately before the line starting `  // ── ATLANTIS (atlantis)`:
```js
  // ── THE SEA (sea) ──────────────────────────────────────────────────────
  // A Phrygian drone at 48 bpm under two noise layers — wind (bandpass) and
  // surf (lowpass) — both flagged `ambience` so SeaRealm can swell them with
  // the storm. A sparse triangle voice surfaces now and then. Thunder is not
  // part of the loop; SeaRealm fires it per strike via playThunder().
  sea: {
    bpm: 48,
    tracks: [
      { wave: 'noise', gain: 0.05, pan: -0.2, ambience: true,
        filter: { type: 'bandpass', freq: 420, Q: 0.5 }, reverb: true,
        seq: [[1, 32]] },
      { wave: 'noise', gain: 0.07, pan: 0.2, ambience: true,
        filter: { type: 'lowpass', freq: 260 },
        seq: [[1, 32]] },
      { wave: 'sine', gain: 0.09, pan: 0.0,
        filter: { type: 'lowpass', freq: 240 }, reverb: true,
        seq: [[N.A2, 8], [N.Bb2, 4], [N.A2, 4], [N.G2, 8], [N.A2, 8]] },                 // 32 beats
      { wave: 'triangle', gain: 0.03, pan: 0.3,
        filter: { type: 'lowpass', freq: 900 }, vibrato: { rate: 0.8, depth: 5 },
        seq: [[_, 6], [N.E3, 3], [_, 5], [N.F3, 2], [_, 6], [N.D3, 4], [_, 6]] },       // 32 beats
    ],
  },

```

- [ ] **Step 3: Drive the audio from `SeaRealm.js`**

1. Add the import after `import { log } from '../../ui/panels.js';`:
```js
import { SoundManager }    from '../../audio/sound.js';
```

2. Add below `const FADE_MS = 1200;`:
```js
const SPEED_OF_SOUND = 343;   // m/s — thunder arrives after the flash
```

3. In `update(ts)`, after `for (const e of events) this._onEvent(e);` add:
```js
    SoundManager.setAmbience(0.35 + 0.65 * this.voyage.storm);
```

4. In `_onEvent`, replace `      this._scene.flash(e);` with:
```js
      this._scene.flash(e);
      SoundManager.playThunder(e.distance / SPEED_OF_SOUND, e.power);
```

5. Replace `onExit()`'s body with:
```js
    if (this._gl) this._gl.hidden = true;
    SoundManager.setAmbience(1);   // leave other realms' noise tracks at full level
```

- [ ] **Step 4: Syntax-check and run the suite**

Run: `cd frontend && node --check audio/sound.js && node --check worlds/sea/SeaRealm.js && node --test tests/*.test.js`
Expected: no syntax errors; all tests PASS.

- [ ] **Step 5: Listen (user)**

Ask the user to hard-reload, make sure sound is on (♪ button), dev-teleport **⛵ SEA**, and confirm: the drone plus wind/surf start on entry; wind/surf grow as the storm rises (sail toward Crete or stray off course); thunder rolls a few seconds after distant flashes and sooner after near ones; returning to the Nile switches to the Nile theme with no leftover wind.

- [ ] **Step 6: Commit**

```bash
git add frontend/audio/sound.js frontend/worlds/sea/SeaRealm.js
git commit -m "feat(sea): sea theme with storm-tracking wind and surf, distance-delayed thunder"
```

---
### Task 15: Verify end-to-end, document, clean up, open the PR

**Files:**
- Delete: `tools/sea-lookdev/index.html`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-12-sea-voyage-design.md` (status line)
- Create: `~/.claude/projects/-Users-michaelflashman-Code-Flashman-ai-slop-pyramid-scheme/memory/project_sea_voyage.md` + an index line in that directory's `MEMORY.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a verified branch and a PR.

- [ ] **Step 1: Run every suite**

```bash
cd frontend && node --test tests/*.test.js && cd ..
docker compose exec backend python -m pytest -q
```
Expected: all PASS. Keep the summary lines for the PR body.

- [ ] **Step 2: Verify what the dev stack actually serves**

```bash
curl -sI http://localhost:5173/vendor/three.module.min.js | grep -iE "^HTTP|content-type"
curl -s  http://localhost:5173/worlds/sea/SeaRealm.js | grep -c "from 'three'"
curl -s  http://localhost:5173/api/config | grep -o '"letter_of_passage"'
curl -s  http://localhost:5173/ | grep -o '"three": "./vendor/three.module.min.js"'
```
Expected: `200` + `application/javascript`; `0` (SeaRealm never imports three statically); `"letter_of_passage"`; the import-map line.

- [ ] **Step 3: Full playthrough — as an account AND as a guest (user)**

Ask the user to run this checklist twice (logged in; then logged out → guest) and report any deviation:
1. Nile → JUST POTS: the Letter is on the table at `$8`; buy it; it appears under RELICS & KEEPSAKES.
2. Wade to the reed boat in the Delta → Shipmaster → **✦ Board the ship** → storm wipe → "THE SAILS ARE BEING RAISED" (first time) → fade into the sea.
3. Departure narration logs; raise the sail (↑) and sail toward the mountain.
4. Steer hard off course: a "strayed" line logs; the storm thickens; the sea turns the bow back.
5. Point into the wind with the sail up: an "in irons" line logs.
6. SPACE → **Turn back — the Delta** → back beside the boat. Board again (the Letter is kept).
7. Pass the wreck, signal rock and bull horns (each logs once). Lightning and delayed thunder near Crete.
8. Enter the bay → arrival dialogue → moored; the storm eases.
9. Sail out of the bay → "LEAVING THE BAY" → **Sail home** → Delta.
10. Account only: in pgAdmin (`:5050`), `user_realm_unlocks` has a `sea` row for the user and `game_state.flags` contains `"crete_reached": true`. Guest: nothing written.
11. Both: side panels, log, dialogue box, and (touch emulation) the mobile arrow + space buttons all work at sea.

Fix anything reported (test first when the defect is in a pure module), re-run Step 1, and commit the fixes before continuing.

- [ ] **Step 4: Remove the look-dev harness**

```bash
git rm -r tools/sea-lookdev
```

- [ ] **Step 5: Document the realm in `CLAUDE.md`**

1. In the "World structure" table, add after the `nile` row:
```markdown
| `sea` | The Sea | `SeaRealm` (WebGL/three.js, lazy-loaded; board at the Nile Delta with a Letter of Passage; voyage to Crete) |
```

2. In "Frontend architecture", after the "Realm manifest" section, add:
```markdown
### THE SEA — the WebGL realm (`worlds/sea/`)
The one realm that does not draw its world on the 2D canvas: three.js (vendored **0.170.0**, the last single-file build — `frontend/vendor/`, import map in `index.html`, `COPY vendor/` in the Dockerfile) renders into `<canvas id="gl">`, which sits *under* the transparent `#c`, so dialogue, hints, transitions and mobile controls are untouched. `SeaRealm.js` never imports `three` or `scene.js` statically (dynamic import on entry). All simulation is pure and tested: `waves.js` is the **single source of the sea surface** — the GPU vertex shader is generated from it by `glslWaves()` and the hull's buoyancy samples it via `heightAt()`, so never hand-edit wave math in GLSL; `voyage.js` integrates on fixed 1/120 s substeps (frame-rate independent). `scene.js` + `gfx/*` only read voyage state. Boarding needs the `letter_of_passage` keepsake, checked client-side (no `requires_items` rule yet); arrival records the server-owned `crete_reached` step for a future Crete realm.
```

- [ ] **Step 6: Mark the spec implemented**

In `docs/superpowers/specs/2026-09-12-sea-voyage-design.md`, change the status line to:
```markdown
**Date:** 2026-09-12 · **Branch:** `feat/sea-voyage` · **Status:** implemented (plan: `docs/superpowers/plans/2026-09-12-sea-voyage.md`)
```

- [ ] **Step 7: Record the project memory**

Write `project_sea_voyage.md` in the memory directory (frontmatter `name: project_sea_voyage`, `metadata.type: project`) covering: what shipped and on which branch/PR; the pinned three.js version and why; the accepted Letter-ownership gap and the `requires_items` follow-up; per-voyage cost and a Crete realm as the natural next chapters; anything the playthrough surfaced. Add one index line to `MEMORY.md`, e.g. `- [Sea voyage realm](project_sea_voyage.md) — WebGL sea to Crete (three 0.170.0 vendored); Letter check client-side; requires_items follow-up`.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-12-sea-voyage-design.md
git commit -m "docs: THE SEA realm in CLAUDE.md; remove the look-dev harness"
```

- [ ] **Step 9: Push and open the PR (confirm with the user first)**

Ask the user before pushing. Then push `feat/sea-voyage` with upstream tracking and open the PR with the GitHub CLI (title: `feat: THE SEA — a WebGL voyage from the Nile Delta to Crete`). A repo hook denies the first PR-creation attempt to force a reflection pass: reflect, add the learnings to memory and to a `## Learnings` section of the PR body (plus the test summaries from Step 1, the playthrough results from Step 3, and the accepted Letter gap), then re-run the same command.

---

## Spec coverage (self-review)

| Spec section | Task(s) |
|---|---|
| §1 Rendering stack (`#gl` under transparent `#c`, `hidden` toggling) | 10 |
| §1 Modules, three.js vendoring, import map, lazy import, cheap manifest entry | 7–10 |
| §1 Lifecycle (onEnter/update/render/onExit, `getPlayerPose` null, no-WebGL refusal) | 10, 13 |
| §1 Realm graph (seeded edge edited in place, `sea → nile`, `PortalRegistry.use`) | 6, 10, 13 |
| §2 Waves (7 Gerstner comps, storm scaling, steepness clamp, generated GLSL, fixed-point height) | 1 |
| §2 Buoyancy (5 samples, heave/pitch/roll springs, heel, 1/120 s substeps) | 3 |
| §2 Sailing (rudder, trim, polar/irons, drag, current, corridor/veer/soft wall, ~4 min) | 2 |
| §2 Storm intensity (ramp, off-course bonus, easing) | 2 |
| §2 Arrival & mooring (pull off, storm 0.2, bay boundary, bay_exit, session-only) | 2, 10 |
| §2 Turn back via the Space menu (Letter kept) | 10 |
| §3 Ocean (grid, Fresnel, crest glow, foam, wake, fog, lightning glints) | 7 |
| §3 Sky & storm (dusk gradient, clouds, anvil, lightning, rain) | 7, 8 |
| §3 Ship (reed hull, Eye of Horus, sail, oar, pharaoh, spray) | 9 |
| §3 Landmarks & Crete | 9 |
| §3 Camera (chase, damped spring, 20% roll, fov with speed) | 5, 7 |
| §3 Performance (DPR cap, one-shot fallback) | 5, 7, 8 |
| §4 The ware (catalogue, stall entry, art) | 11, 12 |
| §4 Boarding (Shipmaster, preload, WebGL check, evaluate, wipe) | 13 |
| §4 Narration | 4, 10 |
| §4 Arrival dialogue + `crete_reached` (account + guest) | 10, 11 |
| §4 Return to the Nile beside the boat | 13 |
| §4 Guests | 10, 12, 13, 15 |
| §4 Backend data + accepted gap | 11 |
| §4 Audio (theme, storm-tracking wind/surf, thunder) | 14 |
| §4 Dev panel | 10 |
| §5 Tests (frontend pure modules, backend pytest) | 1–6, 11, 12 |
| §5 Verification (served artifact, account + guest playthrough) | 10, 15 |
