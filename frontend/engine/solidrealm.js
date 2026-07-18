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

    // Note: the first physicsStep after resetMotion() (realm entry) starts
    // ungrounded-to-grounded on frame one, so this can fire a "landing" with
    // no actual fall — subscribers that care should gate on impactVy.
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
