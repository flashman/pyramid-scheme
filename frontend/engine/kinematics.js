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
      // Over the cap: clamp to max (friction bleed happens on release, not during accel)
      vx = Math.sign(vx) * max;
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
