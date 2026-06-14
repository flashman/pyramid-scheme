# The Nile Realm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new 2D side-scrolling realm, The Nile, reached by walking west off the Desert — a one-way downstream current, crocodile hazards, a bazaar, lore NPCs, and a Delta that renders the player's real downline and seeds a future Crete chapter.

**Architecture:** `NileRealm extends PhysicsRealm` (same base as `WorldRealm`), reusing the existing movement, trigger, portal, entity, health, and dialogue engines — and the Desert's existing **two-plane `pZ` mechanic**. `pZ === 0` is a continuous **towpath bank** the player walks freely both ways (no current). `pZ === -1` is the **river**, where a constant westward current applies **every frame** (independent of jump). The player descends into the river with `↓` and climbs back to the towpath with `↑`. This makes the river strictly one-way while guaranteeing a walking route home — the bank-walker is free; the downline in the water only flows down. The realm reads `G.recruits` to populate the Delta; it adds no backend or schema work.

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

Tasks 1–5 contain **complete code** for the realm's systems and the novel current mechanic. Tasks 6–8 add content-heavy beats (dialogue trees, art). For those, this plan gives exact file paths, function signatures, integration points, and a representative concrete sample; the **remaining prose is authored during execution in the established voice**, using `frontend/worlds/atlantis/AtlantisRealm.js` (the `_build*Dialogue()` functions and `_DEATH` tables) as the authoritative tone reference. This is a deliberate, scoped authoring step — not a placeholder.

## The two-plane model (read before Task 1)

The Desert (`worlds/earth/WorldRealm.js`) already uses `G.pZ`: `pZ 0` is the surface plane (gravity, jump), `pZ -1` is a flat foreground plane. The Nile reuses this exactly:

| Plane | Role | Floor Y | Movement | Current? | Crocs? |
|---|---|---|---|---|---|
| `pZ 0` | **Towpath bank** | `TOWPATH_Y` | walk both ways, jump | no | no |
| `pZ -1` | **The river** | `RIVER_FLOOR` | walk (but swept) | **yes, every frame** | yes |

- `↓` on the towpath → descend into the river (`pZ = -1`).
- `↑` in the river (not at the return gate) → climb back to the towpath (`pZ = 0`).
- The current is keyed on `G.pZ === -1`, **not** on `py` — so jumping inside the river does not evade it.
- The return gate is reachable only from the towpath (`pZ 0`), which is continuous end-to-end, so the player can never be trapped.

## File structure

| File | Responsibility |
|---|---|
| `frontend/worlds/nile/constants.js` | World width, two plane Ys, current speed, gate/entry X, beat & croc & Delta X positions |
| `frontend/worlds/nile/draw/nile.js` | `drawNile(realm)` — dusk sky, towpath, river, crocs, downline; calls `drawRealmPharaoh` |
| `frontend/worlds/nile/NileRealm.js` | The realm class: two-plane movement + current, crocs, NPCs, portals, lifecycle |
| `frontend/worlds/nile/dialogue.js` | NPC dialogue trees (Tasks 6–7) |
| `frontend/worlds/manifest.js` | Register `new NileRealm()` (modify) |
| `frontend/worlds/earth/WorldRealm.js` | Add `nile-gate` west-edge `TriggerZone` for a discoverable entrance (modify) |
| `frontend/worlds/transitions.js` | Add `nileTransRender` overlay (modify) |
| `frontend/audio/sound.js` | Add a `nile` theme branch (Task 5, modify) |

No `terrain.js` is needed — both planes are flat, handled by `pZ` branching in the realm (mirroring `WorldRealm`).

The deviation from the spec's "no `WorldRealm.js` edit": the inbound portal graph edge is registered in `NileRealm` (per convention), but a **hint** at the Desert's west edge requires a `TriggerZone` in `WorldRealm` (mirroring the existing `oasis-gate`). This is the idiomatic, discoverable approach; the edit is ~8 lines.

---

## Task 1: Realm skeleton — walk west, two planes, return home

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
// Two planes: pZ 0 = towpath bank (TOWPATH_Y), pZ -1 = river (RIVER_FLOOR).

export const NILE_W       = 6000;   // world width (player travels west → Delta)
export const TOWPATH_Y    = 446;    // pZ 0 floor — the bank, walkable both ways
export const RIVER_FLOOR  = 488;    // pZ -1 floor — the one-way water
export const CURRENT_SPD  = 7;      // westward drift px/frame — MUST exceed SPEED (5)

export const NILE_RETURN_X = NILE_W - 120;  // east end: return-to-Desert gate (towpath)
export const NILE_ENTRY_X  = NILE_W - 200;  // where the player spawns on entry

// Desert-side gate: player must be at/below this world-X in the Desert to enter.
export const NILE_GATE_X = 150;

// Beat anchor X positions (entities live on the river plane, pZ -1).
export const BAZAAR_X = NILE_W - 500;
export const FERRY_X  = 4300;
export const SOBEK_X  = 3450;
export const JOSEPH_X = 2550;
export const DELTA_X  = 500;
```

- [ ] **Step 2: Create draw stub (both planes)**

`frontend/worlds/nile/draw/nile.js`:

```js
// ── FILE: worlds/nile/draw/nile.js ───────────────────────
import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { drawRealmPharaoh } from '../../../draw/pharaoh.js';
import { TOWPATH_Y, RIVER_FLOOR, NILE_W } from '../constants.js';

export function drawNile(realm) {
  // Dusk sky (west bank = setting sun = death).
  const g = X.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#e8a23c');
  g.addColorStop(0.55, '#c66a2e');
  g.addColorStop(1, '#5a3418');
  X.fillStyle = g;
  X.fillRect(0, 0, CW, CH);

  X.save();
  X.translate(-Math.round(G.camX), 0);

  // River band (pZ -1 plane).
  X.fillStyle = '#2a5a6a';
  X.fillRect(0, RIVER_FLOOR, NILE_W, CH - RIVER_FLOOR);

  // Towpath bank (pZ 0 plane) — drawn as a ledge above the water.
  X.fillStyle = '#7a5a2a';
  X.fillRect(0, TOWPATH_Y, NILE_W, RIVER_FLOOR - TOWPATH_Y + 4);

  X.restore();

  drawRealmPharaoh(realm);   // reads realm.getPlayerPose() (includes pZ)
}
```

- [ ] **Step 3: Add the transition overlay**

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

- [ ] **Step 4: Create the realm class**

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
import { CW }                             from '../../engine/canvas.js';
import { log }                            from '../../ui/panels.js';
import { nileTransRender }                from '../transitions.js';
import {
  NILE_W, TOWPATH_Y, RIVER_FLOOR, CURRENT_SPD,
  NILE_ENTRY_X, NILE_RETURN_X, NILE_GATE_X,
} from './constants.js';
import { drawNile } from './draw/nile.js';

export class NileRealm extends PhysicsRealm {
  constructor() {
    super('nile', 'THE NILE', {
      gravity: 0.5, worldW: NILE_W, floor: TOWPATH_Y, maxFallSpeed: 14,
    });

    this.registry = new InteractableRegistry();

    this.triggers = new TriggerRegistry();
    this.triggers.add(new TriggerZone('return-gate', {
      x1: NILE_RETURN_X - 90, x2: NILE_RETURN_X + 90,
      condition: () => G.pZ === 0,                       // exit only from the towpath
      hint: '[↑] BACK TO THE DESERT',
      hintY: TOWPATH_Y - 50,
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

    // ── Outbound portal back to the Desert (from the towpath). ──
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

  // Required by drawRealmPharaoh(). pZ tells the pharaoh which plane it's on.
  getPlayerPose() {
    return { px: G.px, py: G.py, camX: G.camX, pZ: G.pZ, facing: G.facing, frame: G.pframe };
  }

  onEnter(fromId) {
    if (fromId === 'world') {
      G.px = NILE_ENTRY_X; G.py = TOWPATH_Y; G.pvy = 0; G.pZ = 0;
      G.camX = Math.max(0, G.px - CW / 2);
    }
    G.camY = 0;          // insurance: never inherit a negative camY from another realm
    G.shake = 6;
    log('✦ You walk west, and the sand turns to mud.', 'hi');
  }

  onExit() { G.shake = 4; }

  update(ts) {
    if (RealmManager.isTransitioning || DialogueManager.isActive()) return;

    const dx = inputDx(SPEED);
    if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);

    if (G.pZ === 0) {
      // ── Towpath: gravity + jump, free two-way walking, no current. ──
      const r = this._gravityStep(G.py, G.pvy, TOWPATH_Y);
      G.py = r.py; G.pvy = r.pvy;
    } else {
      // ── River: flat plane + one-way westward current (every frame). ──
      G.py = RIVER_FLOOR; G.pvy = 0;
      G.px = this._clampX(G.px - CURRENT_SPD, SPDHALF);
    }

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

    // ↓ : towpath → river.
    if (key === 'ArrowDown' && G.pZ === 0) { G.pZ = -1; G.py = RIVER_FLOOR; G.pvy = 0; return true; }

    // ↑ : portal first (return gate from towpath); else river → towpath.
    if (key === 'ArrowUp') {
      if (PortalRegistry.handleKey('ArrowUp', 'nile', this.triggers)) return true;
      if (G.pZ === -1) { G.pZ = 0; G.py = TOWPATH_Y; G.pvy = 0; return true; }
    }

    // Z : jump (towpath only).
    if ((key === 'z' || key === 'Z') && G.pZ === 0 && G.py >= TOWPATH_Y - 1) {
      G.pvy = -9; return true;
    }

    if (key === ' ') return this.registry.interact();
    return false;
  }
}
```

- [ ] **Step 5: Add the Desert-side west gate (WorldRealm edit)**

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

- [ ] **Step 6: Register the realm in the manifest**

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

- [ ] **Step 7: Verify in browser**

```bash
docker compose up --build -d frontend
```
Hard-reload `http://localhost:5173`, buy in, walk **left** to the far-west edge of the Desert. Expected: hint `[↑] FOLLOW THE RIVER WEST` appears; `↑` plays the wipe and lands you on the brown towpath over blue water at dusk. On the towpath you walk **both ways** freely and jump (`Z`). Press `↓`: you drop onto the river plane. Press `↑`: you climb back to the towpath. Walk east to the return gate; `[↑] BACK TO THE DESERT` appears (only while on the towpath); `↑` returns you to the Desert. No console errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/worlds/nile frontend/worlds/manifest.js frontend/worlds/earth/WorldRealm.js frontend/worlds/transitions.js
git commit -m "feat(nile): realm skeleton — two-plane towpath/river, west entrance, return gate"
```

---

## Task 2: Prove the one-way current (no code — a focused verification)

The current is already implemented in Task 1 (`update()` applies `-CURRENT_SPD` every frame while `G.pZ === -1`). This task **verifies the thesis holds** and that the jump-evasion bug is absent.

**Files:** none (verification + commit of a note only).

- [ ] **Step 1: Verify one-way drift**

Rebuild if needed, enter the Nile, press `↓` to enter the river. Stand still: you drift **west**. Hold `→` (east): because `CURRENT_SPD` (7) > `SPEED` (5), you still net **west** (~2px/frame). Confirm you cannot make eastward progress on the river plane.

- [ ] **Step 2: Verify jump cannot evade the current**

While on the river (`pZ -1`), confirm `Z` does **not** jump (the jump branch is gated to `pZ === 0`). There is no airborne state on the river, so the current applies every frame — the player cannot hop upstream.

- [ ] **Step 3: Verify no soft-lock**

From the far-west Delta end, press `↑` to climb to the towpath, then walk **east** the full length back to the return gate. Confirm the towpath is continuous and the return is always possible.

- [ ] **Step 4: Commit a confirmation note**

Append a one-line comment at the top of `NileRealm.update()` documenting the invariant, then commit:

```js
// INVARIANT: current applies iff pZ === -1 (every frame, no jump on the river),
// so the river is strictly one-way; the pZ 0 towpath is the two-way return path.
```

```bash
git add frontend/worlds/nile/NileRealm.js
git commit -m "docs(nile): document the one-way-current invariant"
```

---

## Task 3: Crocodiles (hazard + health, river plane only)

**Files:**
- Modify: `frontend/worlds/nile/constants.js`
- Modify: `frontend/worlds/nile/NileRealm.js`
- Modify: `frontend/worlds/nile/draw/nile.js`

- [ ] **Step 1: Add croc positions to constants**

Append to `frontend/worlds/nile/constants.js`:

```js
// Crocodiles patrol the river plane (pZ -1) at RIVER_FLOOR.
export const CROCS = [
  { id: 'croc-1', x: 4000, x1: 3700, x2: 4200 },
  { id: 'croc-2', x: 3000, x1: 2750, x2: 3250 },
  { id: 'croc-3', x: 1900, x1: 1650, x2: 2150 },
];
export const CROC_SPEED = 1.6;
export const CROC_HURT  = 26;
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
        G.px = NILE_ENTRY_X; G.py = TOWPATH_Y; G.pvy = 0; G.pZ = 0;
        G.camX = Math.max(0, G.px - CW / 2); G.shake = 8;
        log('✦ You wash up on the entry bank. The river returned you.', 'hi');
      },
    });

    this.crocs = CROCS.map(c => new Enemy(c.id, c.x, RIVER_FLOOR, {
      speed: CROC_SPEED, patrol: { x1: c.x1, x2: c.x2 },
      hurtRange: CROC_HURT, surfaceFn: () => RIVER_FLOOR,
    }));
    this.crocs.forEach(c => this.registry.register(c));
```

At the **top** of `update(ts)`, gate on health:

```js
    if (RealmManager.isTransitioning) return;
    if (this.health.update()) { G.camX = this._trackCameraX(G.camX, G.px); return; }
    if (DialogueManager.isActive()) return;
```

After `this.registry.updateEntities(ts);`, add the hurt check — **only on the river plane**:

```js
    if (G.pZ === -1 && this.health.canTakeDamage()) {
      for (const c of this.crocs) {
        if (c.hurtCheck(G.px, G.py)) {
          this.health.kill('croc', _CROC_DEATH[Math.floor(Math.random() * _CROC_DEATH.length)]);
          break;
        }
      }
    }
```

- [ ] **Step 3: Draw the crocs (river plane)**

In `draw/nile.js`, inside the `X.translate(-camX)` block (before `X.restore()`), add:

```js
  for (const c of realm.crocs) {
    X.fillStyle = c.stunned ? '#6a7a3a' : '#3a5a2a';
    X.fillRect(c.worldX - 24, c.worldY - 12, 48, 12);                       // body
    X.fillRect(c.worldX + (c._dir > 0 ? 18 : -30), c.worldY - 16, 12, 8);  // snout
  }
```

(Confirm `c.stunned` / `c._dir` against `engine/entity.js` `Enemy` during execution; adjust to the actual field names if they differ.)

- [ ] **Step 4: Verify in browser**

Rebuild, reload, enter the Nile, press `↓` into the river, drift into a croc patrol. Expected: contact triggers a death message + shake, then respawn on the towpath entry bank (`pZ 0`). On the **towpath**, walking over a croc's X does **not** hurt you (hurt is gated to `pZ -1`).

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): crocodiles — river-plane Enemy patrols + HealthSystem"
```

---

## Task 4: The Delta — render the player's real downline

The realm's emotional core, using **existing client data** (`G.recruits`). Must read correctly at **zero recruits** (empty river) and when populated.

**Files:**
- Modify: `frontend/worlds/nile/constants.js`
- Modify: `frontend/worlds/nile/draw/nile.js`
- Modify: `frontend/worlds/nile/NileRealm.js`

- [ ] **Step 1: Delta layout constants**

Append to `constants.js`:

```js
// Delta: recruits are laid out west of DELTA_START_X, spaced by index.
export const DELTA_START_X = 1100;
export const DELTA_SPACING = 70;    // px between consecutive recruit markers
export const DELTA_MIN_X   = 120;   // do not place west of here
```

- [ ] **Step 2: Draw the downline (or its absence)**

In `draw/nile.js` add imports and a helper, called inside the camera-translated block:

```js
import {
  TOWPATH_Y, RIVER_FLOOR, NILE_W,
  DELTA_START_X, DELTA_SPACING, DELTA_MIN_X,
} from '../constants.js';

function drawDownline() {
  const recs = G.recruits;
  if (!recs.length) {
    // The first gut-punch: you came to meet your downline; no one is here.
    X.fillStyle = '#caa060';
    X.font = '7px monospace';
    X.fillText('THE RIVER IS EMPTY.', DELTA_START_X - 200, TOWPATH_Y - 30);
    X.fillText('NO ONE IS DOWNSTREAM. NOT YET.', DELTA_START_X - 220, TOWPATH_Y - 18);
    return;
  }
  recs.forEach((rec, i) => {
    const x = Math.max(DELTA_MIN_X, DELTA_START_X - i * DELTA_SPACING);
    X.fillStyle = rec.depth === 1 ? '#e8c060' : rec.depth === 2 ? '#b89048' : '#8a6a38';
    X.fillRect(x - 4, RIVER_FLOOR - 26, 8, 22);   // body (standing in the water)
    X.fillRect(x - 5, RIVER_FLOOR - 34, 10, 8);   // head
    X.fillStyle = '#f0c884';
    X.font = '6px monospace';
    X.fillText(`${rec.name} D${rec.depth}`, x - 18, RIVER_FLOOR - 40);
    X.fillText(`+$${(rec.payoutToPlayer ?? 0).toFixed(2)}`, x - 12, RIVER_FLOOR - 48);
  });
}
```

Call `drawDownline();` inside `drawNile`'s `X.translate(-camX)` block, after the planes/crocs and before `X.restore()`.

- [ ] **Step 3: Delta arrival log (one-time)**

In `NileRealm`, init `this._deltaSeen = false;` in the constructor, and in `update()` (after the trigger update) add:

```js
    if (G.px < 1100 && !this._deltaSeen) {
      this._deltaSeen = true;
      log(G.recruits.length
        ? '✦ The Delta. Everyone you sent downstream is here.'
        : '✦ The Delta. Empty water, all the way to the sea.', 'hi');
    }
```

- [ ] **Step 4: Verify in browser (both states)**

Rebuild, reload. **Empty state:** with no recruits, reach the far-west Delta — see "THE RIVER IS EMPTY / NO ONE IS DOWNSTREAM. NOT YET." **Populated state:** open the dev sim panel (backtick `` ` ``), spawn several recruits, return to the Delta — see figures standing in the water labelled with each recruit's real name, depth, and `+$payout`, spaced westward.

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
- Create: `frontend/worlds/nile/dialogue.js`
- Modify: `frontend/worlds/nile/NileRealm.js`

**Reference:** author dialogue trees in the voice of `frontend/worlds/atlantis/AtlantisRealm.js` `_build*Dialogue()`.

NPCs live on the **river plane** (`pZ -1`), so the player meets them by descending into the water — joining the downline to talk to it. (Position the Merchant on the towpath instead only if play-testing shows the bazaar should be a "dry" safe stop; default is river plane.)

- [ ] **Step 1: Create the dialogue module with the Merchant**

`frontend/worlds/nile/dialogue.js`:

```js
// ── FILE: worlds/nile/dialogue.js ────────────────────────
import { Dialogue }  from '../../engine/dialogue.js';
import { Flags }     from '../../engine/flags.js';
import { log }       from '../../ui/panels.js';
import { showModal } from '../../ui/modal.js';

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
import { NPC } from '../../engine/entity.js';   // (Enemy already imported in Task 3)
import { buildMerchantDialogue } from './dialogue.js';
import { BAZAAR_X } from './constants.js';
// in constructor, after crocs:
const merchant = new NPC('merchant', BAZAAR_X, RIVER_FLOOR, 'THE MERCHANT', buildMerchantDialogue());
merchant.interactRange = 90;
this.registry.register(merchant);
```

- [ ] **Step 3: Verify**

Rebuild, reload, go to the bazaar (east end), press `↓` into the river near `BAZAAR_X`, press `SPACE` near the Merchant — dialogue opens; choices navigate; "Leave" closes it.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): the Merchant and the Bazaar of Believers"
```

**Bazaar economics:** default stance is satirical-near-cosmetic (the upsell is the joke). If a minor functional boon is desired (e.g. `G.invitesLeft++` for an in-game credit cost against `G.earned`), implement it in a choice handler — but **payout math stays owned by the backend `PAYOUT_CONFIG`**; do not introduce client-side payout values.

---

## Task 7: NPCs — Ferryman, Sobek, Joseph (authored content)

**Files:**
- Modify: `frontend/worlds/nile/dialogue.js`
- Modify: `frontend/worlds/nile/NileRealm.js`

**Reference:** `AtlantisRealm.js` (Founder/Greeter trees) for tone; Genesis 47 for Joseph's grain mechanic; the real Nilometer (priests set taxes from a hidden flood gauge) for the insider-trading conspiracy.

- [ ] **Step 1: Add `buildFerrymanDialogue`, `buildSobekDialogue`, `buildJosephDialogue`** to `dialogue.js`, each a `new Dialogue({...})` tree in the established voice. Required beats:
  - **Ferryman:** charges a toll to carry you downstream (a buy-in to descend toward death); may set `Flags.set('nile_ferry_paid', true)`.
  - **Sobek:** the crocodile-god as the scheme's enforcer; weeps crocodile tears for the recruits he eats who couldn't pay up the chain.
  - **Joseph:** hoarded grain through seven fat years and sold it back until the people sold their land and themselves; recognizes the player as his heir; reveals the Nilometer.

- [ ] **Step 2: Register the three NPCs** in `NileRealm.js` at `FERRY_X`, `SOBEK_X`, `JOSEPH_X` (import from constants), each `new NPC(id, x, RIVER_FLOOR, NAME, buildXDialogue())` with `interactRange = 90` and `this.registry.register(...)`, following the Merchant pattern in Task 6.

- [ ] **Step 3: Verify**

Rebuild, reload, descend into the river and walk west visiting each NPC; press `SPACE`; confirm each dialogue tree opens, branches, and closes without console errors.

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

In `draw/nile.js`, inside the camera block, draw a simple reed boat near `DELTA_MIN_X` at the water line (a hull rectangle + a mast line), pointed west at the horizon — the visual promise of Crete.

- [ ] **Step 2: Add a "not yet" interaction at the boat**

In `NileRealm.js`, register an `Entity` `boat` at the river mouth with `interactRange` ~70 and an `onInteract` that logs the tease and does **not** transition:

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

Rebuild, reload, reach the river mouth (descend to the river plane near `DELTA_MIN_X`), press `SPACE` at the boat — the Crete tease logs and no transition occurs. Confirm no realm named `crete` is reachable.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile
git commit -m "feat(nile): the Delta mouth — boat and seeded Crete exit"
```

---

## Self-review checklist (completed by plan author)

**Spec coverage:**
- West-axis realm reached from the Desert → Task 1.
- One-way westward current (the thesis mechanic), jump-proof, with a guaranteed return path → Tasks 1 & 2 (two-plane model).
- Crocodiles (Sobek's brood) as hazards, river plane only → Task 3.
- Living-downline Delta from `G.recruits`, works at zero recruits, fully open → Task 4.
- River theme / audio → Task 5.
- Bazaar of Believers + Merchant; in-game-credit-only, no real money → Task 6.
- Ferryman, Sobek, Joseph (granary), Nilometer conspiracy → Task 7.
- Delta mouth boat + disabled Crete portal (seeds future chapter) → Tasks 1 & 8.
- No backend/schema work; no `main.js` change → honored (only manifest + a minimal, disclosed `WorldRealm` hint edit).

**Soft-lock / thesis correctness:** the `pZ 0` towpath is continuous end-to-end and current-free (two-way return); the `pZ -1` river applies the current every frame with no jump (strictly one-way). Both invariants are explicitly verified in Task 2.

**Tonal gradient** (sunlit bazaar → cold Delta) is carried by the dusk sky gradient (Task 1) and east→west content placement (Tasks 6–8).

**Out of scope** (per spec): Crete content, 3D/first-person, real-money purchases, backend changes — none implemented; Crete is only seeded.
```