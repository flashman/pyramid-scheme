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
