import { comets, type Comet } from './comets';
import { languages, localePath, translator, type Locale } from './i18n';
import { orbitingMoons, type OrbitingMoon } from './moon-orbits';
import { bodies, type Body } from './solar';
import { texturePath } from './texture-quality';

const fallbackSiteOrigin = 'https://orbit-henna-xi.vercel.app';

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
 * Override this during a production build so canonical and sitemap URLs use
 * the permanent public hostname instead of the demo deployment. This helper
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
  | { kind: 'comet'; data: Comet };

export function catalogEntries(): CatalogEntry[] {
  return [
    ...bodies.map((data) => ({ kind: 'body' as const, data })),
    ...orbitingMoons.map((data) => ({ kind: 'moon' as const, data })),
    ...comets.map((data) => ({ kind: 'comet' as const, data })),
  ];
}

export function catalogEntry(id: string): CatalogEntry | undefined {
  return catalogEntries().find((entry) => entry.data.id === id);
}

export function bodyDetailsPath(locale: Locale, id: string) {
  return `/${localePath(locale)}/bodies/${encodeURIComponent(id)}`;
}

/** Build-time generated social preview for one localized profile. */
export function ogImagePath(locale: Locale, id: string) {
  return `/og/${localePath(locale)}/bodies/${encodeURIComponent(id)}.png`;
}

/** A local surface illustration keeps profile pages useful when the 3D scene is not loaded. */
export function entryImagePath(entry: CatalogEntry) {
  const texture =
    entry.kind === 'body'
      ? entry.data.texture ?? entry.data.id
      : entry.kind === 'moon'
        ? entry.data.texture
        : 'comet_nucleus';
  return texturePath(texture, false, 2048);
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
  return serialized.replace(/[<>&]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function entryLocalizedName(entry: CatalogEntry, locale: Locale) {
  return translator(locale)(entry.data.name);
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
  const breadcrumbId = `${canonical}#breadcrumb`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'ORBIT · Solar System Observatory',
        url: siteOrigin,
        logo: {
          '@type': 'ImageObject',
          url: absoluteSiteUrl('/og-image.png'),
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: t('ORBIT · 太阳系漫游'),
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
            name: t('太阳系知识'),
            item: absoluteSiteUrl(explorerPath(locale)),
          },
          {
            '@type': 'ListItem',
            position: 3,
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
        educationalLevel: 'general audience',
        inLanguage: languages[locale].intl,
        provider: { '@id': organizationId },
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
        primaryImageOfPage: { '@type': 'ImageObject', url: image },
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
        name: 'ORBIT · Solar System Observatory',
        url: siteOrigin,
        logo: { '@type': 'ImageObject', url: absoluteSiteUrl('/og-image.png') },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: 'ORBIT · Solar System Observatory',
        url: absoluteSiteUrl('/'),
        description,
        publisher: { '@id': organizationId },
        inLanguage: seoLocales.map((locale) => languages[locale].intl),
      },
      {
        '@type': 'LearningResource',
        '@id': `${siteOrigin}#learning-resource`,
        name: 'ORBIT · Solar System Observatory',
        description,
        url: absoluteSiteUrl('/'),
        learningResourceType: 'interactive astronomy simulation',
        educationalLevel: 'general audience',
        inLanguage: seoLocales.map((locale) => languages[locale].intl),
        provider: { '@id': organizationId },
        about: { '@type': 'AstronomicalBody', name: 'Solar System' },
      },
    ],
  };
}
