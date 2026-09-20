import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import ts from 'typescript';
import {
  defaultLocale,
  detectLocale,
  languageUrl,
  languages,
  localePath,
  resolveLocale,
  resolveLocalePath,
  translator,
  type Locale,
} from '../lib/i18n';
import { I18nProvider } from '../lib/i18n/provider';
import { bodies, regions, speedLabel } from '../lib/solar';
import { comets, cometModelNote } from '../lib/comets';
import {
  asteroids,
  asteroidModelNote,
  asteroidSurfaceNote,
} from '../lib/asteroids';
import { moonSystems } from '../lib/moons';
import { profileContent } from '../lib/profile-content';
import { curiosities } from '../lib/curiosities';
import { eventCategories, eventTopics } from '../lib/event-guide';
import {
  compassPoints,
  observingNotes,
  phaseNames,
  quarterNames,
} from '../lib/lunar-phase';
import CuriosityCard from '../components/curiosity-card';
import MoonDetails from '../components/moon-details';
import MoonPhasePanel from '../components/moon-phase-panel';
import BodyNavigation from '../components/body-navigation';
import { orbitingMoons } from '../lib/moon-orbits';

const codes = Object.keys(languages) as Locale[];
const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
void test('locale selection uses URL, saved preference, browser languages, then the default', () => {
  assert.equal(detectLocale('ja-JP', 'en', ['zh-CN']), 'ja');
  assert.equal(detectLocale('unknown', 'en-GB', ['ja-JP']), 'en');
  assert.equal(detectLocale(null, 'broken', ['zz-ZZ', 'ja-JP']), 'ja');
  assert.equal(detectLocale(null, null, ['zh-TW']), 'zh-CN');
  assert.equal(detectLocale(null, null, ['zz']), defaultLocale);
  assert.equal(resolveLocale('EN_us'), 'en');
  assert.equal(resolveLocale({}), undefined);
  assert.equal(resolveLocalePath('en-US'), 'en');
  assert.equal(resolveLocalePath('en'), undefined);
  assert.equal(localePath('ja'), 'ja-JP');
  assert.equal(
    languageUrl('https://example.test/?v=build&lang=en#moon-titan', 'ja'),
    '/?v=build&lang=ja#moon-titan',
  );
  assert.equal(
    languageUrl('https://example.test/zh-CN/bodies/sun?ref=nav#facts', 'en'),
    '/en-US/bodies/sun?ref=nav#facts',
  );
});
void test('catalogs cover all source keys and interpolation parameters, allowing language-specific plurals', () => {
  const source = languages[defaultLocale].messages;
  const pluralSuffix = /_(zero|one|two|few|many|other)$/;
  const required = Object.keys(source).filter((key) => !pluralSuffix.test(key));
  for (const locale of codes) {
    const catalog = languages[locale].messages;
    for (const key of required)
      assert.ok(Object.hasOwn(catalog, key), `${locale}: missing ${key}`);
    for (const [key, value] of Object.entries(catalog)) {
      const sourceKey = Object.hasOwn(source, key)
        ? key
        : key.replace(pluralSuffix, '');
      assert.ok(Object.hasOwn(source, sourceKey), `${locale}: unknown ${key}`);
      assert.ok(value.trim().length > 0, `${locale}: ${key}`);
      assert.deepEqual(
        placeholders(value),
        placeholders(source[sourceKey as keyof typeof source]),
        `${locale}: ${key}`,
      );
      if (locale === 'en') assert.doesNotMatch(value, /\p{Script=Han}/u, key);
    }
  }
  assert.equal(translator('en')('未登记的文案'), '未登记的文案');
  assert.equal(speedLabel(1, translator('en')), '1 day / s');
  assert.equal(speedLabel(10, translator('en')), '10 days / s');
  assert.equal(speedLabel(1, translator('ja')), '1日 / 秒');
  assert.equal(speedLabel(365, translator('en')), '1 year / s');
  assert.equal(speedLabel(3650, translator('en')), '10 years / s');
  assert.equal(speedLabel(3650, translator('ja')), '10年 / 秒');
  assert.equal(speedLabel(100, translator('en')), '100 days / s');
});
void test('all educational data and literal translation keys have catalog entries', () => {
  const source: Record<string, string> = languages[defaultLocale].messages;
  const check = (value: unknown) => {
    if (typeof value === 'string' && /\p{Script=Han}/u.test(value))
      assert.ok(Object.hasOwn(source, value), value);
    else if (Array.isArray(value)) value.forEach(check);
    else if (value && typeof value === 'object')
      Object.values(value).forEach(check);
  };
  [
    bodies,
    regions,
    comets,
    asteroids,
    asteroidModelNote,
    asteroidSurfaceNote,
    moonSystems,
    curiosities,
    profileContent,
    eventCategories,
    eventTopics,
    phaseNames,
    quarterNames,
    compassPoints,
    observingNotes,
  ].forEach(check);
  const scan = (directory: string) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.name === 'i18n' || item.name === 'ui') continue;
      const path = `${directory}/${item.name}`;
      if (item.isDirectory()) {
        scan(path);
        continue;
      }
      if (!/\.tsx?$/.test(path)) continue;
      const tree = ts.createSourceFile(
        path,
        fs.readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(tree) === 't'
        ) {
          const key = node.arguments[0];
          if (
            key &&
            ts.isStringLiteralLike(key) &&
            /\p{Script=Han}/u.test(key.text)
          )
            check(key.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
  };
  ['app', 'components'].forEach(scan);
});
void test('comet model notes and load notices are translated in every locale', () => {
  const keys = [cometModelNote, '部分彗星模型加载失败，暂用近似形状。'];
  for (const locale of codes) {
    const t = translator(locale);
    for (const key of keys) {
      const translated = t(key);
      assert.ok(translated.trim().length > 0, `${locale}: ${key}`);
      if (locale !== defaultLocale) assert.notEqual(translated, key);
      if (locale === 'en') assert.doesNotMatch(translated, /\p{Script=Han}/u);
    }
  }
});
void test('every body retains its complete sourced fact pool in each language, including numeric comparisons', () => {
  for (const locale of codes) {
    for (const [id, pool] of Object.entries(curiosities)) {
      assert.equal(
        pool.length,
        asteroids.some((item) => item.id === id) ? 6 : 30,
      );
      for (let index = 0; index < pool.length; index++) {
        const html = renderToStaticMarkup(
          createElement(
            I18nProvider,
            { initialLocale: locale },
            createElement(CuriosityCard, { id, index, name: '太阳' }),
          ),
        );
        assert.ok(html.includes(pool[index].source));
        assert.ok(html.includes(`${index + 1}/${pool.length}`));
        assert.doesNotMatch(html, /{{|undefined|NaN|Infinity/);
        if (locale === 'en')
          assert.doesNotMatch(html, /\p{Script=Han}/u, `${id}/${index}`);
      }
    }
  }
});
void test('moon profiles and their navigation use localized names and keep stable body links', () => {
  for (const locale of codes) {
    const t = translator(locale);
    const moon = orbitingMoons.find((m) => m.en === 'Titan')!;
    const markup = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { initialLocale: locale },
        createElement(MoonDetails, { key: 'details', moon, onSelect() {} }),
        createElement(BodyNavigation, {
          key: 'nav',
          selected: moon.id,
          onSelect() {},
        }),
      ),
    );
    assert.ok(markup.includes(t(moon.name)));
    assert.ok(markup.includes(`href="#${moon.id}"`));
    assert.ok(
      markup.includes(
        renderToStaticMarkup(
          createElement('p', null, t(moon.description)),
        ).slice(3, -4),
      ),
    );
    if (locale === 'en') assert.doesNotMatch(markup, /\p{Script=Han}/u);
  }
});

void test('the Moon phase card is fully translated, including its computed labels', () => {
  // Every phase name, compass point and unit in the card comes from the
  // calculation rather than from a literal, so the rendered markup is what
  // proves they are all translated.
  const location = {
    latitude: 39.9042,
    longitude: 116.4074,
    height: 43,
    utcOffset: 8,
  };
  for (const locale of codes) {
    const t = translator(locale);
    const markup = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { initialLocale: locale },
        createElement(MoonPhasePanel, {
          time: Date.parse('2026-09-20T12:00:00Z'),
          location,
          locationSource: 'manual' as const,
          onLocationChange() {},
        }),
      ),
    );
    assert.ok(markup.includes(t('今晚观月窗口')), locale);
    assert.ok(markup.includes(t('月相日历与四相时刻')), locale);
    assert.doesNotMatch(markup, /{{|undefined|NaN|Infinity/, locale);
    if (locale === 'en') assert.doesNotMatch(markup, /\p{Script=Han}/u);
  }
});
