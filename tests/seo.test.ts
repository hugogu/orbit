import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  explorerPath,
  normalizeSiteOrigin,
  serializeJsonLd,
  seoLocales,
} from '../lib/seo';
import { localePath, translator } from '../lib/i18n';

const explorerLayout = readFileSync(
  new URL('../app/(explorer)/layout.tsx', import.meta.url),
  'utf8',
);
const localizedLayout = readFileSync(
  new URL('../app/(localized)/[locale]/layout.tsx', import.meta.url),
  'utf8',
);
const bodyPage = readFileSync(new URL('../app/_pages/body-page.tsx', import.meta.url), 'utf8');

void test('every catalog entry has a unique localized profile URL', () => {
  const entries = catalogEntries();
  const ids = entries.map((entry) => entry.data.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const locale of seoLocales) {
    const paths = entries.map((entry) => bodyDetailsPath(locale, entry.data.id));
    assert.equal(new Set(paths).size, entries.length);
    assert.ok(paths.every((path) => path.startsWith(`/${localePath(locale)}/bodies/`)));
  }
});

void test('localized profile routes use regional URL segments', () => {
  assert.equal(bodyDetailsPath('zh-CN', 'sun'), '/zh-CN/bodies/sun');
  assert.equal(bodyDetailsPath('en', 'sun'), '/en-US/bodies/sun');
  assert.equal(bodyDetailsPath('ja', 'sun'), '/ja-JP/bodies/sun');
});

void test('explorer links keep the language and optional body selection', () => {
  assert.equal(explorerPath('zh-CN'), '/?lang=zh-CN');
  assert.equal(explorerPath('en', 'earth'), '/?lang=en#earth');
  assert.equal(absoluteSiteUrl('/sitemap.xml').endsWith('/sitemap.xml'), true);
});

void test('site origins normalize scheme-less hosts and discard paths safely', () => {
  assert.equal(normalizeSiteOrigin('example.com/orbit'), 'https://example.com');
  assert.equal(normalizeSiteOrigin('https://example.com/orbit/'), 'https://example.com');
  assert.equal(normalizeSiteOrigin('http://localhost:3000/orbit'), 'http://localhost:3000');
  assert.equal(normalizeSiteOrigin('not a URL'), undefined);
});

void test('root layouts emit the route locale before client hydration', () => {
  assert.match(explorerLayout, /<html lang="zh-CN"/);
  assert.match(localizedLayout, /<html lang=\{languages\[locale\]\.intl\}/);
  assert.match(localizedLayout, /generateStaticParams/);
});

void test('JSON-LD escapes script-sensitive characters', () => {
  const serialized = serializeJsonLd({ description: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(serialized, /[<>&]/);
  assert.ok(serialized.includes('\\u003c/script\\u003e'));
});

void test('comet metadata labels omit decorative separators', () => {
  assert.match(bodyPage, /return `\$\{name\} · \$\{t\('彗星档案'\)\}`;/);
  for (const locale of seoLocales) {
    assert.doesNotMatch(translator(locale)('彗星档案'), /\/\s*$/);
  }
});
