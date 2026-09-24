import { comets, type Comet } from './comets';
import { asteroids, type Asteroid } from './asteroids';
import { eventCategory, eventTopics, type EventTopic } from './event-guide';
import {
  defaultLocale,
  languages,
  localePath,
  translator,
  type Locale,
  type Translate,
} from './i18n';
import { orbitingMoons, type OrbitingMoon } from './moon-orbits';
import { bodies, type Body } from './solar';
import { portraitPath, wideImagePath, portraitCredit } from './profile-images';
import {
  profileProperties,
  propertyUnits,
  type ProfileProperty,
} from './profile-properties';
import {
  solarSystemItem,
  wikidataClasses,
  wikidataEntity,
  wikidataUrl,
} from './wikidata';

/** Permanent public origin used when a build does not provide an override. */
const fallbackSiteOrigin = 'https://orbits.observer';

/** Plain entity name for metadata and structured data; UI labels may be more decorative. */
export const seoSiteName = 'ORBIT Solar System Observatory';

export function normalizeSiteOrigin(value: string) {
  const candidate = value.trim();
  if (!candidate) return;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    return url.origin;
  } catch {
    return;
  }
}

/**
 * Override this during a build to use a different public hostname. This helper
 * is also imported by the client entry, so it must not assume `process` exists.
 */
function resolveSiteOrigin() {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const configured = runtime.process?.env?.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    const normalized = normalizeSiteOrigin(configured);
    if (normalized) return normalized;
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return fallbackSiteOrigin;
}

export const siteOrigin = resolveSiteOrigin();

export const seoLocales = Object.keys(languages) as Locale[];

export type CatalogEntry =
  | { kind: 'body'; data: Body }
  | { kind: 'moon'; data: OrbitingMoon }
  | { kind: 'asteroid'; data: Asteroid }
  | { kind: 'comet'; data: Comet };

export function catalogEntries(): CatalogEntry[] {
  return [
    ...bodies.map((data) => ({ kind: 'body' as const, data })),
    ...orbitingMoons.map((data) => ({ kind: 'moon' as const, data })),
    ...comets.map((data) => ({ kind: 'comet' as const, data })),
    ...asteroids.map((data) => ({ kind: 'asteroid' as const, data })),
  ];
}

export function catalogEntry(id: string): CatalogEntry | undefined {
  return catalogEntries().find((entry) => entry.data.id === id);
}

export function bodyDetailsPath(locale: Locale, id: string) {
  return `/${localePath(locale)}/bodies/${encodeURIComponent(id)}`;
}

/** Every profile's collection page, and the ancestor its breadcrumb climbs to. */
export function bodiesIndexPath(locale: Locale) {
  return `/${localePath(locale)}/bodies`;
}

/** The sky-event guide: one crawlable index plus one page per event concept. */
export function eventsIndexPath(locale: Locale) {
  return `/${localePath(locale)}/events`;
}

export function eventDetailsPath(locale: Locale, id: string) {
  return `/${localePath(locale)}/events/${encodeURIComponent(id)}`;
}

export function profileTitle(entry: CatalogEntry, locale: Locale) {
  const t = translator(locale);
  return t('{{name}}：结构、轨道与探索', { name: t(entry.data.name) });
}

export function bodiesIndexTitle(locale: Locale) {
  return translator(locale)('天体档案：太阳、行星、卫星、小行星与彗星');
}

export function bodiesIndexDescription(locale: Locale) {
  return translator(locale)(
    '太阳、八颗行星与冥王星、有代表性的卫星，以及著名的小行星与彗星：每份档案都有核心参数、延伸阅读与可信来源。',
  );
}

export function eventsIndexTitle(locale: Locale) {
  return translator(locale)('天象事件：常见天文现象指南');
}

export function eventTitle(topic: EventTopic, locale: Locale) {
  const t = translator(locale);
  return t('{{name}}：成因、周期与观测', { name: t(topic.name) });
}

/** Build-time generated social preview for one localized profile. */
export function ogImagePath(locale: Locale, id: string) {
  return wideImagePath(locale, id);
}

/** A local surface illustration keeps profile pages useful when the 3D scene is not loaded. */
export function entryImagePath(entry: CatalogEntry) {
  return portraitPath(entry.data.id);
}

export function explorerPath(locale: Locale, id?: string) {
  const hash = id ? `#${encodeURIComponent(id)}` : '';
  return `/?lang=${encodeURIComponent(locale)}${hash}`;
}

export function absoluteSiteUrl(path: string) {
  return new URL(path, `${siteOrigin}/`).toString();
}

export function serializeJsonLd(value: object) {
  const serialized = JSON.stringify(value);
  return serialized.replace(
    /[<>&]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function entryLocalizedName(entry: CatalogEntry, locale: Locale) {
  return translator(locale)(entry.data.name);
}

/**
 * The body's names in the other catalogues. The explorer's capitalised labels
 * ("EARTH", "1P / HALLEY") are typography rather than names, so they stay out.
 */
function alternateNames(entry: CatalogEntry, locale: Locale) {
  const name = entryLocalizedName(entry, locale);
  return [
    ...new Set(seoLocales.map((item) => entryLocalizedName(entry, item))),
  ].filter((item) => item !== name);
}

export type Crumb = { name: string; path: string };

/**
 * The pages a profile sits under, outermost first: the collection page, then
 * a moon's own planet. The visible breadcrumb and the structured one both
 * read this, so neither can climb somewhere the other does not.
 */
export function profileAncestors(entry: CatalogEntry, locale: Locale) {
  const t = translator(locale);
  const ancestors: Crumb[] = [
    { name: t('天体档案'), path: bodiesIndexPath(locale) },
  ];
  if (entry.kind === 'moon') {
    const planet = bodies.find((body) => body.id === entry.data.parentId);
    if (planet)
      ancestors.push({
        name: t(planet.name),
        path: bodyDetailsPath(locale, planet.id),
      });
  }
  return ancestors;
}

export type BodiesIndexSection = {
  id: string;
  name: string;
  en: string;
  summary: string;
  /** A moon group names its planet; the other sections hold one group. */
  groups: { planet?: Body; entries: CatalogEntry[] }[];
};

/** The collection page's sections in reading order, moons under their planets. */
export function bodiesIndexSections(): BodiesIndexSection[] {
  const entries = catalogEntries();
  const ofKind = (kind: CatalogEntry['kind']) =>
    entries.filter((entry) => entry.kind === kind);
  const moons = ofKind('moon');
  return [
    {
      id: 'planets',
      name: '太阳、行星与冥王星',
      en: 'Sun, planets and Pluto',
      summary:
        '一颗恒星、八颗行星，以及 2006 年起归入矮行星的冥王星，按与太阳的距离排列。',
      groups: [{ entries: ofKind('body') }],
    },
    {
      id: 'moons',
      name: '卫星',
      en: 'Moons',
      summary:
        '天然卫星绕行星运行。这里按所属行星收录有代表性的卫星，并非完整名录：新的小卫星仍在不断被发现。',
      groups: bodies.flatMap((planet) => {
        const own = moons.filter(
          (entry) => entry.kind === 'moon' && entry.data.parentId === planet.id,
        );
        return own.length ? [{ planet, entries: own }] : [];
      }),
    },
    {
      id: 'asteroids',
      name: '小行星',
      en: 'Asteroids',
      summary:
        '绕太阳运行的岩质小天体：几颗主带中的大型小行星，以及探测器近距离造访过的近地小行星。谷神星是主带中唯一的矮行星。',
      groups: [{ entries: ofKind('asteroid') }],
    },
    {
      id: 'comets',
      name: '彗星',
      en: 'Comets',
      summary:
        '由冰与尘埃组成的小天体。靠近太阳时，受热的彗核释放气体和尘埃，形成彗发与彗尾。',
      groups: [{ entries: ofKind('comet') }],
    },
  ];
}

function profileImageMetadata(
  image: string,
  credit: ReturnType<typeof portraitCredit>,
) {
  return {
    '@type': 'ImageObject',
    contentUrl: image,
    width: 1000,
    height: 1000,
    acquireLicensePage: absoluteSiteUrl(credit.url),
    license: credit.license,
    creator: {
      '@type': 'Organization',
      name: seoSiteName,
      url: siteOrigin,
    },
    copyrightNotice: `Source attribution: ${credit.name}; adapted and rendered by ORBIT.`,
    creditText: `${credit.name}; rendered by ORBIT`,
  };
}

function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': `${siteOrigin}#organization`,
    name: seoSiteName,
    url: siteOrigin,
    logo: {
      '@type': 'ImageObject',
      url: absoluteSiteUrl('/og-image.png'),
    },
  };
}

function websiteNode(locale: Locale) {
  return {
    '@type': 'WebSite',
    '@id': `${siteOrigin}#website`,
    name: seoSiteName,
    url: absoluteSiteUrl('/'),
    publisher: { '@id': `${siteOrigin}#organization` },
    inLanguage: languages[locale].intl,
  };
}

function breadcrumbNode(id: string, trail: { name: string; item: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    '@id': id,
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: step.item,
    })),
  };
}

/** Every catalogue entry is contained in it; the landing page is about it. */
function solarSystemNode(locale: Locale) {
  return {
    '@type': 'Place',
    '@id': `${siteOrigin}#solar-system`,
    name: translator(locale)('太阳系'),
    sameAs: wikidataUrl(solarSystemItem),
  };
}

function propertyValue(property: ProfileProperty, t: Translate) {
  const unit = property.unit && propertyUnits[property.unit];
  return {
    '@type': 'PropertyValue',
    propertyID: property.id,
    name: t(property.label),
    value:
      typeof property.value === 'number' ? property.value : t(property.value),
    ...(unit && { unitCode: unit.code, unitText: unit.symbol }),
  };
}

/** Structured data shared by every crawlable celestial profile. */
export function profileJsonLd({
  entry,
  locale,
  title,
  description,
  canonical,
}: {
  entry: CatalogEntry;
  locale: Locale;
  title: string;
  description: string;
  canonical: string;
}) {
  const t = translator(locale);
  const name = entryLocalizedName(entry, locale);
  const image = absoluteSiteUrl(entryImagePath(entry));
  const organizationId = `${siteOrigin}#organization`;
  const websiteId = `${siteOrigin}#website`;
  const celestialId = `${canonical}#astronomical-body`;
  const webpageId = `${canonical}#webpage`;
  const breadcrumbId = `${canonical}#breadcrumb`;
  const credit = portraitCredit(entry);
  const identity = wikidataEntity(entry.data.id);
  const solarSystem = solarSystemNode(locale);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      websiteNode(locale),
      solarSystem,
      {
        // schema.org has no celestial-body type: `AstronomicalBody` is not in
        // the vocabulary, and a validator discards it together with every
        // `about` that names it. A body is a `Place`; Wikidata says which.
        '@type': 'Place',
        '@id': celestialId,
        additionalType: wikidataUrl(wikidataClasses[identity.class]),
        name,
        alternateName: alternateNames(entry, locale),
        identifier: entry.data.id,
        description,
        image,
        url: canonical,
        sameAs: wikidataUrl(identity.item),
        mainEntityOfPage: { '@id': webpageId },
        containedInPlace: { '@id': solarSystem['@id'] },
        additionalProperty: profileProperties(entry).map((property) =>
          propertyValue(property, t),
        ),
      },
      breadcrumbNode(breadcrumbId, [
        { name: 'ORBIT', item: absoluteSiteUrl('/') },
        ...profileAncestors(entry, locale).map((step) => ({
          name: step.name,
          item: absoluteSiteUrl(step.path),
        })),
        { name, item: canonical },
      ]),
      {
        '@type': 'LearningResource',
        '@id': `${canonical}#learning-resource`,
        url: canonical,
        name: title,
        description,
        learningResourceType: 'interactive astronomy profile',
        educationalLevel: 'Beginner',
        inLanguage: languages[locale].intl,
        provider: { '@id': organizationId },
        author: { '@id': organizationId },
        about: { '@id': celestialId },
        image,
      },
      {
        '@type': 'WebPage',
        '@id': webpageId,
        url: canonical,
        name: title,
        description,
        inLanguage: languages[locale].intl,
        isPartOf: { '@id': websiteId },
        primaryImageOfPage: profileImageMetadata(image, credit),
        about: { '@id': celestialId },
        mainEntity: { '@id': celestialId },
        breadcrumb: { '@id': breadcrumbId },
      },
    ],
  };
}

/** Structured data for the collection page that lists every profile. */
export function bodiesIndexJsonLd({
  locale,
  title,
  description,
  canonical,
}: {
  locale: Locale;
  title: string;
  description: string;
  canonical: string;
}) {
  const t = translator(locale);
  const breadcrumbId = `${canonical}#breadcrumb`;
  const listId = `${canonical}#bodies`;
  const entries = bodiesIndexSections().flatMap((section) =>
    section.groups.flatMap((group) => group.entries),
  );
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      websiteNode(locale),
      breadcrumbNode(breadcrumbId, [
        { name: 'ORBIT', item: absoluteSiteUrl('/') },
        { name: t('天体档案'), item: canonical },
      ]),
      {
        '@type': 'ItemList',
        '@id': listId,
        name: t('天体档案'),
        numberOfItems: entries.length,
        itemListElement: entries.map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: entryLocalizedName(entry, locale),
          url: absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id)),
        })),
      },
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: languages[locale].intl,
        isPartOf: { '@id': `${siteOrigin}#website` },
        mainEntity: { '@id': listId },
        breadcrumb: { '@id': breadcrumbId },
      },
    ],
  };
}

/** Structured data for the interactive observatory landing page. */
export function homeJsonLd() {
  const organizationId = `${siteOrigin}#organization`;
  const websiteId = `${siteOrigin}#website`;
  const description =
    '从太阳到奥尔特云，探索运行中的三维太阳系。调节时间，走近行星，理解我们的宇宙家园。';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: seoSiteName,
        url: absoluteSiteUrl('/'),
        description,
        publisher: { '@id': organizationId },
        inLanguage: seoLocales.map((locale) => languages[locale].intl),
      },
      {
        '@type': 'LearningResource',
        '@id': `${siteOrigin}#learning-resource`,
        name: seoSiteName,
        description,
        url: absoluteSiteUrl('/'),
        learningResourceType: 'interactive astronomy simulation',
        educationalLevel: 'Beginner',
        inLanguage: seoLocales.map((locale) => languages[locale].intl),
        provider: { '@id': organizationId },
        about: solarSystemNode(defaultLocale),
      },
    ],
  };
}

/** The term set both event pages point at, so a topic declares its collection. */
function eventTermSet(locale: Locale) {
  const index = absoluteSiteUrl(eventsIndexPath(locale));
  return {
    '@type': 'DefinedTermSet',
    '@id': `${index}#event-guide`,
    name: eventsIndexTitle(locale),
    url: index,
  };
}

function eventTermNode(topic: EventTopic, locale: Locale, id: string) {
  const t = translator(locale);
  return {
    '@type': 'DefinedTerm',
    '@id': id,
    name: t(topic.name),
    alternateName: topic.en,
    identifier: topic.id,
    termCode: topic.id,
    description: t(topic.summary),
    url: absoluteSiteUrl(eventDetailsPath(locale, topic.id)),
    inDefinedTermSet: {
      '@id': `${absoluteSiteUrl(eventsIndexPath(locale))}#event-guide`,
    },
  };
}

/** Structured data for the sky-event guide index. */
export function eventsIndexJsonLd({
  locale,
  title,
  description,
  canonical,
}: {
  locale: Locale;
  title: string;
  description: string;
  canonical: string;
}) {
  const t = translator(locale);
  const breadcrumbId = `${canonical}#breadcrumb`;
  const termSet = eventTermSet(locale);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      websiteNode(locale),
      breadcrumbNode(breadcrumbId, [
        { name: 'ORBIT', item: absoluteSiteUrl('/') },
        { name: t('天象事件'), item: canonical },
      ]),
      {
        ...termSet,
        description,
        hasDefinedTerm: eventTopics.map((topic) => ({
          '@type': 'DefinedTerm',
          name: t(topic.name),
          alternateName: topic.en,
          termCode: topic.id,
          description: t(topic.summary),
          url: absoluteSiteUrl(eventDetailsPath(locale, topic.id)),
        })),
      },
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: languages[locale].intl,
        isPartOf: { '@id': `${siteOrigin}#website` },
        mainEntity: { '@id': termSet['@id'] },
        breadcrumb: { '@id': breadcrumbId },
      },
    ],
  };
}

/** Structured data for one sky-event topic. */
export function eventJsonLd({
  topic,
  locale,
  title,
  description,
  canonical,
}: {
  topic: EventTopic;
  locale: Locale;
  title: string;
  description: string;
  canonical: string;
}) {
  const t = translator(locale);
  const organizationId = `${siteOrigin}#organization`;
  const termId = `${canonical}#sky-event`;
  const breadcrumbId = `${canonical}#breadcrumb`;
  const image = absoluteSiteUrl('/og-image.png');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      websiteNode(locale),
      eventTermNode(topic, locale, termId),
      breadcrumbNode(breadcrumbId, [
        { name: 'ORBIT', item: absoluteSiteUrl('/') },
        { name: t('天象事件'), item: absoluteSiteUrl(eventsIndexPath(locale)) },
        { name: t(topic.name), item: canonical },
      ]),
      {
        '@type': 'LearningResource',
        '@id': `${canonical}#learning-resource`,
        url: canonical,
        name: title,
        description,
        learningResourceType: 'sky event guide',
        educationalLevel: 'Beginner',
        inLanguage: languages[locale].intl,
        provider: { '@id': organizationId },
        author: { '@id': organizationId },
        about: { '@id': termId },
        teaches: t(eventCategory(topic.category).name),
        image,
      },
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: languages[locale].intl,
        isPartOf: { '@id': `${siteOrigin}#website` },
        about: { '@id': termId },
        breadcrumb: { '@id': breadcrumbId },
      },
    ],
  };
}
