// ── FILE: worlds/sea/voyage.js ───────────────────────────
// The voyage simulation — pure (no DOM, no three.js). SeaRealm steps it with
// real elapsed time; scene.js only reads it. Fixed SUBSTEP steps inside an
// accumulator make the ship behave identically at 30, 60 or 144 fps.
//
// stepVoyage(v, input, dt) mutates `v` and returns this frame's events:
//   { type: 'departure' | 'first_swell' | 'strayed' | 'in_irons'
//         | 'crete_clearer' | 'arrived' (landed on Crete's beach) | 'scrape' | 'sunk' }
//   { type: 'wrecked', speed, id }   — a hard hit on rock; she sinks, then 'sunk'
//   { type: 'storm_rising', level }    { type: 'landmark_near', id }
//   { type: 'lightning', x, z, distance, power }
//   { type: 'haul_ropes' }  { type: 'heave', id: n }  { type: 'hauled' }   — dragging her up the beach
// input = { steer: -1..1 (+1 turns LEFT), trim: -1..1 (+1 raises sail), row: -1..1 (+1 rows harder) }

import { resolveWaves, heightAt, shelterAt } from './waves.js';
import { COLLIDERS } from './coast.js';

import {
  DEPARTURE, CRETE_BAY, COURSE_LEN, COURSE_HEADING,
  CORRIDOR_HALF, OUTER_LIMIT, BACK_LIMIT, FRONT_LIMIT, WALL_DRIFT, WALL_TURN,
  BEACH, SHELTER, beachY,
  WIND_VEER_MAX, CURRENT_SPEED, SAIL, ROW, WRECK, RUDDER, SUBSTEP, MAX_DT, STORM,
  LANDMARKS, LANDMARK_RADIUS, courseToWorld, worldToCourse, HULL, WAKE,
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
  const { along, lateral } = worldToCourse(v.x, v.z);
  const p    = clamp(along / COURSE_LEN, 0, 1);
  const ramp = 0.1 + 0.25 * smoothstep(0, 0.25, p) + 0.4 * smoothstep(0.6, 0.95, p);
  const off  = STORM.offCourse * clamp((Math.abs(lateral) - CORRIDOR_HALF) / (OUTER_LIMIT - CORRIDOR_HALF), 0, 1);
  const open = v.arrived ? STORM.moored : clamp(ramp + off, 0, 1);
  const exposed = (shelterAt(SHELTER, v.x, v.z) - SHELTER.calm) / (1 - SHELTER.calm);   // 0 in the bay … 1 outside
  return STORM.bay + (open - STORM.bay) * exposed;
}

/** Where the haul stands `t` s after landing. First the hired men go over the side with the ropes
    ('ashore', u 0..1); then BEACH.heaves heaves, each bracing through its slack and then pulling
    her a length up the rollers ('heaving': heave index, f 0..1 through the heave, pull 0..1
    through its pull); then 'done'. `dist` is how far she has come. */
export function haulProgress(t) {
  if (t < BEACH.ashore) return { stage: 'ashore', u: t / BEACH.ashore, heave: -1, f: 0, pull: 0, dist: 0 };
  const s = (t - BEACH.ashore) / BEACH.heaveTime;
  if (s >= BEACH.heaves) return { stage: 'done', u: 1, heave: BEACH.heaves - 1, f: 1, pull: 1, dist: BEACH.haul };
  const heave = Math.floor(s), f = s - heave;
  const pull = smoothstep(BEACH.slack, 1, f);
  return { stage: 'heaving', u: 1, heave, f, pull, dist: BEACH.haul * (heave + pull) / BEACH.heaves };
}

export function createVoyage({ rng = Math.random, waveParams } = {}) {
  return {
    t: 0, acc: 0, rng, waveParams,
    x: DEPARTURE.x, z: DEPARTURE.z,
    heading: COURSE_HEADING, speed: 0, rudder: 0, sail: SAIL.start, rowing: ROW.start,
    windAngle: COURSE_HEADING,              // direction the wind blows TOWARD
    sailDrive: 0, drive: 0,                 // last substep's sail drive and total drive (m/s²)
    storm: 0.1, arrived: false, landed: false, haulT: 0, hauled: 0, sinking: false, sinkT: 0, sunk: false,
    hull: { y: 0, vy: 0, pitch: 0, pitchVel: 0, roll: 0, rollVel: 0 },
    wake: [], wakeTimer: 0,
    ironsTime: 0, nextFlash: 8, scrapeTimer: 0,
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
  if (v.sinking) {                                  // holed: she fills and goes down
    v.speed = 0; v.sailDrive = 0; v.drive = 0;
    v.sinkT += h;
    v.storm += (stormTarget(v) - v.storm) * (1 - Math.exp(-h / STORM.tau));
    _hull(v, h, 0);
    if (!v.sunk && v.sinkT >= WRECK.sinkTime) { v.sunk = true; events.push({ type: 'sunk' }); }
    return;
  }
  if (v.landed) {                                   // beached: the crew hauls her up the rollers, then she stays
    v.speed = 0; v.sailDrive = 0; v.drive = 0;
    const total = BEACH.ashore + BEACH.heaves * BEACH.heaveTime;
    if (v.haulT < total) {
      if (v.haulT === 0) events.push({ type: 'haul_ropes' });
      const was = haulProgress(v.haulT);
      v.haulT = Math.min(total, v.haulT + h);
      const now = haulProgress(v.haulT);
      if (now.heave > was.heave) events.push({ type: 'heave', id: now.heave });
      if (now.stage === 'done') events.push({ type: 'hauled' });
      const step = now.dist - v.hauled;
      v.hauled = now.dist;
      v.x += FX * step; v.z += FZ * step;                                         // straight up the beach
      v.heading = wrapAngle(v.heading + wrapAngle(COURSE_HEADING - v.heading) * Math.min(1, h * 0.5));
    }
    v.storm += (stormTarget(v) - v.storm) * (1 - Math.exp(-h / STORM.tau));
    _hull(v, h, 0);
    _lightning(v, h, events);
    return;
  }
  const steer = clamp(input.steer ?? 0, -1, 1);
  const trim  = clamp(input.trim ?? 0, -1, 1);
  const row   = clamp(input.row ?? 0, -1, 1);

  // ── Controls: trim ramps, the rudder eases, and turning needs way on ──
  v.sail    = clamp(v.sail + trim * SAIL.rate * h, 0, 1);
  v.rowing  = clamp(v.rowing + row * ROW.rate * h, 0, 1);
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
  const pol = polar(off);
  v.sailDrive = v.sail * pol * SAIL.drive;
  v.drive = v.sailDrive + v.rowing * ROW.drive;              // the rowers push whatever the wind does
  v.speed = Math.max(0, v.speed + (v.drive - SAIL.drag * v.speed * v.speed) * h);

  // ── Ground velocity = bow + current, limited by the soft walls ──
  const cur = v.arrived ? 0 : CURRENT_SPEED;
  let vx = Math.sin(v.heading) * v.speed + FX * cur;
  let vz = Math.cos(v.heading) * v.speed + FZ * cur;
  [vx, vz] = _walls(v, along, lateral, vx, vz);
  v.x += vx * h;
  v.z += vz * h;
  _beach(v, h, events);
  _collide(v, h, vx, vz, events);

  // ── Storm eases toward its target ──
  v.storm += (stormTarget(v) - v.storm) * (1 - Math.exp(-h / STORM.tau));

  _hull(v, h, pol);
  _wake(v, h);
  _lightning(v, h, events);
  _events(v, h, events);
}

/** Past a limit: cancel outward velocity and drift back in (overshoot ≤ one substep). */
function _axis(pos, min, max, vel) {
  if (pos > max) return Math.min(vel, 0) - WALL_DRIFT * Math.min(1, (pos - max) / 50);
  if (pos < min) return Math.max(vel, 0) + WALL_DRIFT * Math.min(1, (min - pos) / 50);
  return vel;
}

function _walls(v, along, lateral, vx, vz) {
  const onBeach = Math.abs(lateral) < BEACH.halfWidth - HULL.halfBeam;     // the cliffs open only here
  const va = _axis(along, BACK_LIMIT, onBeach ? Infinity : FRONT_LIMIT, vx * FX + vz * FZ);
  const vl = _axis(lateral, -OUTER_LIMIT, OUTER_LIMIT, vx * RX + vz * RZ);
  vx = FX * va + RX * vl;
  vz = FZ * va + RZ * vl;
  return [vx, vz];
}

/** Rock is solid. The hull is a capsule — the keel line bow to stern, radius halfBeam —
    tested against every collider in coast.js. A slow contact pushes the ship clear and
    scrapes her speed off; one closing faster than WRECK.sinkSpeed holes the hull. */
function _collide(v, h, vx, vz, events) {
  v.scrapeTimer = Math.max(0, v.scrapeTimer - h);
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const reach = HULL.halfLen + HULL.halfBeam;
  for (const c of COLLIDERS) {
    const dx = c.x - v.x, dz = c.z - v.z;
    if (dx * dx + dz * dz > (c.r + reach) ** 2) continue;
    const t  = clamp(dx * fx + dz * fz, -HULL.halfLen, HULL.halfLen);     // nearest point on the keel line
    const nx = v.x + fx * t - c.x, nz = v.z + fz * t - c.z;
    const d = Math.hypot(nx, nz), min = c.r + HULL.halfBeam;
    if (d >= min || d === 0) continue;
    const ux = nx / d, uz = nz / d;
    const closing = -(vx * ux + vz * uz);                                   // m/s she was driving into the rock
    if (closing > WRECK.sinkSpeed) {
      v.sinking = true;
      v.speed = 0;
      events.push({ type: 'wrecked', speed: closing, id: c.id });
      return;
    }
    v.x += ux * (min - d);
    v.z += uz * (min - d);
    v.speed = Math.max(0, v.speed - Math.max(0, closing) * 1.5);
    if (v.scrapeTimer === 0) { v.scrapeTimer = WRECK.scrapeCooldown; events.push({ type: 'scrape', id: c.id }); }
  }
}

/** Crete's beach: inside the landing band the bow runs up the sand, the ship grinds
    to a stop, and she is landed — the arrival. */
function _beach(v, h, events) {
  const { along, lateral } = worldToCourse(v.x, v.z);
  if (Math.abs(lateral) >= BEACH.halfWidth - HULL.halfBeam) return;
  const depth = along + Math.cos(v.heading - COURSE_HEADING) * HULL.halfLen - BEACH.along;   // how far the bow is up the sand
  if (depth <= 0) return;
  v.speed = Math.max(0, v.speed - (BEACH.friction + depth * BEACH.bite) * h);
  if (v.speed < 0.3) {
    v.speed = 0;
    v.landed = true;
    if (!v.arrived) { v.arrived = true; events.push({ type: 'arrived' }); }
  }
}

/** Five hull samples on the shared wave surface drive heave, pitch and roll
    through damped springs; sail force adds heel away from the wind. */
function _hull(v, h, pol) {
  const comps = resolveWaves(v.storm, COURSE_HEADING, v.waveParams);
  const fx = Math.sin(v.heading),  fz = Math.cos(v.heading);
  const rx = -Math.cos(v.heading), rz = Math.sin(v.heading);
  const at = (fwd, right) => heightAt(comps, v.x + fx * fwd + rx * right, v.z + fz * fwd + rz * right, v.t, SHELTER);
  // Driving into the waves the ship meets crests sooner, so the bow reads the water a little ahead of itself.
  const lead = Math.min(6, v.speed * 0.35);
  const bow  = at(HULL.halfLen + lead, 0),             stern  = at(-HULL.halfLen, 0);
  const bowQ = at(HULL.halfLen * 0.5 + lead * 0.5, 0), sternQ = at(-HULL.halfLen * 0.5, 0);
  const port = at(0, -HULL.halfBeam),     star   = at(0, HULL.halfBeam), mid = at(0, 0);
  const samples = [bow, bowQ, mid, sternQ, stern, port, star];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const heaveTarget = mean + HULL.crestLift * Math.max(0, Math.max(...samples) - mean);
  const sunk = v.sinking ? Math.min(1, v.sinkT / WRECK.sinkTime) : 0;       // 0 afloat … 1 gone
  const hl = v.hull;

  // On the beach the keel takes the ground: two points on her belly rest on the sand's slope.
  const { along, lateral } = worldToCourse(v.x, v.z);
  let ground = -Infinity, groundPitch = 0;
  if (Math.abs(lateral) < BEACH.halfWidth && along > BEACH.along - 40) {
    const reach = Math.cos(v.heading - COURSE_HEADING) * BEACH.contact;
    const fore = beachY(along + reach - BEACH.along), aft = beachY(along - reach - BEACH.along);
    ground = (fore + aft) / 2 + BEACH.keel;
    groundPitch = Math.atan2(fore - aft, 2 * BEACH.contact);
  }
  const aground = ground > heaveTarget;
  const spring = (pos, vel, target, k, zeta) => vel + (k * (target - pos) - 2 * zeta * Math.sqrt(k) * vel) * h;

  hl.vy = spring(hl.y, hl.vy, (aground ? ground : heaveTarget) - WRECK.depth * sunk * sunk, HULL.kHeave, HULL.zetaHeave);
  hl.y += hl.vy * h;
  if (hl.y < ground) { hl.y = ground; hl.vy = Math.max(0, hl.vy); }        // sand doesn't give

  const pitchTarget = Math.atan2((bow + bowQ) / 2 - (stern + sternQ) / 2, 1.5 * HULL.halfLen + 0.75 * lead);
  hl.pitchVel = spring(hl.pitch, hl.pitchVel, v.sinking ? WRECK.pitch * sunk : aground ? groundPitch : pitchTarget, HULL.kPitch, HULL.zetaPitch);
  hl.pitch += hl.pitchVel * h;

  // +roll leans to starboard; wind pushes the rig to leeward, so lean away from it.
  const heel = HULL.heelMax * v.sail * pol * Math.sin(wrapAngle(v.heading - v.windAngle));
  hl.rollVel = spring(hl.roll, hl.rollVel, (v.sinking ? WRECK.roll * sunk : aground ? BEACH.restRoll : Math.atan2(port - star, 2 * HULL.halfBeam) + heel), HULL.kRoll, HULL.zetaRoll);
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

  // In irons: sail up but giving nothing, for 3 s (the rowers may still be making way).
  if (v.sail > 0.3 && v.sailDrive === 0) {
    v.ironsTime += h;
    if (v.ironsTime > 3 && v.armed.irons) { v.armed.irons = false; events.push({ type: 'in_irons' }); }
  } else {
    v.ironsTime = 0;
    v.armed.irons = true;
  }

  // Arrival is running up the beach — see _beach().
}
