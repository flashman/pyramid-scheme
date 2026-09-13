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
export const FRONT_LIMIT   = COURSE_LEN + 110;    // soft wall at Crete's cliffs — open only where the beach is (see BEACH)
export const WALL_DRIFT    = 3;                   // m/s pushed back in, at 50 m past a wall
export const WALL_TURN     = 0.4;                 // rad/s the sea swings the bow back (beats full rudder)

// Crete's landing beach, in the cove below Knossos. Bronze Age ships were beached, not
// moored at quays. Inside |lateral| < halfWidth the front wall opens and the bow can run
// up the sand — that is the arrival. Either side of it are cliffs.
export const BEACH = {
  along:     COURSE_LEN + 150,                     // the waterline (along-course m)
  halfWidth: 100,                                  // half-width of the beach across the course
  friction:  4,                                    // m/s² the sand takes off the ship once the bow is on it
  bite:      3,                                    // extra m/s² per metre the bow has run up
  slope:     0.1,                                  // the sand rises 1 m in 10 from the waterline…
  toe:      -1.6,                                  // …out of the bay floor here…
  top:       3.2,                                  // …up to a flat berm
  keel:      0.6,                                  // hull origin above the two points of her belly that take the ground
  contact:   4,                                    // m fore and aft of amidships where those points are
  haul:      22,                                   // m the hired men drag her up the rollers once she's landed…
  ashore:    3.5,                                  // …after this long going over the side and walking the ropes out…
  heaves:    7,                                    // …in this many heaves…
  heaveTime: 2.4,                                  // …of this many seconds each…
  slack:     0.45,                                 // …the first part of which is bracing, before the pull
  restRoll:  0.03,                                 // a slight list on the sand
};

/** Sand height at `depth` m up the beach from the waterline (negative: under the bay).
    The sand mesh in gfx/landmarks.js and the keel in voyage.js both read this. */
export function beachY(depth) {
  return Math.min(BEACH.top, Math.max(BEACH.toe, depth * BEACH.slope));
}

export const WIND_SPEED    = 11;                  // m/s — visual/audio only; drive is SAIL.drive
export const WIND_VEER_MAX = 0.9;                 // rad the wind veers toward the line at OUTER_LIMIT
export const CURRENT_SPEED = 0.6;                 // m/s drift toward Crete (off after arrival)

export const SAIL = {
  rate:  0.6,                                     // trim change per second while ↑/↓ held
  start: 0.5,                                     // trim at departure
  drive: 1.2,                                     // m/s² at full sail, dead downwind
  drag:  0.015,                                   // quadratic → terminal speed √(drive/drag) = 10 m/s
  irons: 40 * Math.PI / 180,                      // within this of the wind's source: no drive
};

// The rowers push whatever the wind does. ⇧+↑/↓ sets their effort.
export const ROW = {
  rate:  0.5,                                     // effort change per second while ⇧+↑/↓ held
  start: 0.4,                                     // effort at departure
  drive: 0.6,                                     // m/s² at full effort
};

// Rock is solid (coast.js lays it out). A contact closing faster than sinkSpeed wrecks the ship.
export const WRECK = {
  sinkSpeed:      3.1,                             // m/s (≈ 6 knots) closing speed that holes the hull; slower contacts scrape
  sinkTime:       7,                               // seconds from the hit until she is gone
  depth:          14,                              // metres she settles by the end
  pitch:         -0.4,                             // bow-down as she fills
  roll:           0.5,                             // and heeling over
  scrapeCooldown: 4,                               // seconds between scrape events
};

export const RUDDER = {
  max:      0.6,                                  // rudder angle at full input (rad)
  tau:      0.35,                                 // seconds for the rudder to ease toward input
  turnGain: 0.02,                                 // yaw rate = speed · rudder · turnGain (rad/s)
};

export const HULL = {
  halfLen: 9, halfBeam: 2.4,
  kHeave: 12, zetaHeave: 0.7,                     // stiff enough to ride chop instead of lagging under it
  kPitch: 10, zetaPitch: 0.7,
  kRoll:   8, zetaRoll:  0.6,
  crestLift: 0.3,                                 // ride up onto the highest sampled crest this much
  deckHeight: 0.8,                                // deck above the hull origin (FREEBOARD + DECK_Y in gfx/ship.js)
  heelMax: 0.14,                                  // rad of lean at full sail on a beam wind
};

export const SUBSTEP = 1 / 120;                   // fixed physics step (s)
export const MAX_DT  = 0.1;                       // a long frame (tab switch) is clamped to this

export const STORM = {
  tau:       6,                                   // seconds for intensity to ease toward target
  offCourse: 0.35,                                // extra intensity at OUTER_LIMIT
  moored:    0.2,                                 // target once arrived
  bay:       0.08,                                // target inside the bay's shelter
  marks:     [0.3, 0.5, 0.7],                     // storm_rising narration thresholds
  flashFrom: 0.25,                                // lightning begins above this intensity
};

export const WAKE = { every: 0.25, max: 32 };     // seconds between wake points; ring size

export const LANDMARK_RADIUS = 260;
export const LANDMARKS = [
  { id: 'wreck',       along:  500, lateral:  140 },
  { id: 'signal_rock', along: 1150, lateral: -190 },
];
// The bay behind the hooked headland is sheltered: waves fall to `calm` inside `inner`
// of the bay centre, back to full strength by `outer` (past the mouth). Shared by the
// GPU wave shader and the ship's buoyancy (waves.js), and by the storm target.
export const SHELTER = { x: CRETE_BAY.x, z: CRETE_BAY.z, inner: 260, outer: 520, calm: 0.15 };

export const CRETE_ISLAND = { along: COURSE_LEN + 850, lateral: 0, radius: 900, height: 460 };   // puts the cove's waterline at BEACH.along

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
