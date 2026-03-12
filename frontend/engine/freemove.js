// ── FILE: engine/freemove.js ─────────────────────────────────────────────────
//
// FreeMoveRealm — base class for freely-moving 2D realms with no walkable
// surface: underwater cities, space stations, low-gravity moons, gas clouds, etc.
//
// The physics option controls the feel of the space:
//   yDrift < 0  — constant upward pull (yDrift, like water)
//   yDrift = 0  — no passive force    (true zero-g, deep space)
//   yDrift > 0  — weak downward pull  (low-gravity moon, thin atmosphere)
//   drag < 1    — per-frame velocity decay (water, air resistance, etc.)
//
// Responsibilities:
//   • 2D swim physics (yDrift + input-driven acceleration + drag)
//   • Horizontal + vertical camera tracking with world-bounds clamping
//   • _syncToG() and getPlayerPose() so the HUD always sees current state
//   • _aboveSurface() helper to gate "swim up to exit" transitions
//   • resetToEntry() for respawn positioning
//
// Subclass pattern:
//
//   import { FreeMoveRealm } from '../../engine/freemove.js';
//
//   export class MyRealm extends FreeMoveRealm {
//     constructor() {
//       super('my-realm', 'THE DEEP', {
//         worldW:     2800,
//         worldH:     1900,
//         surfaceExitY: 80,
//         physics: { acc: 0.55, drag: 0.90, maxSpd: 7, yDrift: -0.04 },
//       });
//     }
//
//     onEnter() {
//       super.onEnter();           // resets velocity, positions player at entry
//       // ... realm-specific onEnter logic
//     }
//
//     update(ts) {
//       if (RealmManager.isTransitioning) return;
//       this._moveStep(ts);        // advances physics, syncs G
//       // ... enemies, triggers, zone logs, etc.
//     }
//
//     onKeyDown(key) {
//       if (this._aboveSurface() && (key === 'ArrowUp' || key === 'w' || key === 'W')) {
//         RealmManager.scheduleTransition('oasis', { ... });
//         return true;
//       }
//       if (key === ' ') return this.registry.interact();
//       return false;
//     }
//
//     render() { drawMyRealm(this); }
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

import { Realm }  from './realm.js';
import { G }      from '../game/state.js';
import { CW, CH } from './canvas.js';

// Default swim physics — mirrors AtlantisRealm's values.
// Override via the `physics` constructor option.
const DEFAULTS = {
  acc:      0.55,   // acceleration per frame from key input
  drag:     0.90,   // per-frame velocity multiplier (< 1 = water resistance)
  maxSpd:   7,      // base max speed (multiplied by 1.6 when Shift held)
  yDrift:   -0.04,  // passive per-frame Y velocity (negative = upward pull; 0 = zero-g)
};

// ─────────────────────────────────────────────────────────────────────────────

export class FreeMoveRealm extends Realm {
  /**
   * @param {string} id
   * @param {string} name
   * @param {object} opts
   * @param {number}   opts.worldW       - World pixel width  (default 2800)
   * @param {number}   opts.worldH       - World pixel height (default 1900)
   * @param {number}   opts.entryX       - Player entry X  (default worldW/2)
   * @param {number}   opts.entryY       - Player entry Y  (default 70)
   * @param {number}   opts.floorY       - Hard bottom clamp Y (default worldH - 60)
   * @param {number}   opts.surfaceExitY - Y threshold; _aboveSurface() is true above this (default 80)
   * @param {object}   opts.physics      - Swim physics overrides (acc, drag, maxSpd, yDrift)
   */
  constructor(id, name, {
    worldW       = 2800,
    worldH       = 1900,
    entryX       = null,
    entryY       = 70,
    floorY       = null,
    surfaceExitY = 80,
    physics      = {},
  } = {}) {
    super(id, name);

    this.worldW       = worldW;
    this.worldH       = worldH;
    this.entryX       = entryX ?? worldW / 2;
    this.entryY       = entryY;
    this.floorY       = floorY ?? (worldH - 60);
    this.surfaceExitY = surfaceExitY;
    this._phys        = { ...DEFAULTS, ...physics };

    // Player state — written by _moveStep each frame
    this.px    = this.entryX;
    this.py    = this.entryY;
    this.pvx   = 0;
    this.pvy   = 0;
    this.camX  = 0;
    this.camY  = 0;
    this.moving = false;
    this.frame  = 0;
    this._frameT = 0;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Called by RealmManager when this realm becomes active.
   * Resets player to the entry point and zeroes velocity.
   * Subclasses should call super.onEnter() then add realm-specific setup.
   */
  onEnter() {
    this.px   = this.entryX;
    this.py   = this.entryY;
    this.pvx  = 0;
    this.pvy  = 1.5;  // slight downward drift on entry — feels like diving
    this._syncCamera();
    this._syncToG();
  }

  // ── Physics ────────────────────────────────────────────────────────────────

  /**
   * Advance one frame of underwater physics and sync to G.
   * Call at the start of update(ts), after early-return guards.
   *
   * Reads G.keys for ArrowLeft/Right/Up/Down + WASD + Shift.
   * Sets: this.px, this.py, this.pvx, this.pvy, this.camX, this.camY,
   *       this.moving, this.frame
   * Syncs: G.px, G.py, G.pvx, G.pvy, G.camX, G.camY, G.facing,
   *        G.pmoving, G.pframe
   */
  _moveStep(ts) {
    const p = this._phys;
    const keys = G.keys;

    // ── Buoyancy ─────────────────────────────────────────────────────────
    // Applied before input so input can override it cleanly.
    this.pvy += p.yDrift;

    // ── Input ─────────────────────────────────────────────────────────────
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) { this.pvx -= p.acc; G.facing = -1; }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) { this.pvx += p.acc; G.facing =  1; }
    if (keys['ArrowUp']    || keys['w'] || keys['W'])   this.pvy -= p.acc;
    if (keys['ArrowDown']  || keys['s'] || keys['S'])   this.pvy += p.acc;

    // ── Drag ──────────────────────────────────────────────────────────────
    this.pvx *= p.drag;
    this.pvy *= p.drag;

    // ── Speed cap ─────────────────────────────────────────────────────────
    const maxSpd = p.maxSpd * (keys['Shift'] ? 1.6 : 1.0);
    this.pvx = Math.max(-maxSpd, Math.min(maxSpd, this.pvx));
    this.pvy = Math.max(-maxSpd, Math.min(maxSpd, this.pvy));

    // Snap micro-velocities to zero (avoids perpetual micro-drift)
    if (Math.abs(this.pvx) < 0.08) this.pvx = 0;
    if (Math.abs(this.pvy) < 0.08) this.pvy = 0;

    // ── Integrate ─────────────────────────────────────────────────────────
    this.px += this.pvx;
    this.py += this.pvy;

    // ── Bounds ────────────────────────────────────────────────────────────
    this.px = Math.max(20, Math.min(this.worldW - 20, this.px));
    this.py = Math.max(0,  Math.min(this.worldH - 20, this.py));

    // Bottom bounce: soft deflection rather than hard stop
    if (this.py >= this.floorY) {
      this.py  = this.floorY;
      this.pvy = -Math.abs(this.pvy) * 0.4;
    }

    // ── Camera ────────────────────────────────────────────────────────────
    this._syncCamera();

    // ── Walk animation frame ──────────────────────────────────────────────
    this.moving = Math.abs(this.pvx) + Math.abs(this.pvy) > 0.3;
    if (this.moving && ts - this._frameT > 180) {
      this._frameT = ts;
      this.frame   = 1 - this.frame;
    } else if (!this.moving) {
      this.frame = 0;
    }

    this._syncToG();
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  /**
   * Lerp the camera toward the player in both axes and clamp to world bounds.
   * Called automatically by _moveStep; can also be called standalone in
   * death/frozen states where physics isn't advancing.
   */
  _syncCamera() {
    const targetX = this.px - CW / 2;
    const targetY = this.py - CH / 2;
    this.camX += (targetX - this.camX) * 0.1;
    this.camY += (targetY - this.camY) * 0.1;
    this.camX = Math.max(0, Math.min(this.worldW - CW,  this.camX));
    this.camY = Math.max(0, Math.min(this.worldH - CH,  this.camY));
  }

  // ── G sync ─────────────────────────────────────────────────────────────────

  /**
   * Write local player state → G so the HUD and any G-reading system
   * sees current position regardless of which realm is active.
   */
  _syncToG() {
    G.px      = this.px;
    G.py      = this.py;
    G.pvx     = this.pvx;
    G.pvy     = this.pvy;
    G.camX    = this.camX;
    G.camY    = this.camY;
    G.facing  = this.pvx < -0.3 ? -1 : 1;
    G.pmoving = this.moving;
    G.pframe  = this.frame;
  }

  // ── Realm interface ────────────────────────────────────────────────────────

  /**
   * Standard player pose for drawRealmPharaoh(realm).
   */
  getPlayerPose() {
    return {
      px:     this.px,
      py:     this.py,
      camX:   this.camX,
      camY:   this.camY,
      pZ:     0,
      facing: G.facing,
      frame:  this.frame,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * True when the player has risen above surfaceExitY.
   * Gate the "swim up → exit realm" keypress on this.
   */
  _aboveSurface() {
    return this.py <= this.surfaceExitY;
  }

  /**
   * Teleport the player to the entry point with zeroed velocity.
   * Intended for respawn after death — call from your HealthSystem's
   * onRespawn callback.
   *
   * @param {number} [jitter=0] - Random X spread around entryX (e.g. 200)
   */
  resetToEntry(jitter = 0) {
    this.px   = this.entryX + (Math.random() - 0.5) * jitter;
    this.py   = this.entryY + 30;
    this.pvx  = 0;
    this.pvy  = 0;
    this._syncCamera();
    this._syncToG();
  }
}
