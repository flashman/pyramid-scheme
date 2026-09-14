import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHASE, createChaseCam, chaseTarget, springAxis, stepChaseCam, orbitDrag, releaseOrbit, resetOrbit, introOrbit } from '../worlds/sea/chasecam.js';

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

test('the default view is a three-quarter chase: behind, above and off to one side', () => {
  const t = chaseTarget(ship({ heading: 0 }));           // bow points +z
  assert.ok(t.z < 0, 'behind the stern');
  assert.ok(Math.abs(t.x) > 1, 'off to one side');
  assert.ok(Math.abs(Math.hypot(t.x, t.z) - CHASE.back) < 1e-9);
  assert.equal(t.y, CHASE.up);
  assert.ok(Math.abs(t.lookZ - CHASE.lookAhead) < 1e-9);
});

test('a dragged view holds after release; reset returns to the chase view', () => {
  const cam = createChaseCam();
  const v = ship();
  stepChaseCam(cam, v, 1 / 60);
  const rest = chaseTarget(v, cam);
  orbitDrag(cam, -300, 0);
  assert.ok(Math.abs(cam.orbitYaw) > 1, 'yaw moved');
  const swung = chaseTarget(v, cam);
  assert.ok(Math.hypot(swung.x - rest.x, swung.z - rest.z) > 10, 'camera swung round');
  releaseOrbit(cam);
  const yaw = cam.orbitYaw;
  for (let i = 0; i < 600; i++) stepChaseCam(cam, v, 1 / 60);   // 10 s
  assert.equal(cam.orbitYaw, yaw, 'view held');
  resetOrbit(cam);
  assert.equal(cam.orbitYaw, 0);
  assert.equal(cam.orbitPitch, 0);
});

test('the departure shot starts ahead of the bow, swings round, and yields to a drag', () => {
  const cam = createChaseCam();
  const v = ship();
  introOrbit(cam);
  stepChaseCam(cam, v, 1 / 60);
  assert.ok(chaseTarget(v, cam).z > 0, 'starts ahead of the bow, looking back');
  for (let i = 0; i < 60 * 20; i++) stepChaseCam(cam, v, 1 / 60);   // 20 s
  assert.ok(Math.abs(cam.orbitYaw) < 0.01, 'swung round to the chase view');
  introOrbit(cam);
  orbitDrag(cam, 10, 0);
  releaseOrbit(cam);
  const yaw = cam.orbitYaw;
  for (let i = 0; i < 120; i++) stepChaseCam(cam, v, 1 / 60);
  assert.equal(cam.orbitYaw, yaw, 'a drag cancels the intro swing');
});

test('vertical drag is clamped', () => {
  const cam = createChaseCam();
  orbitDrag(cam, 0, -100000);
  assert.equal(cam.orbitPitch, CHASE.pitchMax);
  orbitDrag(cam, 0, 100000);
  assert.equal(cam.orbitPitch, CHASE.pitchMin);
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
