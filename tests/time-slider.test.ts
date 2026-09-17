import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { speeds } from '../lib/solar';

const page = readFileSync(
  new URL('../app/_pages/home-page.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../app/globals.css', import.meta.url),
  'utf8',
);
const compactStyles = styles.replace(/\s+/g, ' ');

void test('time speed markers are generated from every discrete slider value', () => {
  const positions = speeds.map(
    (_, index) => (index / (speeds.length - 1)) * 100,
  );

  assert.equal(positions.length, speeds.length);
  assert.equal(new Set(positions).size, speeds.length);
  assert.equal(positions[0], 0);
  assert.equal(positions.at(-1), 100);
  assert.match(page, /speeds\.map\(\(value, index\) =>/);
  assert.match(page, /data-speed-index=\{index\}/);
  assert.match(page, /speedLabel\(value, t\)/);
  assert.match(page, /--speed-position/);
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
  assert.match(
    compactStyles,
    /\.speed-control \[data-slot='slider-thumb'\] \{ width: var\(--speed-thumb-size\); height: var\(--speed-thumb-size\)/,
  );
  assert.match(
    compactStyles,
    /margin-inline: calc\(var\(--speed-thumb-size\) \/ 2\)/,
  );
  assert.match(compactStyles, /\.speed-marker--optional \{ display: none/);
  assert.match(compactStyles, /\.speed-marker--narrow \{ display: none/);
  assert.match(
    compactStyles,
    /@media \(min-width: 601px\) and \(max-width: 700px\)/,
  );
});
