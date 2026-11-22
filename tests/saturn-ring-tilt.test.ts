import test from 'node:test';
import assert from 'node:assert/strict';
import { saturnRingTilt } from '../lib/saturn-ring-tilt';
import {
  eventOccurrences,
  occurrenceCircumstances,
} from '../lib/event-occurrences';
import { languages, translator, type Locale } from '../lib/i18n';

void test('Saturn ring opening tracks the geocentric ring-plane crossing', () => {
  // The model crosses edge-on near 2025-03-23; keep the sign and do not take abs().
  assert.ok(Math.abs(saturnRingTilt(Date.UTC(2025, 2, 23))) < 0.1);
  assert.ok(saturnRingTilt(Date.UTC(2025, 2, 1)) < 0);
  assert.ok(saturnRingTilt(Date.UTC(2025, 4, 1)) > 0);
});

void test('live ring reading agrees with the published 2027 opposition', () => {
  const edition = eventOccurrences.find(
    (event) => event.date === '2027-10-18',
  )!;
  const tilt = saturnRingTilt(edition.peak);
  assert.ok(Math.abs(tilt - 12.9) < 0.1);
  assert.equal(tilt, occurrenceCircumstances(edition).ringTilt);
  assert.equal(saturnRingTilt(edition.peak), tilt);
  for (const year of [1700, 2200])
    assert.ok(Number.isFinite(saturnRingTilt(Date.UTC(year, 0, 1))));
});

void test('Saturn ring labels and model explanation exist in every language', () => {
  for (const locale of Object.keys(languages) as Locale[]) {
    const t = translator(locale);
    for (const key of [
      '地心星环张开角',
      '地心视线与土星环面的夹角；正负表示所见环面的一侧，接近零度时近乎侧向。这是历表近似，与自由相机视角和显示比例无关，也不保证当地可见。',
    ])
      assert.ok(t(key) && (locale === 'zh-CN' || t(key) !== key));
  }
});
