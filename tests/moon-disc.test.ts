import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp/lib/index.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import MoonPhaseDisc from '../components/moon-phase-disc.tsx';
import { projectMoonTexture, shadeMoonDisc } from '../lib/moon-disc.ts';

const white = {
  width: 1,
  height: 1,
  data: new Uint8ClampedArray([255, 255, 255, 255]),
};

void test('sphere sunlight matches phase fractions and waxing direction', () => {
  const sphere = projectMoonTexture(white, 256);
  for (const angle of [0, 30, 60, 90, 120, 150, 180]) {
    const pixels = shadeMoonDisc(sphere, angle, true);
    let lit = 0;
    let total = 0;
    for (let p = 0; p < sphere.coverage.length; p++) {
      if (sphere.coverage[p] < 1) continue;
      total++;
      // The illustrative dark floor maps to 18 sRGB; direct light exceeds it.
      if (pixels[p * 4] > 18) lit++;
    }
    assert.ok(
      Math.abs(lit / total - (1 + Math.cos((angle * Math.PI) / 180)) / 2) <
        0.01,
      `${angle}: ${lit / total}`,
    );
  }
  const waxing = shadeMoonDisc(sphere, 90, true);
  const waning = shadeMoonDisc(sphere, 90, false);
  const left = (128 * 256 + 64) * 4;
  const right = (128 * 256 + 191) * 4;
  assert.ok(waxing[right] > waxing[left] * 4);
  assert.ok(waning[left] > waning[right] * 4);
  assert.equal(waxing[3], 0, 'outside the sphere is transparent');
});

void test('shipped texture projects recognisable near-side maria and stays fixed as lighting changes', async () => {
  const { data, info } = await sharp('public/textures/2k_moon.jpg')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sphere = projectMoonTexture(
    {
      width: info.width,
      height: info.height,
      data: new Uint8ClampedArray(data),
    },
    192,
  );
  const full = shadeMoonDisc(sphere, 0, true);
  const luminance = (x: number, y: number) => full[(y * 192 + x) * 4];
  assert.ok(
    luminance(115, 55) < luminance(110, 135),
    'northern maria are darker than southern highlands',
  );
  assert.deepEqual(
    full,
    shadeMoonDisc(sphere, 0, false),
    'waxing changes the light, not the surface map',
  );
  const quarter = shadeMoonDisc(sphere, 90, true);
  assert.ok(quarter[(96 * 192 + 145) * 4] > quarter[(96 * 192 + 45) * 4]);
});

void test('all phase views keep their dimensions and rotate southern surfaces without mirroring', () => {
  for (const size of [20, 22, 46, 96]) {
    const markup = renderToStaticMarkup(
      createElement(MoonPhaseDisc, {
        elongation: 90,
        phaseAngle: 89.8,
        size,
        flip: true,
      }),
    );
    assert.match(markup, /<canvas/);
    assert.match(markup, new RegExp(`width="${size}" height="${size}"`));
    assert.match(markup, /rotate\(180deg\)/);
    assert.match(markup, /aria-hidden="true"/);
  }
});
