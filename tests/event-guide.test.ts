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
