// ── FILE: worlds/sea/chasecam.js ─────────────────────────
// Chase-camera math — pure. A critically damped spring solved EXACTLY per
// frame (not integrated), so it is frame-rate independent and never
// overshoots a still target. scene.js copies the result onto a three camera.
//
// The default view is a three-quarter chase (behind, above, off to one side) so
// the hull, sail and pharaoh stay visible. Dragging orbits the camera around the
// ship; the view holds where you leave it, and resetOrbit() returns to the chase view.

export const CHASE = {
  back: 18, up: 7,             // m from / above the hull
  side: 0.6,                   // rad the default view swings off the stern — a three-quarter view
  lookAhead: 5, lookUp: 3,     // look just ahead of the hull centre, so the ship stays in frame
  omega: 2.2,                  // follow stiffness (rad/s) — lower = lazier lag on turns
  omegaDrag: 9,                // stiffer while dragging, so looking around feels direct
  dragYaw: 0.006,              // rad per pixel dragged sideways
  dragPitch: 0.004,            // per pixel dragged vertically (height as a fraction of `back`)
  pitchMin: -0.25, pitchMax: 0.9,
  introTau: 2.5,               // s — the departure shot's swing round to the chase view
  rollShare: 0.2,              // share of the ship's roll the camera takes
  fovBase: 52, fovPerSpeed: 0.6,
};

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export function createChaseCam() {
  return { ready: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
           lookX: 0, lookY: 0, lookZ: 0, roll: 0, fov: CHASE.fovBase,
           orbitYaw: 0, orbitPitch: 0, dragging: false, easeHome: false };
}

/** Player drag: swing around the ship (dx) and raise/lower the view (dy), in pixels. */
export function orbitDrag(cam, dx, dy) {
  cam.dragging = true;
  cam.easeHome = false;                                  // the player takes over from the intro
  cam.orbitYaw   = wrap(cam.orbitYaw - dx * CHASE.dragYaw);
  cam.orbitPitch = Math.min(CHASE.pitchMax, Math.max(CHASE.pitchMin, cam.orbitPitch - dy * CHASE.dragPitch));
}

export function releaseOrbit(cam) {
  cam.dragging = false;
}

/** Back to the default three-quarter chase view. */
export function resetOrbit(cam) {
  cam.orbitYaw = 0;
  cam.orbitPitch = 0;
  cam.easeHome = false;
}

/** Departure shot: start ahead of the bow looking back (the Delta, the pyramids),
    then swing round to the chase view. Only this eases; a player's drag holds. */
export function introOrbit(cam) {
  cam.orbitYaw = Math.PI * 0.999;
  cam.orbitPitch = 0.15;
  cam.easeHome = true;
}

export function chaseTarget(v, cam = null) {
  const yaw  = v.heading + CHASE.side + (cam ? cam.orbitYaw : 0);
  const lift = cam ? cam.orbitPitch : 0;
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  return {
    x: v.x - Math.sin(yaw) * CHASE.back, y: v.hull.y + CHASE.up + lift * CHASE.back, z: v.z - Math.cos(yaw) * CHASE.back,
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
  if (cam.easeHome && !cam.dragging) {
    const k = Math.exp(-dt / CHASE.introTau);
    cam.orbitYaw *= k;
    cam.orbitPitch *= k;
    if (Math.abs(cam.orbitYaw) < 0.001) cam.easeHome = false;
  }
  const t = chaseTarget(v, cam);
  const omega = cam.dragging ? CHASE.omegaDrag : CHASE.omega;
  if (!cam.ready) {
    Object.assign(cam, { ready: true, x: t.x, y: t.y, z: t.z, vx: 0, vy: 0, vz: 0 });
  } else {
    [cam.x, cam.vx] = springAxis(cam.x, cam.vx, t.x, omega, dt);
    [cam.y, cam.vy] = springAxis(cam.y, cam.vy, t.y, omega, dt);
    [cam.z, cam.vz] = springAxis(cam.z, cam.vz, t.z, omega, dt);
  }
  cam.lookX = t.lookX; cam.lookY = t.lookY; cam.lookZ = t.lookZ;
  cam.roll = v.hull.roll * CHASE.rollShare;
  cam.fov  = CHASE.fovBase + CHASE.fovPerSpeed * v.speed;
  return cam;
}
