import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  entryImagePath,
  explorerPath,
  homeJsonLd,
  normalizeSiteOrigin,
  ogImagePath,
  profileJsonLd,
  profileTitle,
  serializeJsonLd,
  seoSiteName,
  seoLocales,
} from '../lib/seo';
import { localePath, translator } from '../lib/i18n';
import { renderSitemap, sitemapEntries } from '../lib/sitemap';

const explorerLayout = readFileSync(
  new URL('../app/(explorer)/layout.tsx', import.meta.url),
  'utf8',
);
const explorerPage = readFileSync(
  new URL('../app/(explorer)/page.tsx', import.meta.url),
  'utf8',
);
const localizedLayout = readFileSync(
  new URL('../app/(localized)/[locale]/layout.tsx', import.meta.url),
  'utf8',
);
const bodyNavigation = readFileSync(
  new URL('../components/body-navigation.tsx', import.meta.url),
  'utf8',
);
const homePage = readFileSync(
  new URL('../app/_pages/home-page.tsx', import.meta.url),
  'utf8',
);
const physicalFacts = readFileSync(
  new URL('../components/physical-facts.tsx', import.meta.url),
  'utf8',
);
const notFoundPage = readFileSync(
  new URL('../app/not-found.tsx', import.meta.url),
  'utf8',
);
const vercelConfig = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
);

void test('every catalog entry has a unique localized profile URL', () => {
  const entries = catalogEntries();
  const ids = entries.map((entry) => entry.data.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const locale of seoLocales) {
    const paths = entries.map((entry) =>
      bodyDetailsPath(locale, entry.data.id),
    );
    assert.equal(new Set(paths).size, entries.length);
    assert.ok(
      paths.every((path) => path.startsWith(`/${localePath(locale)}/bodies/`)),
    );
  }
});

void test('localized profile routes use regional URL segments', () => {
  assert.equal(bodyDetailsPath('zh-CN', 'sun'), '/zh-CN/bodies/sun');
  assert.equal(bodyDetailsPath('en', 'sun'), '/en-US/bodies/sun');
  assert.equal(bodyDetailsPath('ja', 'sun'), '/ja-JP/bodies/sun');
});

void test('profiles expose local images and unique localized social assets', () => {
  const entries = catalogEntries();
  for (const entry of entries) {
    assert.match(entryImagePath(entry), /^\/media\/v\d+\/bodies\//);
  }
  for (const locale of seoLocales) {
    const images = entries.map((entry) => ogImagePath(locale, entry.data.id));
    assert.equal(new Set(images).size, entries.length);
    assert.ok(images.every((path) => path.endsWith('.jpg')));
  }
});

void test('profile JSON-LD describes the learning resource and breadcrumb graph', () => {
  const entry = catalogEntries().find((item) => item.data.id === 'sun')!;
  const graph = profileJsonLd({
    entry,
    locale: 'en',
    title: 'Sun · Solar System facts',
    description: 'A profile of the Sun.',
    canonical: absoluteSiteUrl(bodyDetailsPath('en', 'sun')),
  });
  const nodes = graph['@graph'] as Array<Record<string, unknown>>;
  assert.deepEqual(
    nodes.map((node) => node['@type']),
    [
      'Organization',
      'WebSite',
      'AstronomicalBody',
      'BreadcrumbList',
      'LearningResource',
      'WebPage',
    ],
  );
  const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList')!;
  assert.equal((breadcrumb.itemListElement as Array<unknown>).length, 2);
  assert.equal((nodes[0] as Record<string, unknown>).name, seoSiteName);
  assert.equal((nodes[1] as Record<string, unknown>).name, seoSiteName);
  const resource = nodes.find((node) => node['@type'] === 'LearningResource')!;
  assert.equal(resource.educationalLevel, 'Beginner');
  assert.deepEqual(resource.author, resource.provider);
  const homeNodes = homeJsonLd()['@graph'] as Array<Record<string, unknown>>;
  assert.equal(homeNodes.length, 3);
  assert.ok(
    homeNodes.every(
      (node) => node.name === seoSiteName || node['@type'] === 'Organization',
    ),
  );
});

void test('sitemap repeats reciprocal hreflang links for every localized profile', () => {
  const entries = sitemapEntries();
  const localized = entries.filter((entry) => entry.alternates);
  assert.equal(localized.length, catalogEntries().length * seoLocales.length);
  assert.equal(
    new Set(
      localized.flatMap((entry) =>
        entry.alternates!.map((link) => link.hreflang),
      ),
    ).size,
    4,
  );
  assert.ok(localized.every((entry) => entry.alternates!.length === 4));
  assert.match(
    renderSitemap(),
    /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/,
  );
  assert.equal(
    (renderSitemap().match(/<xhtml:link /g) ?? []).length,
    localized.length * 4,
  );
});

void test('explorer links keep the language and optional body selection', () => {
  assert.equal(explorerPath('zh-CN'), '/?lang=zh-CN');
  assert.equal(explorerPath('en', 'earth'), '/?lang=en#earth');
  assert.equal(absoluteSiteUrl('/sitemap.xml').endsWith('/sitemap.xml'), true);
});

void test('site origins normalize scheme-less hosts and discard paths safely', () => {
  assert.equal(normalizeSiteOrigin('example.com/orbit'), 'https://example.com');
  assert.equal(
    normalizeSiteOrigin('https://example.com/orbit/'),
    'https://example.com',
  );
  assert.equal(
    normalizeSiteOrigin('http://localhost:3000/orbit'),
    'http://localhost:3000',
  );
  assert.equal(normalizeSiteOrigin('not a URL'), undefined);
});

void test('root layouts emit the route locale before client hydration', () => {
  assert.match(explorerLayout, /<html lang="zh-CN"/);
  assert.match(localizedLayout, /<html lang=\{languages\[locale\]\.intl\}/);
  assert.match(localizedLayout, /generateStaticParams/);
  assert.match(explorerPage, /homeJsonLd\(\)/);
});

void test('JSON-LD escapes script-sensitive characters', () => {
  const serialized = serializeJsonLd({
    description: '</script><script>alert(1)</script>',
  });
  assert.doesNotMatch(serialized, /[<>&]/);
  assert.ok(serialized.includes('\\u003c/script\\u003e'));
});

void test('comet metadata labels omit decorative separators', () => {
  for (const locale of seoLocales) {
    for (const entry of catalogEntries().filter(
      (entry) => entry.kind === 'comet',
    )) {
      assert.doesNotMatch(profileTitle(entry, locale), /[/·→]\s*$/);
      assert.ok(
        profileTitle(entry, locale).includes(
          translator(locale)(entry.data.name),
        ),
      );
    }
  }
});

void test('catalog names are crawlable profile links and headings', () => {
  assert.match(bodyNavigation, /bodyDetailsPath\(locale, body\.id\)/);
  assert.match(bodyNavigation, /<h3 className="body-option-heading">/);
  assert.match(bodyNavigation, /<h4>/);
});

void test('profile navigation separates internal links from external sources', () => {
  assert.match(homePage, /t\('阅读\{\{name\}\}的完整资料'/);
  assert.doesNotMatch(homePage, /阅读\{\{name\}\}的完整资料 ↗/);
  assert.match(physicalFacts, /NASA 太阳资料[\s\S]*span aria-hidden="true">↗/);
  assert.match(homePage, /omitSource=\{[\s\S]*body\.id === 'sun'/);
  assert.match(
    homePage,
    /name=\{t\(activeComet\.name\)\}[\s\S]*showSource=\{false\}/,
  );
});

void test('custom 404 offers noindex metadata and exploration links', () => {
  assert.match(notFoundPage, /index: false/);
  assert.match(notFoundPage, /热门天体/);
  assert.match(notFoundPage, /返回太阳系观测台/);
  assert.match(notFoundPage, /seoLocales\.map/);
  assert.match(notFoundPage, /bodyDetailsPath\(locale, id\)/);
});

void test('Vercel serves extensionless paths for exported HTML profiles', () => {
  assert.equal(vercelConfig.cleanUrls, true);
});
