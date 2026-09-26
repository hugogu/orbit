import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  aboutPath,
  aboutDescription,
  aboutTitle,
  absoluteSiteUrl,
  bodiesIndexDescription,
  bodiesIndexJsonLd,
  bodiesIndexPath,
  bodiesIndexSections,
  bodiesIndexTitle,
  bodyDetailsPath,
  catalogEntries,
  catalogEntry,
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
  privacyPath,
  privacyDescription,
  privacyTitle,
  profileAncestors,
  profileJsonLd,
  profileTitle,
  serializeJsonLd,
  siteOrigin,
  seoSiteName,
  seoLocales,
  type CatalogEntry,
} from '../lib/seo';
import { eventCategories, eventTopics, eventTopic } from '../lib/event-guide';
import { portraitCredit } from '../lib/profile-images';
import { physicalParameters } from '../lib/physical-facts';
import { profileProperties, propertyUnits } from '../lib/profile-properties';
import {
  solarSystemItem,
  wikidataClasses,
  wikidataEntities,
  wikidataUrl,
} from '../lib/wikidata';
import { languages, localePath, translator, type Locale } from '../lib/i18n';
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
const privacyPage = readFileSync(
  new URL('../app/_pages/privacy-page.tsx', import.meta.url),
  'utf8',
);
const aboutPage = readFileSync(
  new URL('../app/_pages/about-page.tsx', import.meta.url),
  'utf8',
);
const bodiesPage = readFileSync(
  new URL('../app/_pages/bodies-page.tsx', import.meta.url),
  'utf8',
);
const bodiesRoute = readFileSync(
  new URL('../app/(localized)/[locale]/bodies/page.tsx', import.meta.url),
  'utf8',
);
const globalStyles = readFileSync(
  new URL('../app/globals.css', import.meta.url),
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
      'Place',
      'Place',
      'BreadcrumbList',
      'LearningResource',
      'WebPage',
    ],
  );
  const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList')!;
  assert.equal((breadcrumb.itemListElement as Array<unknown>).length, 3);
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

type Node = Record<string, unknown>;

function profileGraph(entry: CatalogEntry, locale: Locale) {
  const canonical = absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id));
  const nodes = profileJsonLd({
    entry,
    locale,
    title: profileTitle(entry, locale),
    description: translator(locale)(entry.data.description),
    canonical,
  })['@graph'] as Node[];
  return { canonical, nodes };
}

/** Every JSON-LD graph the site publishes, keyed by the page carrying it. */
function publishedGraphs() {
  const graphs: { page: string; nodes: Node[] }[] = [
    { page: absoluteSiteUrl('/'), nodes: homeJsonLd()['@graph'] as Node[] },
  ];
  for (const locale of seoLocales) {
    const bodies = absoluteSiteUrl(bodiesIndexPath(locale));
    graphs.push({
      page: bodies,
      nodes: bodiesIndexJsonLd({
        locale,
        title: bodiesIndexTitle(locale),
        description: bodiesIndexDescription(locale),
        canonical: bodies,
      })['@graph'] as Node[],
    });
    for (const entry of catalogEntries()) {
      const { canonical, nodes } = profileGraph(entry, locale);
      graphs.push({ page: canonical, nodes });
    }
    const events = absoluteSiteUrl(eventsIndexPath(locale));
    graphs.push({
      page: events,
      nodes: eventsIndexJsonLd({
        locale,
        title: eventsIndexTitle(locale),
        description: 'Sky events.',
        canonical: events,
      })['@graph'] as Node[],
    });
    for (const topic of eventTopics) {
      const canonical = absoluteSiteUrl(eventDetailsPath(locale, topic.id));
      graphs.push({
        page: canonical,
        nodes: eventJsonLd({
          topic,
          locale,
          title: eventTitle(topic, locale),
          description: 'A sky event.',
          canonical,
        })['@graph'] as Node[],
      });
    }
  }
  return graphs;
}

/** Visit every object in a graph, nested ones included. */
function eachObject(value: unknown, visit: (node: Node) => void) {
  if (Array.isArray(value)) value.forEach((item) => eachObject(item, visit));
  else if (value && typeof value === 'object') {
    visit(value as Node);
    Object.values(value).forEach((item) => eachObject(item, visit));
  }
}

void test('structured data uses only types that schema.org defines', () => {
  // schema.org has no celestial-body type. A validator rejects an unknown
  // @type such as AstronomicalBody, and with it every `about` naming it.
  const vocabulary = new Set([
    'BreadcrumbList',
    'CollectionPage',
    'DefinedTerm',
    'DefinedTermSet',
    'ImageObject',
    'ItemList',
    'LearningResource',
    'ListItem',
    'Organization',
    'Place',
    'PropertyValue',
    'WebPage',
    'WebSite',
  ]);
  for (const { page, nodes } of publishedGraphs())
    eachObject(nodes, (node) => {
      if (!('@type' in node)) return;
      const type = String(node['@type']);
      assert.ok(vocabulary.has(type), `${page}: ${type}`);
    });
});

void test('a graph defines every node its own page refers to', () => {
  for (const { page, nodes } of publishedGraphs()) {
    const defined = new Set<unknown>();
    eachObject(nodes, (node) => {
      if ('@type' in node && '@id' in node) defined.add(node['@id']);
    });
    eachObject(nodes, (node) => {
      const keys = Object.keys(node);
      if (keys.length !== 1 || keys[0] !== '@id') return;
      const id = String(node['@id']);
      // A topic may point at the term set its index page defines.
      if (id.startsWith(`${page}#`) || id.startsWith(`${siteOrigin}#`))
        assert.ok(defined.has(id), `${page}: ${id}`);
    });
  }
});

void test('each profile identifies its body as a Place named by Wikidata', () => {
  assert.deepEqual(
    Object.keys(wikidataEntities).sort(),
    catalogEntries()
      .map((entry) => entry.data.id)
      .sort(),
  );
  const items = Object.values(wikidataEntities).map((entity) => entity.item);
  assert.equal(new Set(items).size, items.length);
  for (const id of [
    ...items,
    solarSystemItem,
    ...Object.values(wikidataClasses),
  ])
    assert.match(id, /^Q[1-9]\d*$/);

  for (const locale of seoLocales) {
    for (const entry of catalogEntries()) {
      const { canonical, nodes } = profileGraph(entry, locale);
      const identity = wikidataEntities[entry.data.id];
      const body = nodes.find(
        (node) => node['@id'] === `${canonical}#astronomical-body`,
      )!;
      const page = nodes.find((node) => node['@type'] === 'WebPage')!;
      assert.equal(body['@type'], 'Place');
      assert.equal(body.sameAs, wikidataUrl(identity.item));
      assert.equal(
        body.additionalType,
        wikidataUrl(wikidataClasses[identity.class]),
      );
      assert.deepEqual(body.mainEntityOfPage, { '@id': page['@id'] });
      assert.deepEqual(page.mainEntity, { '@id': body['@id'] });
      assert.deepEqual(body.containedInPlace, {
        '@id': `${siteOrigin}#solar-system`,
      });

      // Aliases are the body's names in the other catalogues; the explorer's
      // capitalised labels ("EARTH", "1P / HALLEY") are typography.
      const aliases = body.alternateName as string[];
      const names = seoLocales.map((item) => translator(item)(entry.data.name));
      assert.deepEqual(
        aliases,
        [...new Set(names)].filter((name) => name !== body.name),
      );
      for (const alias of aliases)
        assert.doesNotMatch(alias, /^[^a-z]*[A-Z]{2}[^a-z]*$|\s\/\s/, alias);
    }
  }
  // Moons are identified by their article: "Nereid" alone is the sea nymphs.
  assert.equal(wikidataEntities['moon-nereid'].item, 'Q16076');
  assert.equal(wikidataEntities.pluto.class, 'dwarfPlanet');
  assert.equal(wikidataEntities.ceres.class, 'dwarfPlanet');
});

void test('structured body properties restate the figures a profile prints', () => {
  const properties = (id: string) =>
    new Map(
      profileProperties(catalogEntry(id)!).map((property) => [
        property.id,
        property,
      ]),
    );
  const earth = properties('earth');
  assert.equal(earth.get('mass')?.value, physicalParameters.earth.mass);
  assert.equal(propertyUnits[earth.get('mass')!.unit!].code, 'KGM');
  assert.equal(earth.get('meanRadius')?.value, 6371);
  assert.equal(propertyUnits[earth.get('meanSunDistance')!.unit!].code, 'A12');
  // Venus turns backwards; the page prints the period, not the sign.
  assert.equal(properties('venus').get('rotationPeriod')?.value, 243.025);
  // The Sun prints no distance, period or mass, so it states none.
  assert.deepEqual(
    [...properties('sun').keys()],
    ['meanRadius', 'rotationPeriod'],
  );
  // A derived distance carries no floating-point noise.
  assert.equal(properties('halley').get('perihelionDistance')?.value, 0.5728);

  const io = profileGraph(catalogEntry('moon-io')!, 'en').nodes.find(
    (node) => node['@type'] === 'Place' && node.name === 'Io',
  )!;
  const parent = (io.additionalProperty as Node[]).find(
    (property) => property.propertyID === 'parentPlanet',
  )!;
  assert.equal(parent.name, 'Parent planet');
  assert.equal(parent.value, 'Jupiter');
  assert.equal(parent.unitCode, undefined);

  const source: Record<string, string> = languages['zh-CN'].messages;
  for (const entry of catalogEntries())
    for (const property of profileProperties(entry)) {
      assert.ok(Object.hasOwn(source, property.label), property.label);
      if (typeof property.value === 'number')
        assert.ok(Number.isFinite(property.value), property.id);
      else assert.ok(Object.hasOwn(source, property.value), property.value);
    }
});

void test('profile breadcrumbs climb through the body index, a moon through its planet', () => {
  const trail = (id: string) =>
    (
      profileGraph(catalogEntry(id)!, 'en').nodes.find(
        (node) => node['@type'] === 'BreadcrumbList',
      )!.itemListElement as Node[]
    ).map((step) => step.item);
  const home = absoluteSiteUrl('/');
  const index = absoluteSiteUrl(bodiesIndexPath('en'));
  const profile = (id: string) => absoluteSiteUrl(bodyDetailsPath('en', id));
  assert.deepEqual(trail('earth'), [home, index, profile('earth')]);
  assert.deepEqual(trail('halley'), [home, index, profile('halley')]);
  assert.deepEqual(trail('moon-io'), [
    home,
    index,
    profile('jupiter'),
    profile('moon-io'),
  ]);
  for (const locale of seoLocales)
    for (const entry of catalogEntries()) {
      const ancestors = profileAncestors(entry, locale);
      assert.equal(ancestors[0].path, bodiesIndexPath(locale));
      assert.equal(ancestors.length, entry.kind === 'moon' ? 2 : 1);
      assert.ok(
        ancestors.every(
          (step) => step.path !== bodyDetailsPath(locale, entry.data.id),
        ),
      );
    }
  // The visible breadcrumb reads the same ancestors as the structured one.
  assert.match(bodyPage, /profileAncestors\(entry, locale\)\.map/);
});

void test('the body index lists every profile once, in the order it prints them', () => {
  assert.equal(bodiesIndexPath('zh-CN'), '/zh-CN/bodies');
  assert.equal(bodiesIndexPath('en'), '/en-US/bodies');
  const sections = bodiesIndexSections();
  const listed = sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.entries.map((entry) => entry.data.id),
    ),
  );
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual(
    [...listed].sort(),
    catalogEntries()
      .map((entry) => entry.data.id)
      .sort(),
  );
  for (const group of sections.find((section) => section.id === 'moons')!
    .groups)
    assert.ok(
      group.entries.every(
        (entry) =>
          entry.kind === 'moon' && entry.data.parentId === group.planet?.id,
      ),
    );

  const canonical = absoluteSiteUrl(bodiesIndexPath('ja'));
  const nodes = bodiesIndexJsonLd({
    locale: 'ja',
    title: bodiesIndexTitle('ja'),
    description: bodiesIndexDescription('ja'),
    canonical,
  })['@graph'] as Node[];
  assert.deepEqual(
    nodes.map((node) => node['@type']),
    ['Organization', 'WebSite', 'BreadcrumbList', 'ItemList', 'CollectionPage'],
  );
  const list = nodes.find((node) => node['@type'] === 'ItemList')!;
  assert.equal(list.numberOfItems, listed.length);
  assert.deepEqual(
    (list.itemListElement as Node[]).map((item) => item.url),
    listed.map((id) => absoluteSiteUrl(bodyDetailsPath('ja', id))),
  );
  const page = nodes.find((node) => node['@type'] === 'CollectionPage')!;
  assert.deepEqual(page.mainEntity, { '@id': list['@id'] });

  assert.match(bodiesRoute, /from '\.\.\/\.\.\/\.\.\/_pages\/bodies-page'/);
  assert.match(bodiesPage, /generateStaticParams/);
  assert.match(bodiesPage, /bodiesIndexJsonLd\(/);
  assert.match(bodiesPage, /dynamicParams = false/);
});

void test('the body index reads as whole sentences in every language', () => {
  for (const locale of seoLocales) {
    const t = translator(locale);
    const sentences = [
      [bodiesIndexTitle(locale), bodiesIndexTitle('zh-CN')],
      [bodiesIndexDescription(locale), bodiesIndexDescription('zh-CN')],
      ...bodiesIndexSections().map((section) => [
        t(section.summary),
        section.summary,
      ]),
    ];
    // Short names may coincide: Japanese writes 彗星 exactly as Chinese does.
    const names = [
      t('天体档案'),
      ...bodiesIndexSections().map((section) => t(section.name)),
    ];
    assert.doesNotMatch(bodiesIndexTitle(locale), /[/·→]\s*$/);
    for (const [text, source] of sentences) {
      assert.ok(text.trim().length > 0);
      if (locale !== 'zh-CN') assert.notEqual(text, source);
    }
    if (locale === 'en')
      for (const text of [...sentences.map(([text]) => text), ...names])
        assert.doesNotMatch(text, /\p{Script=Han}/u, text);
  }
});

void test('sitemap repeats reciprocal hreflang links for every localized page', () => {
  const entries = sitemapEntries();
  const localized = entries.filter((entry) => entry.alternates);
  // Every profile and sky-event topic, plus the two indexes above them and
  // the two standalone legal pages (privacy, about).
  const routes = catalogEntries().length + eventTopics.length + 4;
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

void test('sitemap lists each profile\'s hero image for direct image discovery', () => {
  const entries = sitemapEntries();
  const byLoc = new Map(entries.map((entry) => [entry.loc, entry]));
  const catalog = catalogEntries();
  for (const entry of catalog) {
    for (const locale of seoLocales) {
      const loc = absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id));
      assert.deepEqual(byLoc.get(loc)?.images, [
        absoluteSiteUrl(entryImagePath(entry)),
      ]);
    }
  }
  const withImages = entries.filter((entry) => entry.images);
  assert.equal(withImages.length, catalog.length * seoLocales.length);
  assert.match(
    renderSitemap(),
    /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/,
  );
  assert.equal(
    (renderSitemap().match(/<image:image>/g) ?? []).length,
    withImages.length,
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

void test('the privacy and about pages have unique localized URLs', () => {
  assert.equal(privacyPath('zh-CN'), '/zh-CN/privacy');
  assert.equal(privacyPath('en'), '/en-US/privacy');
  assert.equal(aboutPath('ja'), '/ja-JP/about');
  const paths = seoLocales.flatMap((locale) => [
    privacyPath(locale),
    aboutPath(locale),
  ]);
  assert.equal(new Set(paths).size, paths.length);
});

void test('privacy and about read as translated, undecorated titles', () => {
  const pages = [
    { title: privacyTitle, description: privacyDescription },
    { title: aboutTitle, description: aboutDescription },
  ];
  for (const { title: pageTitle, description: pageDescription } of pages) {
    const zhTitle = pageTitle('zh-CN');
    const zhDescription = pageDescription('zh-CN');
    for (const locale of seoLocales) {
      const title = pageTitle(locale);
      const description = pageDescription(locale);
      assert.ok(title.trim().length > 0);
      assert.ok(description.trim().length > 0);
      assert.doesNotMatch(title, /[/·→]\s*$/);
      if (locale !== 'zh-CN') {
        assert.notEqual(title, zhTitle);
        assert.notEqual(description, zhDescription);
      }
      if (locale === 'en') {
        assert.doesNotMatch(title, /\p{Script=Han}/u, title);
        assert.doesNotMatch(description, /\p{Script=Han}/u, description);
      }
    }
  }
});

void test('privacy and about routes render their own static params and metadata', () => {
  for (const page of [privacyPage, aboutPage]) {
    assert.match(page, /generateStaticParams/);
    assert.match(page, /dynamicParams = false/);
    assert.match(page, /robots: \{ index: true, follow: true/);
  }
  // Each links to the other rather than to itself.
  assert.match(privacyPage, /href=\{aboutPath\(locale\)\}/);
  assert.doesNotMatch(privacyPage, /href=\{privacyPath\(locale\)\}/);
  assert.match(aboutPage, /href=\{privacyPath\(locale\)\}/);
  assert.doesNotMatch(aboutPage, /href=\{aboutPath\(locale\)\}/);
});

void test('every crawlable page links to the privacy policy', () => {
  for (const page of [bodyPage, eventsPage, eventPage, bodiesPage, aboutPage])
    assert.match(page, /href=\{privacyPath\(locale\)\}/);
  // The interactive explorer offers both from its help dialog.
  assert.match(homePage, /href=\{privacyPath\(locale\)\}/);
  assert.match(homePage, /href=\{aboutPath\(locale\)\}/);
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

void test('the home heading names the subject and survives the phone layout', () => {
  assert.match(homePage, /<h1>\{t\('3D太阳系模拟器'\)\}<\/h1>/);
  assert.match(
    homePage,
    /<p>\s*\{tab === 'structure'[\s\S]*?t\('在宇宙中，找到我们。'\)\}\s*<\/p>/,
  );

  // Phones and short landscape screens clear the scene by dropping the tagline;
  // the heading itself must stay in the layout Google indexes.
  assert.match(
    globalStyles,
    /\.scene-caption > p,\n\s*\.info-panel,\n\s*\.desktop-body-tree,/,
  );
  assert.doesNotMatch(globalStyles, /^\s*\.scene-caption,$/m);
});

void test('the built-in origin is the canonical host, not one that redirects', () => {
  assert.match(seoModule, /fallbackSiteOrigin = 'https:\/\/orbits\.observer'/);
  assert.doesNotMatch(seoModule, /https:\/\/www\./);
});
