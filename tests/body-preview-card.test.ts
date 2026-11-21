import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BodyPreviewCard from '../components/body-preview-card';
import MoonPhaseCard from '../components/moon-phase-card';
import { I18nProvider } from '../lib/i18n/provider';
import { translator } from '../lib/i18n';
import { portraitPath } from '../lib/profile-images';
import { catalogEntries, catalogEntry } from '../lib/seo';
import { fallbackSkyLocation } from '../lib/sky-events';

const t = translator('en');
const onOpen = () => {};

function renderPreview(id: string) {
  const entry = catalogEntry(id);
  assert.ok(entry);
  return renderToStaticMarkup(
    createElement(
      I18nProvider,
      { initialLocale: 'en' },
      createElement(BodyPreviewCard, { entry, onOpen }),
    ),
  );
}

void test('all selectable catalogue bodies have a localized preview and a details action', () => {
  for (const { data } of catalogEntries()) {
    const html = renderPreview(data.id);
    assert.ok(html.includes(renderToStaticMarkup(t(data.name))), data.id);
    assert.ok(html.includes(portraitPath(data.id)), data.id);
    assert.match(html, /<button\b[^>]+aria-haspopup="dialog"/);
    assert.equal((html.match(/<small>/g) ?? []).length, 3, data.id);
    assert.doesNotMatch(html, /undefined|NaN/);
  }
});

void test('preview facts use the applicable dimensions and orbital reference', () => {
  const expected = {
    sun: ['平均半径', '自转周期'],
    earth: ['平均半径', '公转周期'],
    'moon-io': ['天然卫星', '公转周期'],
    bennu: ['等效直径', '模型公转周期'],
    halley: ['模型公转周期', '模型近日点'],
  };
  for (const [id, labels] of Object.entries(expected)) {
    const html = renderPreview(id);
    for (const label of labels) assert.ok(html.includes(t(label)), id);
  }
  assert.ok(!renderPreview('sun').includes(t('公转周期')));
  assert.ok(renderPreview('bennu').includes('0.484'));
});

void test('compact Moon preview names the body and keeps the current phase readout', () => {
  const html = renderToStaticMarkup(
    createElement(
      I18nProvider,
      { initialLocale: 'en' },
      createElement(MoonPhaseCard, {
        time: Date.parse('2024-04-08T18:20:00Z'),
        location: fallbackSkyLocation,
        preview: true,
        onOpen,
      }),
    ),
  );
  assert.ok(html.includes(`<strong>${t('月球')}</strong>`));
  assert.ok(html.includes(t('新月')));
  assert.match(html, /<canvas/);
  assert.match(html, /<button\b[^>]+aria-haspopup="dialog"/);
});
