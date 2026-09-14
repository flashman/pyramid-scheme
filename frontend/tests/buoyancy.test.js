import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoyage, polar } from '../worlds/sea/voyage.js';
import { COURSE_HEADING, HULL, WAKE, worldToCourse } from '../worlds/sea/constants.js';
import { mulberry32, sail } from './helpers/sea.js';

test('on flat water the hull settles to rest within 5 s (residual < 1 cm)', () => {
  const v = createVoyage({ waveParams: [] });
  v.hull.y = 2; v.hull.pitch = 0.2; v.hull.roll = -0.2; v.sail = 0; v.rowing = 0;
  sail(v, 5, 60, () => ({ trim: -1 }));
  assert.ok(Math.abs(v.hull.y) < 0.01, `y ${v.hull.y}`);
  assert.ok(Math.abs(v.hull.pitch) < 0.01, `pitch ${v.hull.pitch}`);
  assert.ok(Math.abs(v.hull.roll) < 0.02, `roll ${v.hull.roll}`);
});

test('rough water heaves and pitches the hull', () => {
  const v = createVoyage();
  v.storm = 0.9;
  let minY = Infinity, maxY = -Infinity, maxPitch = 0;
  for (let i = 0; i < 180; i++) {
    sail(v, 1 / 60, 60, () => ({ trim: 1 }));
    minY = Math.min(minY, v.hull.y); maxY = Math.max(maxY, v.hull.y);
    maxPitch = Math.max(maxPitch, Math.abs(v.hull.pitch));
  }
  assert.ok(maxY - minY > 0.2, `heave range ${maxY - minY}`);
  assert.ok(maxPitch > 0.005, `pitch ${maxPitch}`);
});

test('a beam wind heels the ship AWAY from the wind (sign pinned by hand)', () => {
  // Convention: +roll leans the mast to STARBOARD (three.js rotation.z about the bow
  // axis; the ship's local +x is port). Heading COURSE_HEADING − π/2 puts the wind
  // (blowing toward COURSE_HEADING) on the starboard beam, so the ship must lean to
  // PORT: roll < 0. Derived by hand — never recompute this from the implementation.
  const v = createVoyage({ waveParams: [] });
  v.heading = COURSE_HEADING - Math.PI / 2;
  v.sail = 1;
  sail(v, 10, 60, () => ({ trim: 1 }));
  const expected = -HULL.heelMax * polar(Math.PI / 2);
  assert.ok(v.hull.roll < 0, `leans into the wind: roll ${v.hull.roll}`);
  assert.ok(Math.abs(v.hull.roll - expected) < 0.01, `roll ${v.hull.roll} vs ${expected}`);
});

test('30 fps and 60 fps produce the same voyage', () => {
  const policy = (v) => ({ steer: v.t < 4 ? 1 : 0, trim: 1 });
  const a = createVoyage({ rng: mulberry32(7) });
  const b = createVoyage({ rng: mulberry32(7) });
  sail(a, 10, 30, policy);
  sail(b, 10, 60, policy);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.5, 'position');
  assert.ok(Math.abs(a.heading - b.heading) < 0.02, 'heading');
  assert.ok(Math.abs(a.hull.y - b.hull.y) < 0.05, 'heave');
  assert.ok(Math.abs(a.hull.pitch - b.hull.pitch) < 0.01, 'pitch');
});

test('the wake is a bounded ring, oldest first, newest at the ship', () => {
  const v = createVoyage();
  sail(v, 20, 60, () => ({ trim: 1 }));
  assert.equal(v.wake.length, WAKE.max);
  for (let i = 1; i < v.wake.length; i++) assert.ok(v.wake[i].t > v.wake[i - 1].t);
  const last = v.wake[v.wake.length - 1];
  assert.ok(Math.hypot(last.x - v.x, last.z - v.z) < 5);
});

test('a stormy sea throws lightning ahead of the ship', () => {
  const v = createVoyage({ rng: mulberry32(3) });
  v.storm = 0.9; v.nextFlash = 0.5;
  const bolt = sail(v, 1, 60, () => ({})).find(e => e.type === 'lightning');
  assert.ok(bolt, 'no lightning');
  assert.ok(bolt.distance > 0);
  assert.ok(bolt.power >= 0.4 && bolt.power <= 1);
  assert.ok(worldToCourse(bolt.x, bolt.z).along > worldToCourse(v.x, v.z).along + 500);
});

test('a calm sea throws no lightning', () => {
  const v = createVoyage({ rng: mulberry32(3) });
  v.sail = 0; v.rowing = 0;
  const events = sail(v, 60, 60, () => ({ trim: -1 }));
  assert.equal(events.filter(e => e.type === 'lightning').length, 0);
});
