import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync(
  new URL('../app/_pages/home-page.tsx', import.meta.url),
  'utf8',
);
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
const planner = readFileSync(
  new URL('../components/astronomy-panel.tsx', import.meta.url),
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

void test('archive hints open on tap without horizontal overflow', () => {
  // A native title tooltip is unreachable on a touch screen, so the hint owns a
  // popover that a tap, a hover and the keyboard can all open.
  assert.doesNotMatch(hint, /title=\{label\}/);
  assert.match(hint, /PopoverTrigger/);
  assert.match(hint, /openOnHover/);
  assert.match(hint, /PopoverContent/);
  // The popup is portalled and capped, so it cannot widen the panel it sits in.
  assert.match(styles, /\.concept-hint-popup \{[\s\S]*max-width: min\(/);
  assert.doesNotMatch(hint, /concept-tooltip/);
  assert.match(styles, /\.orbit-dialog \{[\s\S]*overflow-x: hidden;/);
  assert.match(styles, /\.mobile-details \{[\s\S]*overflow-x: hidden;/);
  assert.match(physicalFacts, /physical-facts-label/);
  // A hint inside the summary must not also toggle the panel it labels.
  assert.match(physicalFacts, /closest\('\.concept-hint'\)/);
  assert.match(styles, /\.physical-facts summary::marker/);
  assert.match(styles, /content: '▸  ';/);
  assert.doesNotMatch(styles, /\.concept-tooltip/);
});

void test('ordinary sunrise cards keep the calculation note in the tooltip only', () => {
  assert.match(sunrise, /result\.daylight !== '按太阳上缘和标准大气折射计算'/);
});

void test('the planner describes the query it answered, not the place the app holds now', () => {
  // Times and the observation point printed under them must come from one
  // place. The list is a snapshot, so reading the live prop while rendering
  // would label a computed list with somewhere it was never computed for.
  assert.match(
    planner,
    /const answered: SkyLocation = loaded\?\.query \?\? location;/,
  );
  assert.doesNotMatch(
    planner,
    /location\.(latitude|longitude|height|utcOffset)/,
  );
  // The prop still decides what to ask for and whether what is held still fits.
  assert.match(planner, /\{ start: time, \.\.\.location \}/);
  assert.match(planner, /stillAnswers\(loaded, query\.start, location\)/);
});
