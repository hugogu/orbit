import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const sunrise = readFileSync(
  new URL('../components/sunrise-sunset.tsx', import.meta.url),
  'utf8',
);
const moons = readFileSync(
  new URL('../components/moon-guide.tsx', import.meta.url),
  'utf8',
);
const hint = readFileSync(
  new URL('../components/concept-hint.tsx', import.meta.url),
  'utf8',
);
const physicalFacts = readFileSync(
  new URL('../components/physical-facts.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../app/globals.css', import.meta.url),
  'utf8',
);

void test('space journey help is split into operation, model and source tabs', () => {
  assert.match(page, /value="operation"/);
  assert.match(page, /value="model"/);
  assert.match(page, /value="sources"/);
  assert.match(page, /aria-label=\{t\('帮助分类'\)\}/);
});

void test('archive keeps app guidance compact behind concept hints', () => {
  assert.match(sunrise, /ConceptHint/);
  assert.match(moons, /ConceptHint/);
  assert.doesNotMatch(
    sunrise,
    /\{t\('无法获取设备位置，当前显示参考坐标。可在“天象推演”中手动设置。'\)\}/,
  );
  assert.doesNotMatch(moons, /className="little-note"/);
});

void test('archive hints use one native tooltip without horizontal overflow', () => {
  assert.match(hint, /title=\{label\}/);
  assert.doesNotMatch(hint, /concept-tooltip/);
  assert.match(styles, /\.orbit-dialog \{[\s\S]*overflow-x: hidden;/);
  assert.match(styles, /\.mobile-details \{[\s\S]*overflow-x: hidden;/);
  assert.match(physicalFacts, /physical-facts-label/);
  assert.match(styles, /\.physical-facts summary::marker/);
  assert.match(styles, /content: '▸  ';/);
  assert.doesNotMatch(styles, /\.concept-tooltip/);
});

void test('ordinary sunrise cards keep the calculation note in the tooltip only', () => {
  assert.match(sunrise, /result\.daylight !== '按太阳上缘和标准大气折射计算'/);
});
