import assert from 'node:assert/strict';
import test from 'node:test';
import { parseObserverLocationDraft } from '../lib/observer-location-draft.ts';

void test('observer location drafts accept valid negative and decimal values', () => {
  assert.equal(
    parseObserverLocationDraft('-33.86', { min: -90, max: 90 }),
    -33.86,
  );
  assert.equal(parseObserverLocationDraft('3.', { min: -90, max: 90 }), 3);
});

void test('observer location drafts reject incomplete and out-of-range values', () => {
  const latitude = { min: -90, max: 90 };
  assert.equal(parseObserverLocationDraft('-', latitude), undefined);
  assert.equal(parseObserverLocationDraft('', latitude), undefined);
  assert.equal(parseObserverLocationDraft('91', latitude), undefined);
  assert.equal(parseObserverLocationDraft('Infinity', latitude), undefined);
  assert.equal(parseObserverLocationDraft('0x10', latitude), undefined);
});
