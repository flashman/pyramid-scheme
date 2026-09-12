import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solvedCountAfterCorrect } from '../worlds/oasis/riddle-count.js';

// The vault portal opens at sphinx_riddles_solved >= 1.

test('guest: counts locally, because the server persists nothing and returns 0', () => {
  assert.equal(solvedCountAfterCorrect({ isGuest: true, serverCount: 0, localCount: 0 }), 1);
  assert.equal(solvedCountAfterCorrect({ isGuest: true, serverCount: 0, localCount: 2 }), 3);
});

test('guest: the first correct answer reaches the vault gate', () => {
  assert.ok(solvedCountAfterCorrect({ isGuest: true, serverCount: 0, localCount: 0 }) >= 1);
});

test('logged in: the server count is authoritative, even below the local value', () => {
  assert.equal(solvedCountAfterCorrect({ isGuest: false, serverCount: 1, localCount: 5 }), 1);
  assert.equal(solvedCountAfterCorrect({ isGuest: false, serverCount: 4, localCount: 0 }), 4);
});

test('logged in: a response without a count leaves the local value alone', () => {
  assert.equal(solvedCountAfterCorrect({ isGuest: false, serverCount: undefined, localCount: 2 }), 2);
  assert.equal(solvedCountAfterCorrect({ isGuest: false, serverCount: null, localCount: 2 }), 2);
});
