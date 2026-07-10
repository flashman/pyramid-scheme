import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNING, stepRun, stepFall, jumpVelocity } from '../engine/kinematics.js';

test('walk accelerates gradually toward walkMax, never past it', () => {
  let vx = 0;
  const first = stepRun(vx, 1, { grounded: true, run: false });
  assert.equal(first, TUNING.walkAccel);           // one accel step, not instant max
  for (let i = 0; i < 200; i++) vx = stepRun(vx, 1, { grounded: true, run: false });
  assert.ok(Math.abs(vx - TUNING.walkMax) < 1e-9);
});

test('run reaches a higher max than walk', () => {
  let vx = 0;
  for (let i = 0; i < 200; i++) vx = stepRun(vx, 1, { grounded: true, run: true });
  assert.ok(Math.abs(vx - TUNING.runMax) < 1e-9);
  assert.ok(TUNING.runMax > TUNING.walkMax);
});

test('releasing input on the ground applies friction until stop', () => {
  let vx = TUNING.walkMax;
  const after1 = stepRun(vx, 0, { grounded: true, run: false });
  assert.equal(after1, TUNING.walkMax - TUNING.friction);   // gradual, not instant
  for (let i = 0; i < 200; i++) vx = stepRun(vx, 0, { grounded: true, run: false });
  assert.equal(vx, 0);
});

test('reversing at speed skids: decelerates faster than friction, does not snap', () => {
  const vx = TUNING.runMax;
  const after = stepRun(vx, -1, { grounded: true, run: true });
  assert.ok(after < vx);                     // slowing
  assert.ok(after > 0);                      // still moving the old way (skid, not snap)
  assert.ok(vx - after > TUNING.friction);   // faster than plain friction
});

test('air: no input conserves momentum exactly', () => {
  assert.equal(stepRun(4, 0, { grounded: false, run: false }), 4);
});

test('air steering uses airAccel', () => {
  const after = stepRun(0, 1, { grounded: false, run: false });
  assert.equal(after, TUNING.airAccel);
});

test('holding jump rises with less gravity than releasing', () => {
  const held     = stepFall(-9, true);
  const released = stepFall(-9, false);
  assert.ok(held < released);                // less decel while held
});

test('falling gravity applies below terminal velocity, then clamps', () => {
  assert.equal(stepFall(2, false), 2 + TUNING.gravityFall);
  assert.equal(stepFall(TUNING.maxFall, false), TUNING.maxFall);
});

test('held jump reaches a much higher apex than a tap', () => {
  const apex = (held) => {
    let vy = jumpVelocity(0), y = 0;
    while (vy < 0) { vy = stepFall(vy, held); y += vy; }
    return -y;
  };
  const big = apex(true), small = apex(false);
  assert.ok(big > small * 1.6, `held ${big} vs tap ${small}`);
  assert.ok(big > 72, 'held jump must clear the Nile riverbed→bank rise (72px)');
});

test('running jump takes off faster than standing jump', () => {
  assert.ok(jumpVelocity(TUNING.runMax) < jumpVelocity(0));  // more negative
});
