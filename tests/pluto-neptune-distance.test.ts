import test from 'node:test';
import assert from 'node:assert/strict';
import { Body, HelioVector } from 'astronomy-engine';
import { heliocentricDistance } from '../lib/ephemeris.ts';
import { DAY_MS, J2000_MS } from '../lib/simulation-time.ts';
import { languages, translator } from '../lib/i18n/index.ts';

const days = (date: string) => (Date.parse(date) - J2000_MS) / DAY_MS;

void test('Pluto and Neptune use the same physical heliocentric frame', () => {
  for (const date of ['1989-07-01T00:00:00Z', '2026-11-26T00:00:00Z']) {
    const instant = days(date);
    for (const [id, body] of [
      ['pluto', Body.Pluto],
      ['neptune', Body.Neptune],
    ] as const) {
      const vector = HelioVector(body, instant);
      assert.ok(
        Math.abs(
          heliocentricDistance(id, instant) -
            Math.hypot(vector.x, vector.y, vector.z),
        ) < 1e-12,
      );
    }
  }
  assert.ok(
    heliocentricDistance('pluto', days('1989-07-01T00:00:00Z')) <
      heliocentricDistance('neptune', days('1989-07-01T00:00:00Z')),
  );
  assert.ok(
    heliocentricDistance('pluto', days('2026-11-26T00:00:00Z')) >
      heliocentricDistance('neptune', days('2026-11-26T00:00:00Z')),
  );
});

void test('comparison text is translated in every locale', () => {
  for (const locale of Object.keys(languages) as (keyof typeof languages)[]) {
    const t = translator(locale);
    for (const key of [
      '比较冥王星与海王星',
      '此刻冥王星更靠近太阳。',
      '此刻海王星更靠近太阳。',
      '同一时刻的物理日距，不受画面比例影响。',
      '3:2 是长期平均轨道关系，不是单次日距比较的结论。',
      '查看 1989 年',
      '返回先前时刻',
    ]) {
      assert.ok(t(key));
      if (locale !== 'zh-CN') assert.notEqual(t(key), key);
    }
  }
});
