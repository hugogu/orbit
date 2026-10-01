import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventCategories,
  eventCategory,
  eventTopic,
  eventTopics,
  topicsByCategory,
} from '../lib/event-guide';
import { catalogEntry } from '../lib/seo';
import { languages, translator, type Locale } from '../lib/i18n';

const codes = Object.keys(languages) as Locale[];
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;

void test('every topic is addressable, categorized and complete', () => {
  assert.ok(eventTopics.length > 0);
  const ids = eventTopics.map((topic) => topic.id);
  assert.equal(new Set(ids).size, ids.length);
  const categoryIds = eventCategories.map((category) => category.id);
  assert.equal(new Set(categoryIds).size, categoryIds.length);
  for (const topic of eventTopics) {
    assert.match(topic.id, slug, topic.id);
    assert.equal(eventTopic(topic.id), topic);
    assert.equal(eventCategory(topic.category).id, topic.category);
    assert.ok(topic.sections.length >= 2, topic.id);
    assert.ok(topic.facts.length >= 3, topic.id);
    assert.ok(topic.observing.length >= 2, topic.id);
    const labels = topic.facts.map((fact) => fact.label);
    assert.equal(new Set(labels).size, labels.length, topic.id);
    // The page prints the recurrence beside the facts; a repeat would read twice.
    assert.ok(!labels.includes('发生频率'), topic.id);
  }
  // Every category carries at least one topic, and the index shows them all.
  const listed = eventCategories.flatMap((category) =>
    topicsByCategory(category.id),
  );
  assert.deepEqual(new Set(listed), new Set(eventTopics));
  for (const category of eventCategories)
    assert.ok(topicsByCategory(category.id).length > 0, category.id);
});

void test('topics cite reachable sources and link only to catalogued bodies', () => {
  for (const topic of eventTopics) {
    assert.ok(topic.sources.length >= 2, topic.id);
    for (const source of topic.sources) {
      assert.match(source.url, /^https:\/\//, `${topic.id}: ${source.url}`);
      assert.doesNotMatch(source.name, /\p{Script=Han}/u, topic.id);
    }
    const urls = topic.sources.map((source) => source.url);
    assert.equal(new Set(urls).size, urls.length, topic.id);
    for (const id of topic.bodies)
      assert.ok(catalogEntry(id), `${topic.id}: unknown body ${id}`);
    assert.equal(new Set(topic.bodies).size, topic.bodies.length, topic.id);
  }
});

void test('guide copy is translated in every language', () => {
  for (const locale of codes) {
    const t = translator(locale);
    const strings = [
      ...eventCategories.flatMap((category) => [
        category.name,
        category.summary,
      ]),
      ...eventTopics.flatMap((topic) => [
        topic.name,
        topic.season,
        topic.summary,
        topic.headline,
        topic.intro,
        ...topic.sections.flatMap((section) => [section.heading, section.text]),
        ...topic.facts.flatMap((fact) => [fact.label, fact.value]),
        ...topic.observing,
      ]),
    ];
    for (const key of strings) {
      const translated = t(key);
      assert.ok(translated.trim().length > 0, `${locale}: ${key}`);
      if (locale === 'en')
        assert.doesNotMatch(translated, /\p{Script=Han}/u, key);
    }
  }
});

void test('lunar eclipse recurrence counts every type worldwide by calendar year', () => {
  const recurrence = eventTopic('lunar-eclipse')?.season;
  assert.equal(recurrence, '全球每公历年 2 至 5 次，含半影月食');
  assert.equal(
    translator('en')(recurrence),
    'Worldwide, 2–5 per calendar year, including penumbral eclipses',
  );
  assert.equal(
    translator('ja')(recurrence),
    '世界全体で暦年に2〜5回（半影月食を含む）',
  );
});

void test('Ursids guidance qualifies circumpolar viewing by latitude and darkness', () => {
  const ursids = eventTopic('ursids');
  assert.ok(ursids);
  const radiant = ursids.sections.find(
    (section) => section.heading === '拱极的辐射点',
  );
  assert.ok(radiant);
  for (const [locale, latitude, horizon, darkness, south] of [
    ['zh-CN', /北半球中高纬度/, /低纬度.*升落/, /天空.*暗/, /南半球.*难以观测/],
    [
      'en',
      /northern mid and high latitudes/,
      /lower northern latitudes.*rise and set/,
      /bright sky/,
      /difficult.*southern/,
    ],
    [
      'ja',
      /北半球の中・高緯度/,
      /低緯度.*昇り沈み/,
      /空が明るい/,
      /南半球.*困難/,
    ],
  ] as const) {
    const t = translator(locale);
    assert.match(t(ursids.summary), latitude);
    assert.match(t(radiant.text), horizon);
    assert.match(t(radiant.text), darkness);
    assert.match(t(radiant.text), south);
    assert.match(t(ursids.observing[0]), latitude);
    assert.doesNotMatch(t(ursids.observing[0]), /任何时段|any hour|どの時間帯/);
  }
});
