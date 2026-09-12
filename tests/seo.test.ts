import test from 'node:test';
import assert from 'node:assert/strict';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  explorerPath,
  seoLocales,
} from '../lib/seo.ts';

void test('every catalog entry has a unique localized profile URL', () => {
  const entries = catalogEntries();
  const ids = entries.map((entry) => entry.data.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const locale of seoLocales) {
    const paths = entries.map((entry) => bodyDetailsPath(locale, entry.data.id));
    assert.equal(new Set(paths).size, entries.length);
    assert.ok(paths.every((path) => path.startsWith(`/${locale}/bodies/`)));
  }
});

void test('explorer links keep the language and optional body selection', () => {
  assert.equal(explorerPath('zh-CN'), '/?lang=zh-CN');
  assert.equal(explorerPath('en', 'earth'), '/?lang=en#earth');
  assert.equal(absoluteSiteUrl('/sitemap.xml').endsWith('/sitemap.xml'), true);
});
