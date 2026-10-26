import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { curiosities, pickCuriosities } from '../lib/curiosities';
import { bodies } from '../lib/solar';
import { comets } from '../lib/comets';
import { orbitingMoons } from '../lib/moon-orbits';
import CuriosityCard, { CuriositySource } from '../components/curiosity-card';
import { localizedCuriosity } from '../app/_pages/body-page';
import { languages, type Locale } from '../lib/i18n';

void test('all selectable bodies have 30 distinct sourced knowledge entries', () => {
  for (const body of [...bodies, ...comets, ...orbitingMoons]) {
    const pool = curiosities[body.id];
    assert.equal(pool.length, 30, body.id);
    assert.equal(new Set(pool.map((f) => f.text)).size, 30, body.id);
    for (const fact of pool) {
      assert.match(fact.source, /^https:\/\//);
      assert.ok(fact.text.length > 10);
      assert.doesNotMatch(fact.text, /undefined|NaN|Infinity/);
    }
  }
});
void test('new visits never repeat the previous item and can reach every other item', () => {
  for (let previous = 0; previous < 30; previous++) {
    const results = new Set<number>();
    for (let draw = 0; draw < 29; draw++) {
      const picks = pickCuriosities({ earth: previous }, () => draw / 29);
      assert.notEqual(picks.earth, previous);
      results.add(picks.earth);
    }
    assert.equal(results.size, 29);
  }
});
void test('missing and corrupt stored selections still yield valid cards', () => {
  for (const previous of [
    null,
    'bad',
    [],
    { earth: -1 },
    { earth: 30 },
    { earth: '2' },
  ]) {
    const picks = pickCuriosities(previous, () => 0.999999);
    for (const [id, index] of Object.entries(picks))
      assert.ok(curiosities[id][index]);
  }
});
void test('planet, comet and selected moon cards show their own text and source', () => {
  for (const id of ['earth', '67p', 'moon-titan']) {
    const html = renderToStaticMarkup(
      createElement(CuriosityCard, { id, index: 7, name: '天体' }),
    );
    assert.ok(html.includes(curiosities[id][7].text));
    assert.ok(html.includes(curiosities[id][7].source));
    assert.ok(html.includes('8/30'));
  }
});
void test('curiosity sources can be rendered after a body satellite guide', () => {
  const fact = curiosities.earth[7];
  const card = renderToStaticMarkup(
    createElement(CuriosityCard, {
      id: 'earth',
      index: 7,
      name: '地球',
      showSource: false,
    }),
  );
  assert.equal(card.includes(fact.source), false);
  const source = renderToStaticMarkup(
    createElement(CuriositySource, { id: 'earth', index: 7 }),
  );
  assert.ok(source.includes(fact.source));
  assert.ok(source.includes('8/30'));
});
void test('volume comparisons keep three significant digits and render without raw exponent notation', () => {
  const fact = curiosities.jupiter.find((entry) =>
    entry.text.includes('体积约为地球的'),
  );
  assert.ok(fact);
  assert.equal(
    (
      (bodies.find((body) => body.id === 'jupiter')!.radius / 6371) **
      3
    ).toPrecision(3),
    '1.32e+3',
  );
  const expected = 1320;
  assert.equal(fact.values?.v1, expected);
  for (const locale of Object.keys(languages) as Locale[]) {
    const rendered = localizedCuriosity(fact, locale);
    assert.ok(rendered.includes(expected.toLocaleString(locale)), locale);
    assert.doesNotMatch(rendered, /\d(?:\.\d+)?e[+-]\d+/i, locale);
    assert.ok(!rendered.includes('{{v1}}'), locale);
  }
  const bennuDiameter = curiosities.bennu[0];
  assert.equal(bennuDiameter.values?.v1, 0.48444);
  assert.ok(localizedCuriosity(bennuDiameter, 'en').includes('0.48444'));
});
