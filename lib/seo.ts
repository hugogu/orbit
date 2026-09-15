import { comets, type Comet } from './comets';
import { asteroids, type Asteroid } from './asteroids';
import { languages, localePath, translator, type Locale } from './i18n';
import { orbitingMoons, type OrbitingMoon } from './moon-orbits';
import { bodies, type Body } from './solar';
import { portraitPath, wideImagePath, portraitCredit } from './profile-images';

/** Permanent public origin used when a build does not provide an override. */
const fallbackSiteOrigin = 'https://www.orbits.observer';

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

export function profileTitle(entry: CatalogEntry, locale: Locale) {
  const t = translator(locale);
  return t('{{name}}：结构、轨道与探索', { name: t(entry.data.name) });
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
  const name = entryLocalizedName(entry, locale);
  const image = absoluteSiteUrl(entryImagePath(entry));
  const organizationId = `${siteOrigin}#organization`;
  const websiteId = `${siteOrigin}#website`;
  const celestialId = `${canonical}#astronomical-body`;
  const breadcrumbId = `${canonical}#breadcrumb`;
  const credit = portraitCredit(entry);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: seoSiteName,
        url: siteOrigin,
        logo: {
          '@type': 'ImageObject',
          url: absoluteSiteUrl('/og-image.png'),
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: seoSiteName,
        url: absoluteSiteUrl('/'),
        publisher: { '@id': organizationId },
        inLanguage: languages[locale].intl,
      },
      {
        '@type': 'AstronomicalBody',
        '@id': celestialId,
        name,
        alternateName: entry.data.en,
        identifier: entry.data.id,
        description,
        image,
        url: canonical,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': breadcrumbId,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'ORBIT',
            item: absoluteSiteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name,
            item: canonical,
          },
        ],
      },
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
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: languages[locale].intl,
        isPartOf: { '@id': websiteId },
        primaryImageOfPage: profileImageMetadata(image, credit),
        about: { '@id': celestialId },
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
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: seoSiteName,
        url: siteOrigin,
        logo: { '@type': 'ImageObject', url: absoluteSiteUrl('/og-image.png') },
      },
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
        about: { '@type': 'AstronomicalBody', name: 'Solar System' },
      },
    ],
  };
}
