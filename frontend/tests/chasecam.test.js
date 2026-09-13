import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHASE, createChaseCam, chaseTarget, springAxis, stepChaseCam } from '../worlds/sea/chasecam.js';

const ship = (over = {}) => ({ x: 0, z: 0, heading: 0, speed: 0, hull: { y: 0, roll: 0 }, ...over });

test('the spring approaches a still target without overshoot', () => {
  let pos = 10, vel = 0, prev = pos;
  for (let i = 0; i < 240; i++) {
    [pos, vel] = springAxis(pos, vel, 0, CHASE.omega, 1 / 60);
    assert.ok(pos >= 0, 'overshot');
    assert.ok(pos <= prev + 1e-12, 'not monotone');
    prev = pos;
  }
  assert.ok(pos < 0.05, `after 4 s: ${pos}`);
});

test('the spring is frame-rate independent', () => {
  let a = [10, 0], b = [10, 0];
  for (let i = 0; i < 120; i++) a = springAxis(a[0], a[1], 0, CHASE.omega, 1 / 30);
  for (let i = 0; i < 240; i++) b = springAxis(b[0], b[1], 0, CHASE.omega, 1 / 60);
  assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
});

test('the camera sits behind and above the stern, looking past the bow', () => {
  const t = chaseTarget(ship({ heading: 0 }));           // bow points +z
  assert.ok(Math.abs(t.z + CHASE.back) < 1e-9 && Math.abs(t.x) < 1e-9);
  assert.equal(t.y, CHASE.up);
  assert.ok(Math.abs(t.lookZ - CHASE.lookAhead) < 1e-9);
});

test('first step snaps to the target; roll and fov follow the ship', () => {
  const cam = createChaseCam();
  const v = ship({ x: 5, z: 7, speed: 10, hull: { y: 1, roll: 0.5 } });
  stepChaseCam(cam, v, 1 / 60);
  const t = chaseTarget(v);
  assert.equal(cam.x, t.x); assert.equal(cam.z, t.z);
  assert.ok(Math.abs(cam.roll - 0.5 * CHASE.rollShare) < 1e-12);
  assert.ok(cam.fov > CHASE.fovBase);
});
