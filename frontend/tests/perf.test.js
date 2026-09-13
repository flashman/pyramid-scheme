import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerfMonitor } from '../worlds/sea/perf.js';

const run = (mon, frameMs, seconds) => {
  let fires = 0;
  for (let t = 0; t < seconds * 1000; t += frameMs) if (mon.sample(frameMs)) fires++;
  return fires;
};

test('a healthy 60 fps never degrades', () => {
  assert.equal(run(createPerfMonitor(), 16.7, 30), 0);
});

test('sustained slow frames degrade exactly once', () => {
  const mon = createPerfMonitor();
  assert.equal(run(mon, 40, 10), 1);
  assert.equal(mon.fired, true);
  assert.equal(run(mon, 40, 10), 0);
});

test('a brief slowdown followed by recovery does not degrade', () => {
  const mon = createPerfMonitor();
  run(mon, 40, 2);
  run(mon, 16.7, 2);
  assert.equal(run(mon, 40, 2), 0);
});

test('tab-switch hitches are ignored', () => {
  const mon = createPerfMonitor();
  for (let i = 0; i < 20; i++) assert.equal(mon.sample(2000), false);
  assert.equal(mon.fired, false);
});
