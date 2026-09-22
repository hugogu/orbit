import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { speeds, speedLabel } from '../lib/solar';
import { sandboxSpeeds } from '../lib/sandbox/view';
import { languages, translator, type Locale } from '../lib/i18n';

const page = readFileSync(
  new URL('../app/_pages/home-page.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../app/globals.css', import.meta.url),
  'utf8',
);
const compactStyles = styles.replace(/\s+/g, ' ');

// Labels that stay visible once `.speed-marker--optional` is hidden.
const visibleAlways = (presets: readonly number[]) => [
  presets[0],
  1,
  presets.at(-1),
];
// The observatory clock and the sandbox clock share one control, so both
// preset lists have to satisfy every rule below.
const presetLists = [speeds, sandboxSpeeds];

void test('time speed markers are generated from every discrete slider value', () => {
  const positions = speeds.map(
    (_, index) => (index / (speeds.length - 1)) * 100,
  );

  assert.equal(positions.length, speeds.length);
  assert.equal(new Set(positions).size, speeds.length);
  assert.equal(positions[0], 0);
  assert.equal(positions.at(-1), 100);
  assert.match(page, /clockSpeeds\.map\(\(value, index\) =>/);
  assert.match(page, /data-speed-index=\{index\}/);
  assert.match(page, /speedLabel\(value, t\)/);
  assert.match(page, /--speed-position/);
  // The reduced set must be chosen from the presets themselves: an index list
  // silently mislabels the markers as soon as a speed is added or reordered.
  assert.match(
    page,
    /className=\{`speed-marker\$\{speedMarkerModifier\(value, clockSpeeds\)\}`\}/,
  );
  assert.doesNotMatch(page, /speed-marker--optional'\s*:\s*''/);
  for (const presets of presetLists) {
    const required = visibleAlways(presets);
    assert.equal(
      presets.filter((value) => required.includes(value)).length,
      required.length,
      'the always-visible markers must exist among the presets',
    );
  }
});

void test('speed markers share the slider track and the thumb has a larger target', () => {
  assert.match(compactStyles, /\.speed-markers \{ position: relative/);
  assert.match(
    compactStyles,
    /\.speed-marker \{ position: absolute; left: var\(--speed-position\)/,
  );
  assert.match(compactStyles, /\.speed-marker:first-child \{ transform: none/);
  assert.match(
    compactStyles,
    /\.speed-marker:last-child \{ transform: translateX\(-100%\)/,
  );
  assert.match(
    compactStyles,
    /\.speed-control \{ flex: 1; --speed-thumb-size: 16px/,
  );
  assert.match(compactStyles, /container-type: inline-size/);
  assert.match(
    compactStyles,
    /\.speed-control \[data-slot='slider-thumb'\] \{ width: var\(--speed-thumb-size\); height: var\(--speed-thumb-size\)/,
  );
  assert.match(
    compactStyles,
    /margin-inline: calc\(var\(--speed-thumb-size\) \/ 2\)/,
  );
  assert.match(compactStyles, /\.speed-marker--optional \{ display: none/);
});

void test('every marker tier has room for its labels in every language', () => {
  for (const presets of presetLists) checkTiers(presets);
});

function checkTiers(speeds: readonly number[]) {
  const always = visibleAlways(speeds);
  // A coarse advance model: CJK glyphs are full width and the UI font's widest
  // Latin glyphs measure just under half the size. It is an over-estimate of
  // real metrics, so a tier that clears it here clears it in a browser too.
  const measure = (text: string, fontSize: number) => {
    let total = 0;
    for (const character of text)
      total += fontSize * (/[\u2E80-\uFFEF]/.test(character) ? 1 : 0.48);
    return total;
  };
  const breakpoints = [
    ...compactStyles.matchAll(/@container \(max-width: (\d+)px\)/g),
  ].map((match) => Number(match[1]));
  assert.deepEqual(breakpoints, [840, 700, 260]);
  const [shrink, reduce, hide] = breakpoints;
  const everyStop = speeds.map((_, index) => index);
  // The narrowest control that still shows each tier is its worst case.
  const tiers = [
    { width: shrink, fontSize: 12, visible: everyStop },
    { width: reduce, fontSize: 10, visible: everyStop },
    {
      width: hide,
      fontSize: 10,
      visible: everyStop.filter((index) => always.includes(speeds[index])),
    },
  ];
  for (const locale of Object.keys(languages) as Locale[]) {
    const t = translator(locale);
    for (const { width, fontSize, visible } of tiers) {
      // `.speed-markers` is inset by half a thumb on each side.
      const track = width - 16;
      const last = speeds.length - 1;
      const spans = visible.map((index) => {
        const size = measure(speedLabel(speeds[index], t), fontSize);
        if (index === 0) return [0, size];
        if (index === last) return [track - size, track];
        const center = (index / last) * track;
        return [center - size / 2, center + size / 2];
      });
      for (let i = 1; i < spans.length; i++)
        assert.ok(
          spans[i][0] - spans[i - 1][1] >= 2,
          `${locale}: markers ${visible[i - 1]} and ${visible[i]} collide at ${width}px`,
        );
    }
  }
}
