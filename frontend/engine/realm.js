// ── FILE: engine/realm.js ────────────────────────────────
// Base Realm + PhysicsRealm classes, and RealmManager with
// built-in transition animation support.

import { CW } from './canvas.js';

// ─────────────────────────────────────────────────────────
// Realm — minimal base class all realms extend.
// ─────────────────────────────────────────────────────────

export class Realm {
  constructor(id, name) {
    this.id   = id;
    this.name = name;
  }

  onEnter(fromId) {}
  onExit()        {}
  update(ts)      {}
  render()        {}
  onKeyDown(key)  { return false; }
}

// ─────────────────────────────────────────────────────────
// PhysicsRealm — base class for realms with a walkable
// ground plane, gravity, and a horizontally scrolling camera.
//
// Concrete realms extend this and call its helpers instead
// of re-implementing the physics math each time.
//
// Constructor opts:
//   gravity      – pixels/frame² acceleration (default 0.5 ≈ Earth)
//   worldW       – total world width in pixels
//   floor        – ground-plane Y coordinate
//   maxFallSpeed – terminal velocity (pixels/frame, default 14)
//
// Terrain interface (override in subclasses):
//   surfaceAt(x)        – highest surface Y at world-x x  (default: flat floor)
//   canStepTo(feetY, x) – can the player step to x?        (default: always true)
//
// These two methods let the physics loop stay in one place while different
// worlds plug in their own terrain shape. A future ruins realm just overrides
// surfaceAt() to return platform heights — no changes to the physics code.
// ─────────────────────────────────────────────────────────

export class PhysicsRealm extends Realm {
  constructor(id, name, {
    gravity      = 0.5,
    worldW       = 800,
    floor        = 440,
    maxFallSpeed = 14,
  } = {}) {
    super(id, name);
    this.gravity      = gravity;
    this.worldW       = worldW;
    this.floor        = floor;
    this.maxFallSpeed = maxFallSpeed;
  }

  // ── Terrain interface — override per realm ────────────

  /**
   * Returns the highest surface Y at world-x x (lowest numeric Y = highest
   * point the player can stand on).  Default: flat ground plane.
   * WorldRealm overrides this to query pyramid geometry.
   */
  surfaceAt(x) { return this.floor; }           // eslint-disable-line no-unused-vars

  /**
   * Returns true if the player at feetY can walk one step to world-x x.
   * Default: always passable (flat terrain has no walls).
   * WorldRealm overrides this to reject steps up sheer pyramid faces.
   */
  canStepTo(feetY, x) { return true; }          // eslint-disable-line no-unused-vars

  // ── Physics helpers ───────────────────────────────────

  // Apply one frame of gravity to py/pvy against a surface.
  // Returns the updated { py, pvy }.
  _gravityStep(py, pvy, surfY) {
    // Always apply gravity first (this decelerates jumps and accelerates falls).
    // Only snap to the surface and zero velocity on landing — never on the same
    // frame a jump was initiated (which would cancel pvy = -9 before it moves).
    pvy = Math.min(pvy + this.gravity, this.maxFallSpeed);
    py  = py + pvy;
    if (py >= surfY) {
      py  = surfY;
      pvy = 0;
    }
    return { py, pvy };
  }

  // Clamp world-x to [margin … worldW - margin].
  _clampX(x, margin = 14) {
    return Math.max(margin, Math.min(this.worldW - margin, x));
  }

  // Smooth-follow camera: lerp camX toward player, stay within world bounds.
  // Returns new camX.
  _trackCameraX(camX, px, lerpK = 0.1) {
    const target = Math.max(0, Math.min(this.worldW - CW, px - CW / 2));
    return camX + (target - camX) * lerpK;
  }
}

// ─────────────────────────────────────────────────────────
// RealmManager — registers realms, handles transitions,
// and manages a single active transition animation.
//
// Transition animations decouple "play a visual effect" from
// "swap the active realm". Realms call scheduleTransition()
// instead of directly calling transitionTo(); the manager
// plays the animation overlay, then fires the actual swap.
//
// Usage in main.js game loop:
//
//   RealmManager.current.update(ts);
//   RealmManager.tickTransition();        // advances + fires swap
//   X.clearRect(…);
//   RealmManager.current.render();
//   RealmManager.renderTransition();      // overlay on top
//
// ─────────────────────────────────────────────────────────

export const RealmManager = {
  _realms:     {},
  currentId:   'world',
  _transition: null,   // { toId, startT, duration, renderFn } | null

  get current() { return this._realms[this.currentId]; },

  register(realm) {
    this._realms[realm.id] = realm;
    return this;
  },

  // Immediate (no-animation) realm swap. Still fires onExit / onEnter.
  transitionTo(id) {
    if (!this._realms[id]) { console.warn('Unknown realm:', id); return; }
    const fromId = this.currentId;
    this.current.onExit();
    this.currentId = id;
    this.current.onEnter(fromId);
  },

  // Schedule a realm swap with an optional overlay animation.
  //
  //   toId     – id of the destination realm
  //   duration – animation length in ms (default 800)
  //   render   – (progress: 0..1) => void  (drawn over current render each frame)
  //
  // Input is NOT blocked here — realms that want to block input during a
  // transition should check RealmManager.isTransitioning themselves.
  scheduleTransition(toId, { duration = 800, render = null } = {}) {
    if (!this._realms[toId]) { console.warn('Unknown realm:', toId); return; }
    this._transition = { toId, startT: Date.now(), duration, renderFn: render };
  },

  get isTransitioning() { return this._transition !== null; },

  // Advance the active transition animation one tick.
  // When progress reaches 1, fires transitionTo() and clears itself.
  // Call once per frame from the game loop.
  tickTransition() {
    if (!this._transition) return;
    const elapsed  = Date.now() - this._transition.startT;
    if (elapsed >= this._transition.duration) {
      const toId = this._transition.toId;
      this._transition = null;
      this.transitionTo(toId);
    }
  },

  // Draw the current transition overlay. Call after current.render().
  renderTransition() {
    if (!this._transition || !this._transition.renderFn) return;
    const elapsed  = Date.now() - this._transition.startT;
    const progress = Math.min(1, elapsed / this._transition.duration);
    this._transition.renderFn(progress);
  },
};
