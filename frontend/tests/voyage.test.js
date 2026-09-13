import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoyage, stepVoyage, polar, stormTarget, wrapAngle, haulProgress } from '../worlds/sea/voyage.js';
import {
  COURSE_HEADING, COURSE_LEN, CRETE_BAY, OUTER_LIMIT, SAIL, ROW, STORM, BEACH, FRONT_LIMIT, HULL, WRECK, beachY,
  courseToWorld, worldToCourse,
} from '../worlds/sea/constants.js';
import { COLLIDERS } from '../worlds/sea/coast.js';
import { sail, steerToward } from './helpers/sea.js';

const place = (v, along, lateral) => { const p = courseToWorld(along, lateral); v.x = p.x; v.z = p.z; };

test('course frame round-trips', () => {
  const p = courseToWorld(812, -143);
  const c = worldToCourse(p.x, p.z);
  assert.ok(Math.abs(c.along - 812) < 1e-9 && Math.abs(c.lateral + 143) < 1e-9);
  const bay = worldToCourse(CRETE_BAY.x, CRETE_BAY.z);
  assert.ok(Math.abs(bay.along - COURSE_LEN) < 1e-9 && Math.abs(bay.lateral) < 1e-9);
});

test('wrapAngle keeps angles in (-π, π]', () => {
  assert.equal(wrapAngle(0.5), 0.5);
  assert.ok(Math.abs(wrapAngle(-7) - (-7 + 2 * Math.PI)) < 1e-12);
  assert.ok(Math.abs(Math.abs(wrapAngle(3 * Math.PI)) - Math.PI) < 1e-12);
});

test('polar: no drive in irons, strongest dead downwind, never decreasing', () => {
  assert.equal(polar(0), 0);
  assert.equal(polar(SAIL.irons - 0.01), 0);
  assert.ok(Math.abs(polar(Math.PI / 2) - 0.9) < 1e-12);
  assert.equal(polar(Math.PI), 1);
  let prev = 0;
  for (let i = 0; i <= 100; i++) { const p = polar(Math.PI * i / 100); assert.ok(p >= prev - 1e-12); prev = p; }
});

test('departure fires once, on the first step', () => {
  const v = createVoyage();
  const events = sail(v, 2, 60, () => ({}));
  assert.equal(events.filter(e => e.type === 'departure').length, 1);
  assert.equal(events[0].type, 'departure');
});

test('speed converges to terminal velocity downwind at full sail (traced through drag)', () => {
  const v = createVoyage();
  v.rowing = 0;                                            // the sail alone
  sail(v, 60, 60, () => ({ trim: 1 }));
  const terminal = Math.sqrt(SAIL.drive / SAIL.drag);
  assert.ok(Math.abs(v.speed - terminal) / terminal < 0.01, `speed ${v.speed}`);
});

test('in irons the ship barely moves, and says so', () => {
  const v = createVoyage();
  v.heading = wrapAngle(COURSE_HEADING + Math.PI);          // bow straight into the wind
  v.rowing = 0;
  const events = sail(v, 30, 60, () => ({ trim: 1 }));
  assert.ok(v.speed < 0.5, `speed ${v.speed}`);
  assert.ok(events.some(e => e.type === 'in_irons'));
});

test('the rowers add their own drive, even into the wind, set by ⇧↑/⇧↓', () => {
  const v = createVoyage();
  v.heading = wrapAngle(COURSE_HEADING + Math.PI);          // into the wind: the sail gives nothing
  v.rowing = 0;
  sail(v, 5, 60, () => ({ row: 1 }));
  assert.ok(v.rowing > 0.99, `rowing ${v.rowing}`);
  sail(v, 30, 60, () => ({}));
  const expected = Math.sqrt(ROW.drive / SAIL.drag);
  assert.ok(Math.abs(v.speed - expected) / expected < 0.02, `speed ${v.speed} vs ${expected}`);
  sail(v, 5, 60, () => ({ row: -1 }));
  assert.equal(v.rowing, 0);
});

test('steer +1 turns left (heading increases)', () => {
  const v = createVoyage();
  v.speed = 8;
  sail(v, 1, 60, () => ({ steer: 1, trim: 1 }));
  assert.ok(wrapAngle(v.heading - COURSE_HEADING) > 0);
});

test('a stopped ship cannot spin', () => {
  const v = createVoyage();
  v.sail = 0; v.rowing = 0; v.speed = 0;
  sail(v, 5, 60, () => ({ steer: 1, trim: -1 }));
  assert.ok(Math.abs(wrapAngle(v.heading - COURSE_HEADING)) < 1e-9);
});

test('sailing into the hidden bay mouth and up the beach lands in 180–300 s, untouched by rock', () => {
  const v = createVoyage();
  const route = [courseToWorld(COURSE_LEN - 300, 300), courseToWorld(COURSE_LEN - 50, 230), courseToWorld(BEACH.along + 50, 0)];
  let leg = 0, t = 0; const events = [];
  while (!v.arrived && !v.sinking && t < 400) {
    const w = route[leg];
    if (leg < route.length - 1 && Math.hypot(w.x - v.x, w.z - v.z) < 60) leg++;
    events.push(...stepVoyage(v, steerToward(Math.atan2(w.x - v.x, w.z - v.z))(v), 1 / 60));
    t += 1 / 60;
  }
  const hit = events.find(e => e.type === 'wrecked' || e.type === 'scrape');
  assert.equal(hit, undefined, `struck ${hit?.id}`);
  assert.ok(v.arrived, 'never arrived');
  assert.ok(t >= 180 && t <= 300, `arrived at ${t.toFixed(1)} s`);
});

/** Put the ship `gap` metres short of a collider's edge, heading straight at it. */
function aimAt(v, id, gap) {
  const c = COLLIDERS.find(k => k.id === id);
  const at = worldToCourse(c.x, c.z);
  place(v, at.along - c.r - HULL.halfLen - gap, at.lateral);
  v.heading = COURSE_HEADING;
}

test('a hard hit on rock opens the hull and the ship sinks', () => {
  const v = createVoyage();
  aimAt(v, 'signal_rock', 20);
  v.speed = 10; v.sail = 1;
  const events = sail(v, 12, 60, () => ({ trim: 1 }));
  const wreck = events.find(e => e.type === 'wrecked');
  assert.ok(wreck && wreck.id === 'signal_rock' && wreck.speed > WRECK.sinkSpeed, JSON.stringify(wreck));
  assert.equal(events.filter(e => e.type === 'sunk').length, 1);
  assert.ok(v.sunk && v.hull.y < -5, `hull at ${v.hull.y}`);
});

test('a slow nudge only scrapes', () => {
  const v = createVoyage();
  aimAt(v, 'signal_rock', 1);
  v.speed = 1; v.sail = 0; v.rowing = 0;
  const events = sail(v, 4, 60, () => ({ trim: -1, row: -1 }));
  assert.ok(events.some(e => e.type === 'scrape'), 'no scrape');
  assert.ok(!v.sinking && !events.some(e => e.type === 'wrecked'));
});

test('no rock stands on the landing beach', () => {
  for (const c of COLLIDERS) {
    const { along, lateral } = worldToCourse(c.x, c.z);
    if (along > BEACH.along - 250) assert.ok(Math.abs(lateral) - c.r > BEACH.halfWidth, `${c.id} at lateral ${lateral.toFixed(0)}`);
  }
});

test('steering hard away from the course never escapes the outer limit', () => {
  const v = createVoyage();
  const policy = steerToward(COURSE_HEADING - Math.PI / 2);   // beam reach, straight off the line
  let maxLat = 0; const events = [];
  for (let i = 0; i < 600 * 60; i++) {
    events.push(...stepVoyage(v, policy(v), 1 / 60));
    maxLat = Math.max(maxLat, Math.abs(worldToCourse(v.x, v.z).lateral));
  }
  assert.ok(maxLat <= OUTER_LIMIT + 5, `max lateral ${maxLat.toFixed(1)}`);
  assert.ok(events.some(e => e.type === 'strayed'));
});

test('storm target ramps with progress, rises off course, and falls calm in the bay', () => {
  const v = createVoyage();
  assert.ok(Math.abs(stormTarget(v) - 0.1) < 1e-9);
  place(v, COURSE_LEN / 2, 0);   assert.ok(Math.abs(stormTarget(v) - 0.35) < 1e-9);
  place(v, COURSE_LEN - 700, 0); const approach = stormTarget(v); assert.ok(approach > 0.4 && approach < 0.75, `approach ${approach}`);
  place(v, COURSE_LEN, 0);       assert.ok(Math.abs(stormTarget(v) - STORM.bay) < 1e-9);
  place(v, 1200, OUTER_LIMIT);   assert.ok(Math.abs(stormTarget(v) - 0.70) < 1e-9);
  v.arrived = true;              assert.equal(stormTarget(v), STORM.moored);
});

test('storm intensity converges to its target', () => {
  const v = createVoyage();
  place(v, 1200, 0);
  v.sail = 0; v.rowing = 0;
  sail(v, 60, 60, () => ({ trim: -1 }));
  assert.ok(Math.abs(v.storm - stormTarget(v)) < 0.01, `storm ${v.storm}`);
});

test('storm_rising fires once per threshold', () => {
  const v = createVoyage();
  place(v, 2000, OUTER_LIMIT - 10);       // late and far off course, outside the bay: target ≈ 1
  v.sail = 0; v.rowing = 0;
  const events = sail(v, 60, 60, () => ({ trim: -1 }));
  const levels = events.filter(e => e.type === 'storm_rising').map(e => e.level);
  assert.deepEqual(levels, STORM.marks);
});

test('landmark_near fires once per landmark', () => {
  const v = createVoyage();
  place(v, 500, 140);                      // the wreck
  v.sail = 0; v.rowing = 0;
  const events = sail(v, 3, 60, () => ({ trim: -1 }));
  assert.equal(events.filter(e => e.type === 'landmark_near' && e.id === 'wreck').length, 1);
});

test('the haul: over the side, then heaves that brace and pull, then done', () => {
  const total = BEACH.ashore + BEACH.heaves * BEACH.heaveTime;
  assert.equal(haulProgress(0).stage, 'ashore');
  assert.equal(haulProgress(BEACH.ashore * 0.9).dist, 0);
  let last = 0;
  for (let t = 0; t <= total + 1; t += 0.05) { const d = haulProgress(t).dist; assert.ok(d >= last - 1e-9, `slid back at ${t}`); last = d; }
  const bracing = [0.01, BEACH.slack * 0.9].map(f => haulProgress(BEACH.ashore + (2 + f) * BEACH.heaveTime).dist);
  assert.ok(Math.abs(bracing[0] - 2 * BEACH.haul / BEACH.heaves) < 1e-6 && Math.abs(bracing[1] - bracing[0]) < 1e-9, 'moved while bracing');
  assert.equal(haulProgress(total).stage, 'done');
  assert.equal(haulProgress(total).dist, BEACH.haul);
});

test('the beach rises from under the bay to a flat berm', () => {
  assert.equal(beachY(0), 0);
  assert.ok(Math.abs(beachY(10) - 10 * BEACH.slope) < 1e-12);
  assert.equal(beachY(-100), BEACH.toe);
  assert.equal(beachY(1000), BEACH.top);
});

test('running up the beach lands the ship; the crew hauls her clear of the water and she stays put', () => {
  const v = createVoyage();
  place(v, BEACH.along - 150, 0);
  const events = [];
  for (let i = 0; i < 60 * 60 && !v.landed; i++) events.push(...stepVoyage(v, { trim: 1 }, 1 / 60));
  assert.ok(events.some(e => e.type === 'arrived'), 'never landed');
  assert.ok(v.landed && v.speed === 0);
  const bow = worldToCourse(v.x, v.z).along + HULL.halfLen;
  assert.ok(bow >= BEACH.along && bow <= BEACH.along + 10, `bow at ${(bow - BEACH.along).toFixed(1)} m up the sand`);
  const before = worldToCourse(v.x, v.z).along;
  events.push(...sail(v, BEACH.ashore + BEACH.heaves * BEACH.heaveTime + 4, 60, () => ({ trim: 1, row: 1 })));
  assert.equal(events.filter(e => e.type === 'haul_ropes').length, 1);
  assert.deepEqual(events.filter(e => e.type === 'heave').map(e => e.id), [...Array(BEACH.heaves).keys()]);
  assert.equal(events.filter(e => e.type === 'hauled').length, 1);
  const hauled = worldToCourse(v.x, v.z).along - before;
  assert.ok(Math.abs(hauled - BEACH.haul) < 0.5, `hauled ${hauled.toFixed(1)} m`);
  assert.ok(v.hull.y - BEACH.keel > 0.8, `belly ${(v.hull.y - BEACH.keel).toFixed(2)} m above the bay`);
  assert.ok(Math.abs(v.hull.pitch - Math.atan(BEACH.slope)) < 0.02, `pitch ${v.hull.pitch.toFixed(3)}`);
  const x = v.x, z = v.z;
  sail(v, 30, 60, () => ({ trim: 1, row: 1 }));
  assert.ok(Math.hypot(v.x - x, v.z - z) < 0.01, 'moved after hauling');
  assert.equal(stormTarget(v), STORM.bay);
});

test('the cliffs either side of the beach stop the ship short of the shore', () => {
  const v = createVoyage();
  place(v, BEACH.along - 150, BEACH.halfWidth + 80);
  let maxAlong = -Infinity; const events = [];
  for (let i = 0; i < 60 * 60; i++) {
    events.push(...stepVoyage(v, { trim: 1 }, 1 / 60));
    maxAlong = Math.max(maxAlong, worldToCourse(v.x, v.z).along);
  }
  assert.ok(maxAlong <= FRONT_LIMIT + 5, `max along ${maxAlong.toFixed(1)} vs ${FRONT_LIMIT.toFixed(1)}`);
  assert.ok(!v.arrived);
});
