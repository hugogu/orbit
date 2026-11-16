import test from 'node:test';
import assert from 'node:assert/strict';
import { marsObservation } from '../lib/mars-observation';
import { bodies } from '../lib/solar';
import { translator, languages, type Locale } from '../lib/i18n';

void test('Mars geocentric size matches the NASA 2003 ephemeris', () => {
  // NASA RP 1349: 2003-08-27 00:00 UTC, 0.37273 AU and 25.1 arcsec.
  // https://eclipse.gsfc.nasa.gov/TYPE/mars2.html
  const reading = marsObservation(Date.UTC(2003, 7, 27));
  assert.ok(Math.abs(reading.distanceAu - 0.37273) < 0.0001);
  assert.ok(Math.abs(reading.diameterArcsec - 25.1) < 0.1);
  assert.ok(Math.abs(reading.distanceKm - 55_760_000) < 100_000);
});

void test('Mars apparent size follows physical distance, independently of display scale', () => {
  const close = marsObservation(Date.UTC(2003, 7, 27));
  const far = marsObservation(Date.UTC(2025, 0, 16));
  assert.ok(close.distanceAu < far.distanceAu);
  assert.ok(close.diameterArcsec > far.diameterArcsec);
  assert.deepEqual(marsObservation(Date.UTC(2003, 7, 27)), close);
  assert.equal(bodies.find((body) => body.id === 'mars')?.radius, 3389.5);
});

void test('Mars observation labels and model note exist in every language', () => {
  for (const locale of Object.keys(languages) as Locale[]) {
    const t = translator(locale);
    for (const key of [
      '地心距离',
      '近似视直径',
      '按模拟时刻从地心计算；视直径采用火星平均半径的球形近似，与画面放大比例和上方平均日距无关。',
    ])
      assert.ok(t(key) && (locale === 'zh-CN' || t(key) !== key));
  }
});
