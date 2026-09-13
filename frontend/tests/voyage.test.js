import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoyage, stepVoyage, polar, stormTarget, wrapAngle } from '../worlds/sea/voyage.js';
import {
  COURSE_HEADING, COURSE_LEN, CRETE_BAY, OUTER_LIMIT, SAIL, ROW, STORM, BEACH, FRONT_LIMIT, HULL,
  courseToWorld, worldToCourse,
} from '../worlds/sea/constants.js';
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

test('sailing straight for Crete lands on the beach in 180–300 s', () => {
  const v = createVoyage();
  const beach = courseToWorld(BEACH.along + 50, 0);
  let t = 0;
  while (!v.arrived && t < 400) {
    stepVoyage(v, steerToward(Math.atan2(beach.x - v.x, beach.z - v.z))(v), 1 / 60);
    t += 1 / 60;
  }
  assert.ok(v.arrived, 'never arrived');
  assert.ok(t >= 180 && t <= 300, `arrived at ${t.toFixed(1)} s`);
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

test('storm target ramps with progress and rises off course', () => {
  const v = createVoyage();
  assert.ok(Math.abs(stormTarget(v) - 0.1) < 1e-9);
  place(v, COURSE_LEN / 2, 0);   assert.ok(Math.abs(stormTarget(v) - 0.35) < 1e-9);
  place(v, COURSE_LEN, 0);       assert.ok(Math.abs(stormTarget(v) - 0.75) < 1e-9);
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
  place(v, COURSE_LEN - 250, 0);          // storm target 0.75
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

test('running up the beach lands the ship: she stops on the sand and stays put', () => {
  const v = createVoyage();
  place(v, BEACH.along - 150, 0);
  const events = sail(v, 60, 60, () => ({ trim: 1 }));
  assert.ok(events.some(e => e.type === 'arrived'), 'never landed');
  assert.ok(v.landed && v.speed === 0);
  const bow = worldToCourse(v.x, v.z).along + HULL.halfLen;
  assert.ok(bow >= BEACH.along && bow <= BEACH.along + 10, `bow at ${(bow - BEACH.along).toFixed(1)} m up the sand`);
  const x = v.x, z = v.z;
  sail(v, 30, 60, () => ({ trim: 1, row: 1 }));
  assert.ok(Math.hypot(v.x - x, v.z - z) < 0.01, 'moved after landing');
  assert.equal(stormTarget(v), STORM.moored);
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
