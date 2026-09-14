import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WARES, WARES_BY_ID, WARE_RETORTS, PER_ROW, TABLE_ROWS } from '../worlds/nile/shop/catalogue.js';

test('every ware fits on the stall table (rowY has exactly TABLE_ROWS rows)', () => {
  assert.ok(WARES.length <= PER_ROW * TABLE_ROWS, `${WARES.length} wares > ${PER_ROW}×${TABLE_ROWS}`);
});

test('the Letter of Passage is on sale with a pitch and a retort', () => {
  const letter = WARES_BY_ID.letter_of_passage;
  assert.ok(letter, 'missing ware');
  assert.equal(letter.art, 'letter_of_passage');
  assert.ok(letter.blurb.length > 0);
  assert.ok(WARE_RETORTS.letter_of_passage);
});

test('ware ids are unique', () => {
  assert.equal(new Set(WARES.map(w => w.id)).size, WARES.length);
});
