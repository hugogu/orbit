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
