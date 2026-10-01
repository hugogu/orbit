import test from 'node:test';
import assert from 'node:assert/strict';
import { plannerIntent, withoutPlannerIntent } from '../lib/explorer-intent';

void test('only one recognized planner navigation intent opens the lunar tab', () => {
  assert.equal(plannerIntent('?lang=en&planner=lunar'), 'lunar');
  for (const search of [
    '',
    '?lang=en',
    '?planner=solar',
    '?planner=LUNAR',
    '?planner=lunar&planner=lunar',
    '?planner=lunar%00',
  ])
    assert.equal(plannerIntent(search), null, search);
});

void test('consuming an intent preserves the language and other query values', () => {
  assert.equal(
    withoutPlannerIntent('?lang=ja&planner=lunar&t=2024-04-08'),
    '?lang=ja&t=2024-04-08',
  );
  assert.equal(withoutPlannerIntent('?planner=lunar'), '');
});
