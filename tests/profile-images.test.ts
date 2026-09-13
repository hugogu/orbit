import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp/lib/index.js';
import { catalogEntries, seoLocales } from '../lib/seo';
import { translator, languages } from '../lib/i18n';
import { curiosities } from '../lib/curiosities';
import { profileContent } from '../lib/profile-content';
import { portraitCredit, isIllustrativePortrait } from '../lib/profile-images';
import {
  sampleSurface,
  renderSurface,
  renderPortrait,
  type SurfaceMap,
} from '../scripts/lib/render-portrait';
import { renderCardLabels, imageAttribution } from '../scripts/lib/share-card';

void test('editorial profiles preserve each sourced fact exactly once', () => {
  assert.deepEqual(
    Object.keys(profileContent).sort(),
    catalogEntries()
      .map((e) => e.data.id)
      .sort(),
  );
  for (const entry of catalogEntries()) {
    const content = profileContent[entry.data.id];
    assert.deepEqual(
      content.groups.flatMap((group) => group.indices).sort((a, b) => a - b),
      curiosities[entry.data.id].map((_, i) => i),
      entry.data.id,
    );
    for (const locale of seoLocales) {
      const t = translator(locale);
      assert.notEqual(
        t(content.intro),
        t(entry.data.description),
        entry.data.id,
      );
      if (entry.kind === 'body')
        assert.ok(content.sections.length >= 2, entry.data.id);
    }
  }
});

void test('surface sampling wraps longitude and clamps the poles without a seam', () => {
  const map = {
    width: 2,
    height: 1,
    data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
  };
  assert.deepEqual(sampleSurface(map, 0, 0), [255, 0, 0]);
  assert.deepEqual(sampleSurface(map, 1, 1), [255, 0, 0]);
  assert.deepEqual(sampleSurface(map, -0.25, 8), sampleSurface(map, 0.75, 0));
  assert.deepEqual(sampleSurface(map, 0.25, 0), [127.5, 0, 127.5]);
});

const white: SurfaceMap = {
  width: 1,
  height: 1,
  data: new Uint8Array([255, 255, 255, 255]),
};
void test('renders have a lit hemisphere, a dark hemisphere and clean composite edges', () => {
  const size = 100;
  const pixels = renderSurface(white, 'mercury', size);
  const pixel = (x: number, y: number) => pixels[(y * size + x) * 4];
  assert.ok(pixel(30, 30) > pixel(70, 70) * 2);
  for (const id of ['sun', 'earth', 'saturn', '67p']) {
    const buffer = renderSurface(
      white,
      id,
      size,
      id === 'saturn' ? white : undefined,
    );
    for (const x of [0, 50, 99])
      for (const y of [0, 99]) {
        const at = (y * size + x) * 4;
        assert.deepEqual(
          [...buffer.subarray(at, at + 4)],
          [7, 12, 21, 255],
          id,
        );
      }
  }
});

void test('real licensed textures render to images and carry their attribution', async () => {
  for (const id of [
    'sun',
    'saturn',
    'moon-miranda',
    'moon-deimos',
    '67p',
    'ceres',
    'eros',
    'bennu',
  ]) {
    const entry = catalogEntries().find((e) => e.data.id === id)!;
    const credit = portraitCredit(entry);
    const rendered = await renderPortrait(entry, 80);
    const jpeg = await rendered
      .jpeg()
      .withXmp(imageAttribution(entry, credit))
      .toBuffer();
    const metadata = await sharp(jpeg).metadata();
    assert.equal(metadata.width, 80);
    assert.equal(metadata.height, 80);
    assert.ok(metadata.xmp?.toString().includes(credit.license));
    assert.ok(metadata.xmp?.toString().includes('rendering by ORBIT'));
    if (id === 'moon-miranda') assert.match(credit.license, /by-sa\/4.0/);
    if (id === '67p' || entry.kind === 'asteroid')
      assert.equal(isIllustrativePortrait(entry), true);
  }
});

void test('the bundled font covers all localized social-card labels', async () => {
  for (const locale of seoLocales) {
    const t = translator(locale);
    for (const entry of catalogEntries()) {
      const overlays = await renderCardLabels(
        t(entry.data.name),
        languages[locale].name,
        t('太阳系观测台'),
      );
      for (const overlay of overlays) {
        const { width, height } = await sharp(overlay.input).metadata();
        assert.ok(overlay.left >= 0 && overlay.left + width! <= 1200);
        assert.ok(overlay.top >= 0 && overlay.top + height! <= 630);
      }
    }
  }
});
