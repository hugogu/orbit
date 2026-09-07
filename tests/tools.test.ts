import test from 'node:test';
import assert from 'node:assert/strict';
import { observatoryTools } from '../lib/observatory-tools.ts';
void test('agent actions integrate with the same selection and simulation callbacks', () => {
  let selected = '',
    speed = -1,
    paused = false;
  const [focus, time] = observatoryTools({
    focus: (id) => {
      selected = id;
    },
    simulation: (s, p) => {
      speed = s;
      paused = p;
    },
  });
  assert.deepEqual(focus.execute({ id: 'earth' }), {
    selected: 'earth',
    name: '地球',
  });
  assert.equal(selected, 'earth');
  assert.deepEqual(time.execute({ speedIndex: 7, paused: true }), {
    daysPerSecond: 3650,
    paused: true,
  });
  assert.equal(speed, 7);
  assert.equal(paused, true);
});
void test('invalid agent inputs never alter app state', () => {
  let calls = 0;
  const [focus, time] = observatoryTools({
    focus: () => {
      calls++;
    },
    simulation: () => {
      calls++;
    },
  });
  for (const value of [null, {}, { id: 'unknown' }])
    assert.throws(() => focus.execute(value));
  for (const value of [
    null,
    {},
    { speedIndex: 8, paused: false },
    { speedIndex: 1.2, paused: false },
    { speedIndex: 2, paused: 'false' },
  ])
    assert.throws(() => time.execute(value));
  assert.equal(calls, 0);
});
