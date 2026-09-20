import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  entryImagePath,
  eventDetailsPath,
  eventJsonLd,
  eventsIndexJsonLd,
  eventsIndexPath,
  eventsIndexTitle,
  eventTitle,
  explorerPath,
  homeJsonLd,
  normalizeSiteOrigin,
  ogImagePath,
  profileJsonLd,
  profileTitle,
  serializeJsonLd,
  siteOrigin,
  seoSiteName,
  seoLocales,
} from '../lib/seo';
import { eventCategories, eventTopics, eventTopic } from '../lib/event-guide';
import { portraitCredit } from '../lib/profile-images';
import { localePath, translator } from '../lib/i18n';
import { renderSitemap, sitemapEntries } from '../lib/sitemap';
import { htmlTagAttributes } from '../scripts/lib/html-tags';

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
const rootProviders = readFileSync(
  new URL('../app/root-providers.tsx', import.meta.url),
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
const bodyPage = readFileSync(
  new URL('../app/_pages/body-page.tsx', import.meta.url),
  'utf8',
);
const profileShare = readFileSync(
  new URL('../components/profile-share.tsx', import.meta.url),
  'utf8',
);
const notFoundPage = readFileSync(
  new URL('../app/not-found.tsx', import.meta.url),
  'utf8',
);
const eventsPage = readFileSync(
  new URL('../app/_pages/events-page.tsx', import.meta.url),
  'utf8',
);
const eventPage = readFileSync(
  new URL('../app/_pages/event-page.tsx', import.meta.url),
  'utf8',
);
const seoModule = readFileSync(
  new URL('../lib/seo.ts', import.meta.url),
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
  const webpage = nodes.find((node) => node['@type'] === 'WebPage')!;
  const image = webpage.primaryImageOfPage as Record<string, unknown>;
  const credit = portraitCredit(entry);
  assert.equal(
    image.acquireLicensePage,
    new URL(credit.url, `${siteOrigin}/`).toString(),
  );
  assert.deepEqual(image.creator, {
    '@type': 'Organization',
    name: seoSiteName,
    url: siteOrigin,
  });
  assert.match(String(image.copyrightNotice), /Source attribution/);
  assert.equal(image.creditText, `${credit.name}; rendered by ORBIT`);
  const homeNodes = homeJsonLd()['@graph'] as Array<Record<string, unknown>>;
  assert.equal(homeNodes.length, 3);
  assert.ok(
    homeNodes.every(
      (node) => node.name === seoSiteName || node['@type'] === 'Organization',
    ),
  );
});

void test('sitemap repeats reciprocal hreflang links for every localized page', () => {
  const entries = sitemapEntries();
  const localized = entries.filter((entry) => entry.alternates);
  const routes = catalogEntries().length + eventTopics.length + 1;
  assert.equal(localized.length, routes * seoLocales.length);
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

void test('sky-event pages have unique localized URLs under a shared index', () => {
  const ids = eventTopics.map((topic) => topic.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(eventsIndexPath('zh-CN'), '/zh-CN/events');
  assert.equal(eventsIndexPath('en'), '/en-US/events');
  assert.equal(eventDetailsPath('ja', 'geminids'), '/ja-JP/events/geminids');
  for (const locale of seoLocales) {
    const paths = ids.map((id) => eventDetailsPath(locale, id));
    assert.equal(new Set(paths).size, ids.length);
    assert.ok(
      paths.every((path) => path.startsWith(`${eventsIndexPath(locale)}/`)),
    );
  }
});

void test('guide index JSON-LD collects every topic under one term set', () => {
  const canonical = absoluteSiteUrl(eventsIndexPath('en'));
  const nodes = eventsIndexJsonLd({
    locale: 'en',
    title: eventsIndexTitle('en'),
    description: 'Sky events.',
    canonical,
  })['@graph'] as Array<Record<string, unknown>>;
  assert.deepEqual(
    nodes.map((node) => node['@type']),
    [
      'Organization',
      'WebSite',
      'BreadcrumbList',
      'DefinedTermSet',
      'CollectionPage',
    ],
  );
  const set = nodes.find((node) => node['@type'] === 'DefinedTermSet')!;
  const terms = set.hasDefinedTerm as Array<Record<string, string>>;
  assert.equal(terms.length, eventTopics.length);
  assert.deepEqual(
    terms.map((term) => term.url),
    eventTopics.map((topic) =>
      absoluteSiteUrl(eventDetailsPath('en', topic.id)),
    ),
  );
  const page = nodes.find((node) => node['@type'] === 'CollectionPage')!;
  assert.deepEqual(page.mainEntity, { '@id': set['@id'] });
});

void test('event JSON-LD breadcrumbs climb to the guide index, not the topic itself', () => {
  const topic = eventTopic('perseids')!;
  const canonical = absoluteSiteUrl(eventDetailsPath('en', topic.id));
  const nodes = eventJsonLd({
    topic,
    locale: 'en',
    title: eventTitle(topic, 'en'),
    description: 'The Perseids.',
    canonical,
  })['@graph'] as Array<Record<string, unknown>>;
  assert.deepEqual(
    nodes.map((node) => node['@type']),
    [
      'Organization',
      'WebSite',
      'DefinedTerm',
      'BreadcrumbList',
      'LearningResource',
      'WebPage',
    ],
  );
  const trail = nodes.find((node) => node['@type'] === 'BreadcrumbList')!
    .itemListElement as Array<Record<string, string>>;
  assert.deepEqual(
    trail.map((step) => step.item),
    [absoluteSiteUrl('/'), absoluteSiteUrl(eventsIndexPath('en')), canonical],
  );
  const term = nodes.find((node) => node['@type'] === 'DefinedTerm')!;
  assert.equal(term.termCode, topic.id);
  assert.deepEqual(term.inDefinedTermSet, {
    '@id': `${absoluteSiteUrl(eventsIndexPath('en'))}#event-guide`,
  });
  const webpage = nodes.find((node) => node['@type'] === 'WebPage')!;
  assert.deepEqual(webpage.about, { '@id': `${canonical}#sky-event` });
});

void test('guide titles read as plain names in every language', () => {
  for (const locale of seoLocales) {
    const t = translator(locale);
    const indexTitle = eventsIndexTitle(locale);
    assert.ok(indexTitle.trim().length > 0);
    assert.doesNotMatch(indexTitle, /[/·→]\s*$/);
    if (locale !== 'zh-CN')
      assert.notEqual(indexTitle, eventsIndexTitle('zh-CN'));
    if (locale === 'en') assert.doesNotMatch(indexTitle, /\p{Script=Han}/u);
    for (const topic of eventTopics) {
      const title = eventTitle(topic, locale);
      assert.ok(title.includes(t(topic.name)), `${locale}: ${topic.id}`);
      assert.doesNotMatch(title, /[/·→]\s*$/);
      if (locale !== 'zh-CN') assert.notEqual(title, topic.name);
      if (locale === 'en')
        assert.doesNotMatch(title, /\p{Script=Han}/u, topic.id);
    }
    for (const category of eventCategories)
      assert.ok(t(category.summary).trim().length > 0, category.id);
  }
});

void test('guide routes render their own static params, metadata and structured data', () => {
  assert.match(eventsPage, /generateStaticParams/);
  assert.match(eventsPage, /eventsIndexJsonLd\(/);
  assert.match(eventsPage, /dynamicParams = false/);
  assert.match(eventPage, /generateStaticParams/);
  assert.match(eventPage, /eventJsonLd\(/);
  assert.match(eventPage, /dynamicParams = false/);
  // The topic page must climb back to its own collection page.
  assert.match(eventPage, /href=\{eventsIndexPath\(locale\)\}/);
  // The explorer offers the guide beside the eclipse planner.
  assert.match(homePage, /className="astronomy-actions"/);
  assert.match(homePage, /href=\{eventsIndexPath\(locale\)\}/);
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

void test('shared root providers mount analytics for every route group', () => {
  assert.match(rootProviders, /from '@vercel\/analytics\/next'/);
  assert.match(rootProviders, /<Analytics \/>/);
});

void test('root layouts place the AdSense loader in each document head', () => {
  const headContent = (layout: string) =>
    layout.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
  assert.match(
    explorerLayout,
    /import GoogleAdSense from '\.\.\/\.\.\/components\/google-adsense'/,
  );
  assert.match(headContent(explorerLayout), /<GoogleAdSense \/>/);
  assert.match(
    localizedLayout,
    /import GoogleAdSense from '\.\.\/\.\.\/\.\.\/components\/google-adsense'/,
  );
  assert.match(headContent(localizedLayout), /<GoogleAdSense \/>/);
});

void test('AdSense loader uses the supplied client ID and cross-origin settings', () => {
  const adSense = readFileSync(
    new URL('../components/google-adsense.tsx', import.meta.url),
    'utf8',
  );
  assert.match(adSense, /ca-pub-8644095085401499/);
  assert.match(
    adSense,
    /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/,
  );
  assert.match(adSense, /crossOrigin="anonymous"/);
  assert.match(adSense, /<script/);
});

void test('locale hydration preserves route-owned profile titles and descriptions', () => {
  const provider = readFileSync(
    new URL('../lib/i18n/provider.tsx', import.meta.url),
    'utf8',
  );
  const find = (pattern: RegExp) => {
    const position = provider.search(pattern);
    assert.ok(position >= 0, `Missing provider source pattern: ${pattern}`);
    return position;
  };
  const guard = find(
    /if\s*\(\s*window\.location\.pathname\s*!==\s*['"]\/['"]\s*\)\s*return\s*;/,
  );
  assert.ok(guard > find(/document\.documentElement\.lang\s*=/));
  assert.ok(guard < find(/document\.title\s*=/));
  assert.ok(guard < find(/meta\[name\s*=\s*['"]description['"]\s*\]/));
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
  assert.match(physicalFacts, /ArrowUpRight[\s\S]*external-arrow/);
  assert.doesNotMatch(bodyPage, /在 3D 观测台中观察[\s\S]*↗/);
  assert.doesNotMatch(bodyPage, /entryName\(item, locale\)[\s\S]*↗/);
  assert.match(homePage, /omitSource=\{[\s\S]*body\.id === 'sun'/);
  assert.match(
    homePage,
    /name=\{t\(activeComet\.name\)\}[\s\S]*showSource=\{false\}/,
  );
});

void test('profile export metadata parsing ignores attribute order and casing', () => {
  const [link] = htmlTagAttributes(
    '<LINK HREF="https://example.com/en" hrefLang="en-US" REL="alternate canonical">',
    'link',
  );
  assert.equal(link.get('href'), 'https://example.com/en');
  assert.equal(link.get('hreflang'), 'en-US');
  assert.equal(link.get('rel'), 'alternate canonical');

  const meta = htmlTagAttributes(
    '<meta content="600" property="og:image:width"><META CONTENT="square.jpg" PROPERTY="og:image">',
    'meta',
  );
  const image = meta.find(
    (attributes) => attributes.get('property')?.toLowerCase() === 'og:image',
  );
  assert.equal(image?.get('content'), 'square.jpg');
});

void test('profile sharing announces copy status changes', () => {
  assert.match(profileShare, /<output aria-live="polite" aria-atomic="true">/);
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

void test('the built-in origin is the canonical host, not one that redirects', () => {
  assert.match(seoModule, /fallbackSiteOrigin = 'https:\/\/orbits\.observer'/);
  assert.doesNotMatch(seoModule, /https:\/\/www\./);
});
