# The Nile Realm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new 2D side-scrolling realm, The Nile, reached by walking west off the Desert — a one-way downstream current, crocodile hazards, a bazaar, lore NPCs, and a Delta that renders the player's real downline and seeds a future Crete chapter.

**Architecture:** `NileRealm extends PhysicsRealm` (same base as `WorldRealm`), reusing the existing movement, terrain, trigger, portal, entity, health, and dialogue engines. The single novel mechanic is a constant westward current applied while the player stands on the river floor (escaped by climbing onto raised bank platforms). The realm reads `G.recruits` to populate the Delta; it adds no backend or schema work.

**Tech Stack:** Vanilla ES modules, HTML5 canvas, no bundler, no frontend test runner. Served static by nginx in Docker.

---

## Verification model (read first)

**There is no frontend test framework** (no `package.json`, no jest/vitest). Every task is verified **manually in the browser** after a Docker rebuild, because the frontend is nginx-static and does **not** hot-reload (see project memory "Frontend rebuild required"):

```bash
docker compose up --build -d frontend
# then hard-reload http://localhost:5173
```

Use the in-game **dev sim panel** (backtick `` ` `` key) to generate recruits where a task needs a populated downline. Each task ends with a concrete on-screen observation and a commit.

## Authored content (transparency note)

Tasks 1–5 contain **complete code** for the realm's systems and the novel current mechanic. Tasks 6–8 add content-heavy beats (dialogue trees, bank art). For those, this plan gives exact file paths, function signatures, integration points, and a representative concrete sample; the **remaining prose is authored during execution in the established voice**, using `frontend/worlds/atlantis/AtlantisRealm.js` (the `_build*Dialogue()` functions and `_DEATH` tables) as the authoritative tone reference. This is a deliberate, scoped authoring step — not a placeholder.

## File structure

| File | Responsibility |
|---|---|
| `frontend/worlds/nile/constants.js` | World width, river floor Y, bank platforms, current speed, gate X, zone/entity X positions |
| `frontend/worlds/nile/terrain.js` | `surfAt(wx)` / `canStep(feetY, wx)` over bank platforms; `inWater(wx, py)` test |
| `frontend/worlds/nile/draw/nile.js` | `drawNile(realm)` — background, river, banks, entities, recruit-banks; calls `drawRealmPharaoh` |
| `frontend/worlds/nile/NileRealm.js` | The realm class: movement + current, crocs, NPCs, portals, lifecycle |
| `frontend/worlds/manifest.js` | Register `new NileRealm()` (modify) |
| `frontend/worlds/earth/WorldRealm.js` | Add `nile-gate` west-edge `TriggerZone` for a discoverable entrance (modify) |
| `frontend/worlds/transitions.js` | Add `nileTransRender` overlay (modify) |

The deviation from the spec's "no `WorldRealm.js` edit": the inbound portal graph edge is registered in `NileRealm` (per convention), but a **hint** at the Desert's west edge requires a `TriggerZone` in `WorldRealm` (mirroring the existing `oasis-gate`). This is the idiomatic, discoverable approach; the edit is ~8 lines.

---

## Task 1: Realm skeleton — walk west into an empty Nile and back

**Files:**
- Create: `frontend/worlds/nile/constants.js`
- Create: `frontend/worlds/nile/draw/nile.js`
- Create: `frontend/worlds/nile/NileRealm.js`
- Modify: `frontend/worlds/transitions.js`
- Modify: `frontend/worlds/earth/WorldRealm.js`
- Modify: `frontend/worlds/manifest.js`

- [ ] **Step 1: Create constants**

`frontend/worlds/nile/constants.js`:

```js
// ── FILE: worlds/nile/constants.js ───────────────────────
// Layout + physics for The Nile (west of the Desert).

export const NILE_W       = 6000;   // world width (player travels west→Delta)
export const RIVER_FLOOR  = 480;    // y of the river bed (matches Desert GND feel)
export const BANK_TOP     = 430;    // y of raised bank platforms (50px above water)
export const CURRENT_SPD  = 7;      // westward drift px/frame — MUST exceed SPEED (5)

export const NILE_RETURN_X = NILE_W - 120;  // east end: return-to-Desert gate
export const NILE_ENTRY_X  = NILE_W - 200;  // where the player spawns on entry

// Desert-side gate: player must be at/below this world-X in the Desert to enter.
export const NILE_GATE_X = 150;

// Bank platforms: raised ledges the player climbs onto to escape the current.
// { x, w } at BANK_TOP height. The entry/return stretch is a continuous bank
// so the player is never trapped by the current on spawn.
export const BANKS = [
  { x: NILE_W - 600, w: 600 },   // entry/return bank (east)
  { x: 4200, w: 260 },
  { x: 3400, w: 220 },
  { x: 2500, w: 260 },
  { x: 1500, w: 220 },
  { x: 200,  w: 700 },           // Delta bank (west)
];

// Beat anchor X positions (filled in by later tasks).
export const BAZAAR_X   = NILE_W - 500;
export const FERRY_X    = 4300;
export const SOBEK_X    = 3450;
export const JOSEPH_X   = 2550;
export const DELTA_X    = 500;
```

- [ ] **Step 2: Create terrain**

`frontend/worlds/nile/terrain.js`:

```js
// ── FILE: worlds/nile/terrain.js ─────────────────────────
import { LH }                               from '../constants.js';
import { RIVER_FLOOR, BANK_TOP, BANKS }     from './constants.js';

/** Lowest (smallest-y) surface at world-x: bank top if over a bank, else river floor. */
export function surfAt(wx) {
  let sy = RIVER_FLOOR;
  for (const b of BANKS) {
    if (wx >= b.x && wx <= b.x + b.w) sy = Math.min(sy, BANK_TOP);
  }
  return sy;
}

/** Can the player step to toWX without the ledge being too tall? */
export function canStep(feetY, toWX) {
  return (feetY - surfAt(toWX)) <= LH + 1;
}

/** True when the player is standing on the river floor (not a bank) → current applies. */
export function inWater(wx, py) {
  return surfAt(wx) === RIVER_FLOOR && py >= RIVER_FLOOR - 1;
}
```

- [ ] **Step 3: Create draw stub**

`frontend/worlds/nile/draw/nile.js`:

```js
// ── FILE: worlds/nile/draw/nile.js ───────────────────────
import { X, CW, CH }              from '../../../engine/canvas.js';
import { G }                      from '../../../game/state.js';
import { drawRealmPharaoh }       from '../../../draw/pharaoh.js';
import { RIVER_FLOOR, BANK_TOP, BANKS } from '../constants.js';

export function drawNile(realm) {
  // Sky → dusk gradient (west bank = setting sun = death).
  const g = X.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#e8a23c');
  g.addColorStop(0.55, '#c66a2e');
  g.addColorStop(1, '#5a3418');
  X.fillStyle = g;
  X.fillRect(0, 0, CW, CH);

  X.save();
  X.translate(-Math.round(G.camX), 0);

  // River band.
  X.fillStyle = '#2a5a6a';
  X.fillRect(G.camX, RIVER_FLOOR, CW, CH - RIVER_FLOOR);

  // Bank platforms.
  X.fillStyle = '#7a5a2a';
  for (const b of BANKS) X.fillRect(b.x, BANK_TOP, b.w, CH - BANK_TOP);

  X.restore();

  drawRealmPharaoh(realm);   // reads realm.getPlayerPose()
}
```

- [ ] **Step 4: Add the transition overlay**

In `frontend/worlds/transitions.js`, add a westward wipe (match an existing exported renderer's shape, e.g. `oasisTransRender`):

```js
export function nileTransRender(p) {
  // p: 0→1 progress. Westward sand-to-water wipe.
  const w = CW * p;
  X.fillStyle = 'rgba(20,40,50,0.92)';
  X.fillRect(CW - w, 0, w, CH);
}
```

(Confirm `CW`/`CH`/`X` are already imported at the top of `transitions.js`; if not, add them from `../engine/canvas.js`.)

- [ ] **Step 5: Create the realm class**

`frontend/worlds/nile/NileRealm.js`:

```js
// ── FILE: worlds/nile/NileRealm.js ───────────────────────
import { PhysicsRealm, RealmManager }     from '../../engine/realm.js';
import { TriggerZone, TriggerRegistry }   from '../../engine/trigger.js';
import { InteractableRegistry }           from '../../engine/interactables.js';
import { DialogueManager }                from '../../engine/dialogue.js';
import { PortalRegistry }                 from '../../engine/portal.js';
import { G }                              from '../../game/state.js';
import { inputDx, SPEED, SPDHALF }        from '../constants.js';
import { CW, CH }                         from '../../engine/canvas.js';
import { log }                            from '../../ui/panels.js';
import { nileTransRender }                from '../transitions.js';
import {
  NILE_W, RIVER_FLOOR, NILE_ENTRY_X, NILE_RETURN_X, NILE_GATE_X,
} from './constants.js';
import { surfAt, canStep }                from './terrain.js';
import { drawNile }                       from './draw/nile.js';

export class NileRealm extends PhysicsRealm {
  constructor() {
    super('nile', 'THE NILE', {
      gravity: 0.5, worldW: NILE_W, floor: RIVER_FLOOR, maxFallSpeed: 14,
    });

    this.registry = new InteractableRegistry();

    this.triggers = new TriggerRegistry();
    this.triggers.add(new TriggerZone('return-gate', {
      x1: NILE_RETURN_X - 90, x2: NILE_RETURN_X + 90,
      hint: '[↑] BACK TO THE DESERT',
      hintY: RIVER_FLOOR - 60,
    }));

    // ── Inbound portal from the Desert (graph edge owned here). ──
    // Condition reads GLOBAL G.px (player's Desert position), not `this`.
    PortalRegistry.register({
      from: 'world', to: 'nile',
      key: 'ArrowUp', trigger: 'nile-gate',
      condition:  () => G.bought && G.px < NILE_GATE_X,
      onUse:      () => { G.shake = 6; },
      transition: nileTransRender, duration: 1100,
    });

    // ── Outbound portal back to the Desert. ──
    PortalRegistry.register({
      from: 'nile', to: 'world',
      key: 'ArrowUp', trigger: 'return-gate',
      onUse: () => { G.shake = 6; },
      transition: nileTransRender, duration: 1100,
    });

    // ── Disabled Crete portal (seeds the future chapter). ──
    PortalRegistry.register({
      from: 'nile', to: 'crete',
      key: null, condition: () => false,
    });
  }

  // Required by drawRealmPharaoh().
  getPlayerPose() {
    return { px: G.px, py: G.py, camX: G.camX, pZ: 0, facing: G.facing, frame: G.pframe };
  }

  surfaceAt(x)        { return surfAt(x); }
  canStepTo(feetY, x) { return canStep(feetY, x); }

  onEnter(fromId) {
    if (fromId === 'world') {
      G.px = NILE_ENTRY_X; G.py = RIVER_FLOOR; G.pvy = 0;
      G.camX = Math.max(0, G.px - CW / 2);
    }
    G.shake = 6;
    log('✦ You walk west, and the sand turns to mud.', 'hi');
  }

  onExit() { G.shake = 4; }

  update(ts) {
    if (RealmManager.isTransitioning || DialogueManager.isActive()) return;

    const dx = inputDx(SPEED);
    if (dx !== 0) {
      const edgeX = G.px + dx + (dx > 0 ? SPDHALF : -SPDHALF);
      if (this.canStepTo(G.py, edgeX)) G.px = this._clampX(G.px + dx, SPDHALF);
      const ns = this.surfaceAt(G.px);
      if (ns < G.py) { G.py = ns; G.pvy = 0; }
    }

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
    drawNile(this);
    if (!RealmManager.isTransitioning) this.triggers.renderHints(G.camX);
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (PortalRegistry.handleKey(key, 'nile', this.triggers)) return true;
    if ((key === 'z' || key === 'Z')) {
      const surf = this.surfaceAt(G.px);
      if (G.py >= surf - 1) { G.pvy = -9; return true; }
    }
    if (key === ' ') return this.registry.interact();
    return false;
  }
}
```

- [ ] **Step 6: Add the Desert-side west gate (WorldRealm edit)**

In `frontend/worlds/earth/WorldRealm.js`, import the gate X and add a trigger zone in the constructor next to the existing `oasis-gate`:

```js
// add to the existing imports block:
import { NILE_GATE_X } from '../nile/constants.js';

// in constructor, after the oasis-gate TriggerZone .add(...):
this.triggers.add(new TriggerZone('nile-gate', {
  x1:        0,
  x2:        NILE_GATE_X,
  condition: () => G.pZ === 0,
  hint:      '[↑] FOLLOW THE RIVER WEST',
  onEnter:   () => log('A damp wind comes off the water to the west.', ''),
}));
```

(No other `WorldRealm.js` change — its `onKeyDown` already calls `PortalRegistry.handleKey('ArrowUp', 'world', this.triggers)`, which now resolves the `nile-gate` portal.)

- [ ] **Step 7: Register the realm in the manifest**

In `frontend/worlds/manifest.js`:

```js
import { NileRealm } from './nile/NileRealm.js';
// ...
export const ALL_REALMS = [
  new WorldRealm(),
  new NileRealm(),     // ← add
  new OasisRealm(),
  // ... rest unchanged
];
```

- [ ] **Step 8: Verify in browser**

```bash
docker compose up --build -d frontend
```
Hard-reload `http://localhost:5173`, buy in, walk **left** to the far-west edge of the Desert. Expected: the hint `[↑] FOLLOW THE RIVER WEST` appears; pressing `↑` plays the wipe and lands you in THE NILE on a brown bank over blue water at dusk. Walk east to the return gate; `[↑] BACK TO THE DESERT` appears; pressing `↑` returns you to the Desert. No console errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/worlds/nile frontend/worlds/manifest.js frontend/worlds/earth/WorldRealm.js frontend/worlds/transitions.js
git commit -m "feat(nile): realm skeleton — west-edge entrance, banks, return gate"
```

---

## Task 2: The one-way current

**Files:**
- Modify: `frontend/worlds/nile/NileRealm.js`
- Modify: `frontend/worlds/nile/terrain.js` (already has `inWater` from Task 1)

- [ ] **Step 1: Apply westward drift in water**

In `NileRealm.js`, import `inWater` and `CURRENT_SPD`:

```js
import { surfAt, canStep, inWater } from './terrain.js';
import { NILE_W, RIVER_FLOOR, NILE_ENTRY_X, NILE_RETURN_X, NILE_GATE_X, CURRENT_SPD } from './constants.js';
```

In `update(ts)`, immediately **after** the `_gravityStep` block and **before** the walk-animation block, add:

```js
    // ── The current: while in the water, drift west and resist eastward walk. ──
    if (inWater(G.px, G.py)) {
      G.px = this._clampX(G.px - CURRENT_SPD, SPDHALF);
      // Re-snap to surface after the drift so we don't sink into a bank edge.
      const cs = this.surfaceAt(G.px);
      if (cs < G.py) { G.py = cs; G.pvy = 0; }
    }
```

Because `CURRENT_SPD` (7) > `SPEED` (5), walking east (`+5`) nets `-2`/frame in water — the player cannot make eastward progress on the river. Climbing onto a bank (`surfAt` → `BANK_TOP`) makes `inWater` false and stops the drift.

- [ ] **Step 2: Verify in browser**

Rebuild (`docker compose up --build -d frontend`), reload, enter the Nile. Stand still on the river floor: you drift **west**. Hold `→` in the water: you still drift west (slower). Jump (`Z`) onto a bank platform: drifting stops and you can walk east freely. Confirm you can always reach the return gate via the entry bank (you are never trapped).

- [ ] **Step 3: Commit**

```bash
git add frontend/worlds/nile/NileRealm.js
git commit -m "feat(nile): one-way westward current — the downline only flows down"
```

---

## Task 3: Crocodiles (hazard + health)

**Files:**
- Modify: `frontend/worlds/nile/NileRealm.js`
- Modify: `frontend/worlds/nile/draw/nile.js`
- Modify: `frontend/worlds/nile/constants.js`

- [ ] **Step 1: Add croc positions to constants**

Append to `frontend/worlds/nile/constants.js`:

```js
// Crocodiles patrol the shallows at river-floor level.
export const CROCS = [
  { id: 'croc-1', x: 4000, x1: 3700, x2: 4200 },
  { id: 'croc-2', x: 3000, x1: 2750, x2: 3250 },
  { id: 'croc-3', x: 1900, x1: 1650, x2: 2150 },
];
export const CROC_SPEED  = 1.6;
export const CROC_HURT   = 26;
```

- [ ] **Step 2: Build crocs + health in the realm**

In `NileRealm.js` add imports:

```js
import { Enemy }        from '../../engine/entity.js';
import { HealthSystem } from '../../engine/health.js';
import { CROCS, CROC_SPEED, CROC_HURT } from './constants.js';
```

Nile-voiced death messages (author 3–5 in the Atlantis `_DEATH` style — sample below, expand during execution):

```js
const _CROC_DEATH = [
  'SOBEK HAS REVIEWED YOUR ACCOUNT.\nYOU DID NOT PAY UP THE CHAIN.',
  'THE CROCODILE WEEPS AS IT WORKS.\nIT ALWAYS WEEPS.\nIT ALWAYS WORKS.',
  'YOU HAVE BEEN PROCESSED DOWNSTREAM.\nLIKE EVERYONE BELOW YOU.',
];
```

In the constructor, after `this.registry = ...`:

```js
    this.health = new HealthSystem({
      respawnDelay: 2200, immunityAfterSpawn: 2500,
      onKill:   () => { G.shake = 20; },
      onRespawn: () => {
        G.px = NILE_ENTRY_X; G.py = RIVER_FLOOR; G.pvy = 0;
        G.camX = Math.max(0, G.px - CW / 2); G.shake = 8;
        log('✦ You wash up on the entry bank. The river returned you.', 'hi');
      },
    });

    this.crocs = CROCS.map(c => new Enemy(c.id, c.x, RIVER_FLOOR, {
      speed: CROC_SPEED, patrol: { x1: c.x1, x2: c.x2 },
      hurtRange: CROC_HURT, surfaceFn: (wx) => surfAt(wx),
    }));
    this.crocs.forEach(c => this.registry.register(c));
```

In `update(ts)`, wrap movement with the health gate and add hurt checks. At the very top of `update`:

```js
    if (RealmManager.isTransitioning) return;
    if (this.health.update()) { G.camX = this._trackCameraX(G.camX, G.px); return; }
    if (DialogueManager.isActive()) return;
```

After `this.registry.updateEntities(ts);`:

```js
    if (this.health.canTakeDamage()) {
      for (const c of this.crocs) {
        if (c.hurtCheck(G.px, G.py)) { this.health.kill('croc', _CROC_DEATH[Math.floor(Math.random() * _CROC_DEATH.length)]); break; }
      }
    }
```

Add a stomp (`Z` while above a croc) in `onKeyDown`, before the existing jump branch:

```js
    if ((key === 'z' || key === 'Z')) {
      for (const c of this.crocs) {
        if (Math.abs(G.px - c.worldX) < 30 && G.py < c.worldY - 6) { c.stun(performance.now()); G.pvy = -9; G.shake = 6; return true; }
      }
    }
```

- [ ] **Step 3: Draw the crocs**

In `draw/nile.js`, inside the `X.translate(-camX)` block (before `X.restore()`), add a simple croc body so they're visible:

```js
  for (const c of realm.crocs) {
    X.fillStyle = c.stunned ? '#6a7a3a' : '#3a5a2a';
    X.fillRect(c.worldX - 24, c.worldY - 12, 48, 12);   // body
    X.fillRect(c.worldX + (c._dir > 0 ? 18 : -30), c.worldY - 16, 12, 8); // snout
  }
```

(Confirm the property names `c.stunned` / `c._dir` against `engine/entity.js` Enemy during execution; adjust to the actual fields.)

- [ ] **Step 4: Verify in browser**

Rebuild, reload, enter the Nile, drift into a croc patrol. Expected: contact triggers a death message + screen shake, then you respawn on the entry bank. Jump (`Z`) onto a croc from above: it stuns (color change) instead of killing you.

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): crocodiles — Enemy patrols + HealthSystem death/respawn"
```

---

## Task 4: The Delta — render the player's real downline

This is the realm's emotional core and uses **existing client data** (`G.recruits`). It must read correctly at **zero recruits** (empty riverbed) and when populated.

**Files:**
- Modify: `frontend/worlds/nile/draw/nile.js`
- Modify: `frontend/worlds/nile/NileRealm.js`
- Modify: `frontend/worlds/nile/constants.js`

- [ ] **Step 1: Delta layout constants**

Append to `constants.js`:

```js
// Delta: recruits are laid out west of DELTA_START_X, spaced by index.
export const DELTA_START_X = 1100;
export const DELTA_SPACING = 70;   // px between consecutive recruit markers
export const DELTA_MIN_X   = 120;  // do not place west of here
```

- [ ] **Step 2: Draw the downline (or its absence)**

In `draw/nile.js`, add an exported helper and call it inside the camera-translated block:

```js
import { DELTA_START_X, DELTA_SPACING, DELTA_MIN_X, BANK_TOP } from '../constants.js';

function drawDownline() {
  const recs = G.recruits;
  if (!recs.length) {
    // The first gut-punch: you came to meet your downline; no one is here.
    X.fillStyle = '#caa060';
    X.font = '7px monospace';
    X.fillText('THE RIVERBED IS DRY.', DELTA_START_X - 200, BANK_TOP - 40);
    X.fillText('NO ONE IS DOWNSTREAM. NOT YET.', DELTA_START_X - 220, BANK_TOP - 28);
    return;
  }
  recs.forEach((rec, i) => {
    const x = Math.max(DELTA_MIN_X, DELTA_START_X - i * DELTA_SPACING);
    // Figure (deeper = paler, further west).
    X.fillStyle = rec.depth === 1 ? '#e8c060' : rec.depth === 2 ? '#b89048' : '#8a6a38';
    X.fillRect(x - 4, BANK_TOP - 26, 8, 22);            // body
    X.fillRect(x - 5, BANK_TOP - 34, 10, 8);            // head
    // Name + payout the recruit trickled UP to the player.
    X.fillStyle = '#f0c884';
    X.font = '6px monospace';
    X.fillText(`${rec.name} D${rec.depth}`, x - 18, BANK_TOP - 40);
    X.fillText(`+$${(rec.payoutToPlayer ?? 0).toFixed(2)}`, x - 12, BANK_TOP - 48);
  });
}
```

Call `drawDownline();` inside `drawNile`'s `X.translate(-camX)` block, after the bank platforms and before `X.restore()`.

- [ ] **Step 3: Delta arrival log (optional polish)**

In `NileRealm.update`, add a one-time zone log when the player first reaches the Delta:

```js
    // near the other update logic:
    if (G.px < 1100 && !this._deltaSeen) {
      this._deltaSeen = true;
      log(G.recruits.length
        ? '✦ The Delta. Everyone you sent downstream is here.'
        : '✦ The Delta. Empty water, all the way to the sea.', 'hi');
    }
```

Initialize `this._deltaSeen = false;` in the constructor.

- [ ] **Step 4: Verify in browser (both states)**

Rebuild, reload. **Empty state:** with no recruits, drift/walk to the far-west Delta — see "THE RIVERBED IS DRY / NO ONE IS DOWNSTREAM. NOT YET." **Populated state:** open the dev sim panel (backtick `` ` ``), spawn several recruits, return to the Delta — see figures labelled with each recruit's real name, depth, and `+$payout`, spaced westward.

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): the Delta renders the player's real downline (G.recruits)"
```

---

## Task 5: Audio theme

**Files:**
- Modify: `frontend/audio/sound.js`

- [ ] **Step 1: Add a Nile theme branch**

In `frontend/audio/sound.js`, locate `playRealm(id)` and add a `case 'nile':` branch following the structure of an existing realm theme (e.g. the oasis case). Use a slow, low, watery progression (lower tempo than the Desert). Match the exact API the surrounding cases use.

- [ ] **Step 2: Verify**

Rebuild, reload, enter the Nile — a distinct theme plays on entry (the `realm:enter` event is already wired in `main.js`; no `main.js` change needed). Returning to the Desert restores the Desert theme.

- [ ] **Step 3: Commit**

```bash
git add frontend/audio/sound.js
git commit -m "feat(nile): procedural river theme"
```

---

## Task 6: NPCs — Merchant & Bazaar (authored content)

**Files:**
- Modify: `frontend/worlds/nile/NileRealm.js`
- Create: `frontend/worlds/nile/dialogue.js` (NPC dialogue trees)

**Reference:** author dialogue trees in the voice of `frontend/worlds/atlantis/AtlantisRealm.js` `_build*Dialogue()`.

- [ ] **Step 1: Create the dialogue module with the Merchant**

`frontend/worlds/nile/dialogue.js` exports builder functions. Concrete starter for the Merchant (expand the tree during execution):

```js
// ── FILE: worlds/nile/dialogue.js ────────────────────────
import { Dialogue }   from '../../engine/dialogue.js';
import { Flags }      from '../../engine/flags.js';
import { log }        from '../../ui/panels.js';
import { showModal }  from '../../ui/modal.js';

export function buildMerchantDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'WELCOME, FUTURE PHARAOH.\nYOUR DOWNLINE LOOKS THIN.\nI HAVE JUST THE CHARM.',
      choices: [
        { label: 'Show me the wares', next: 'wares' },
        { label: 'What does it do?',  next: 'pitch' },
        { label: 'Leave',             next: null },
      ],
    },
    pitch: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'DOES IT WORK? FRIEND.\nIT WORKS LIKE THE SCHEME WORKS.\nIT WORKS UNTIL YOU ASK.',
      next: 'start',
    },
    wares: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'THE SCARAB OF GUARANTEED DOWNLINE.\nTHREE EASY PAYMENTS.\nTHE FIRST IS NOW. THE OTHERS ARE ALSO NOW.',
      onEnter: () => log('The Merchant gestures at a tray of identical scarabs.', ''),
      next: null,
    },
  });
}
```

- [ ] **Step 2: Register the Merchant NPC**

In `NileRealm.js`:

```js
import { NPC } from '../../engine/entity.js';
import { buildMerchantDialogue } from './dialogue.js';
import { BAZAAR_X } from './constants.js';
// in constructor, after crocs:
const merchant = new NPC('merchant', BAZAAR_X, RIVER_FLOOR, 'THE MERCHANT', buildMerchantDialogue());
merchant.interactRange = 90;
this.registry.register(merchant);
```

- [ ] **Step 3: Verify**

Rebuild, reload, walk to the bazaar (east end), press `SPACE` near the Merchant — the dialogue opens; choices navigate; "Leave" closes it.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): the Merchant and the Bazaar of Believers"
```

**Bazaar economics:** default stance is satirical-near-cosmetic (the upsell is the joke). If a minor functional boon is desired (e.g. `G.invitesLeft++` for an in-game credit cost against `G.earned`), implement it in the Merchant's `onEnter`/choice handlers — but **payout math stays owned by the backend `PAYOUT_CONFIG`**; do not introduce client-side payout values.

---

## Task 7: NPCs — Ferryman, Sobek, Joseph (authored content)

**Files:**
- Modify: `frontend/worlds/nile/dialogue.js`
- Modify: `frontend/worlds/nile/NileRealm.js`

**Reference:** `AtlantisRealm.js` (the Founder/Greeter trees) for tone; Genesis 47 for Joseph's grain mechanic; the real Nilometer (priests set taxes from a hidden flood gauge) for the insider-trading conspiracy.

- [ ] **Step 1: Add `buildFerrymanDialogue`, `buildSobekDialogue`, `buildJosephDialogue`** to `dialogue.js`, each a `new Dialogue({...})` tree in the established voice. Required beats:
  - **Ferryman:** charges a toll to carry you downstream (a buy-in to descend toward death). May set a flag, e.g. `Flags.set('nile_ferry_paid', true)`.
  - **Sobek:** the crocodile-god as the scheme's enforcer; weeps crocodile tears for the recruits he eats who couldn't pay up the chain.
  - **Joseph:** hoarded grain through seven fat years and sold it back until the people sold their land and themselves; recognizes the player as his heir; reveals the Nilometer.

- [ ] **Step 2: Register the three NPCs** in `NileRealm.js` at `FERRY_X`, `SOBEK_X`, `JOSEPH_X` (import from constants), each `new NPC(...)` with `interactRange = 90` and `this.registry.register(...)`, following the Merchant pattern in Task 6.

- [ ] **Step 3: Verify**

Rebuild, reload, walk west visiting each NPC; press `SPACE`; confirm each dialogue tree opens, branches, and closes without console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): Ferryman, Sobek, and Joseph — the granary and the Nilometer"
```

---

## Task 8: The Delta mouth — boat + seeded Crete exit + polish

**Files:**
- Modify: `frontend/worlds/nile/draw/nile.js`
- Modify: `frontend/worlds/nile/NileRealm.js`

- [ ] **Step 1: Draw a boat at the river mouth**

In `draw/nile.js`, inside the camera block, draw a simple boat near `DELTA_MIN_X` at the water line, pointed west at the horizon (a hull rectangle + a mast line). This is the visual promise of Crete.

- [ ] **Step 2: Add a "not yet" interaction at the boat**

In `NileRealm.js`, register an `Entity` (`engine/entity.js`) `boat` at the river mouth with `interactRange` ~70 and an `onInteract` that logs the tease and does not transition:

```js
import { Entity } from '../../engine/entity.js';
import { DELTA_MIN_X } from './constants.js';
// in constructor:
const boat = new Entity('boat', DELTA_MIN_X + 40, RIVER_FLOOR);
boat.interactRange = 70;
boat.onInteract = () => {
  log('✦ A reed boat, pointed at the open sea.', 'hi');
  setTimeout(() => log('Across the water: Crete. Minos. The Labyrinth.', ''), 600);
  setTimeout(() => log('Not yet. The sea is not ready for you.', ''), 1200);
};
this.registry.register(boat);
```

The `{ from: 'nile', to: 'crete', condition: () => false }` portal from Task 1 keeps the graph edge present for the future chapter without enabling travel.

- [ ] **Step 3: Verify**

Rebuild, reload, reach the river mouth, press `SPACE` at the boat — the Crete tease logs and no transition occurs. Confirm no realm named `crete` is reachable (the portal stays disabled).

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): the Delta mouth — boat and seeded Crete exit"
```

---

## Self-review checklist (completed by plan author)

**Spec coverage:**
- West-axis realm reached from the Desert → Task 1.
- One-way westward current (the thesis mechanic) → Task 2.
- Crocodiles (Sobek's brood) as hazards → Task 3.
- Living-downline Delta from `G.recruits`, works at zero recruits, fully open → Task 4.
- River theme / audio → Task 5.
- Bazaar of Believers + Merchant; in-game-credit-only, no real money → Task 6.
- Ferryman, Sobek, Joseph (granary), Nilometer conspiracy → Task 7.
- Delta mouth boat + disabled Crete portal (seeds future chapter) → Tasks 1 & 8.
- No backend/schema work; no `main.js` change → honored throughout (only manifest + a minimal `WorldRealm` hint edit, both disclosed).

**Tonal gradient** (sunlit bazaar → cold Delta) is carried by the draw dusk gradient (Task 1) and content placement (Tasks 6–8, east→west).

**Out of scope** (per spec): Crete content, 3D/first-person, real-money purchases, backend changes — none are implemented; Crete is only seeded.
