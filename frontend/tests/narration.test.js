import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NARRATION, createNarrationMemory, narrate } from '../worlds/sea/narration.js';

const first = () => 0;   // rng → always the first line

test('once events speak a single time per voyage', () => {
  const mem = createNarrationMemory();
  assert.equal(narrate([{ type: 'departure' }], 0, mem, first).length, 1);
  assert.equal(narrate([{ type: 'departure' }], 500, mem, first).length, 0);
});

test('lines carry the log prefix', () => {
  const [line] = narrate([{ type: 'departure' }], 0, createNarrationMemory(), first);
  assert.equal(line, '✦ ' + NARRATION.departure.lines[0]);
});

test('cooldown events respect their cooldown', () => {
  const mem = createNarrationMemory();
  const cd = NARRATION.strayed.cooldown;
  assert.equal(narrate([{ type: 'strayed' }], 10, mem, first).length, 1);
  assert.equal(narrate([{ type: 'strayed' }], 10 + cd - 1, mem, first).length, 0);
  assert.equal(narrate([{ type: 'strayed' }], 10 + cd + 1, mem, first).length, 1);
});

test('landmarks and storm levels are keyed separately', () => {
  const mem = createNarrationMemory();
  const lines = narrate([
    { type: 'landmark_near', id: 'wreck' },
    { type: 'landmark_near', id: 'signal_rock' },
    { type: 'storm_rising', level: 0.3 },
    { type: 'storm_rising', level: 0.5 },
  ], 0, mem, first);
  assert.equal(lines.length, 4);
  assert.equal(narrate([{ type: 'landmark_near', id: 'wreck' }], 1, mem, first).length, 0);
});

test('events without lines are silent', () => {
  const mem = createNarrationMemory();
  assert.deepEqual(narrate([{ type: 'arrived' }, { type: 'landmark_near', id: 'nope' }], 0, mem, first), []);
});

test('only the first lightning is narrated', () => {
  const mem = createNarrationMemory();
  const bolts = [{ type: 'lightning', x: 0, z: 0, distance: 900, power: 0.8 }];
  assert.equal(narrate(bolts, 0, mem, first).length, 1);
  assert.equal(narrate(bolts, 300, mem, first).length, 0);
});

test('rng picks among a table entry\'s lines', () => {
  const lines = NARRATION.strayed.lines;
  const [line] = narrate([{ type: 'strayed' }], 0, createNarrationMemory(), () => 0.999);
  assert.equal(line, '✦ ' + lines[lines.length - 1]);
});

test('the haul speaks as the ropes go out, on chosen heaves, and when she is up', () => {
  const heaves = Array.from({ length: 7 }, (_, id) => ({ type: 'heave', id }));
  const lines = narrate([{ type: 'haul_ropes' }, ...heaves, { type: 'hauled' }], 0, createNarrationMemory(), first);
  assert.equal(lines.length, 2 + Object.keys(NARRATION.heave.byId).length);
});
