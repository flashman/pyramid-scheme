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
