import {
  absoluteSiteUrl,
  bodiesIndexPath,
  bodyDetailsPath,
  catalogEntries,
  entryImagePath,
  eventDetailsPath,
  eventsIndexPath,
  seoLocales,
  type CatalogEntry,
} from './seo';
import { eventTopics } from './event-guide';
import { defaultLocale, languages, type Locale } from './i18n';

export type SitemapAlternate = {
  hreflang: string;
  href: string;
};

export type SitemapEntry = {
  loc: string;
  alternates?: SitemapAlternate[];
  images?: string[];
};

/** One crawlable document, addressed by the locale it is rendered in. */
type LocalizedRoute = (locale: Locale) => string;

/**
 * A route plus the content image Google should associate with it. Listing it
 * here hands Googlebot the image directly instead of leaving discovery to an
 * ordinary crawl, which otherwise lags page indexing by weeks on a new site.
 */
type RouteSpec = {
  route: LocalizedRoute;
  images?: string[];
};

function alternateLinks(route: LocalizedRoute): SitemapAlternate[] {
  return [
    ...seoLocales.map((locale) => ({
      hreflang: languages[locale].intl,
      href: absoluteSiteUrl(route(locale)),
    })),
    {
      hreflang: 'x-default',
      href: absoluteSiteUrl(route(defaultLocale)),
    },
  ];
}

function routeSpecs(entries: CatalogEntry[]): RouteSpec[] {
  return [
    { route: bodiesIndexPath },
    ...entries.map(
      (entry): RouteSpec => ({
        route: (locale) => bodyDetailsPath(locale, entry.data.id),
        images: [absoluteSiteUrl(entryImagePath(entry))],
      }),
    ),
    { route: eventsIndexPath },
    ...eventTopics.map(
      (topic): RouteSpec => ({
        route: (locale) => eventDetailsPath(locale, topic.id),
      }),
    ),
  ];
}

export function sitemapEntries(
  entries: CatalogEntry[] = catalogEntries(),
): SitemapEntry[] {
  // Each route's reciprocal hreflang set and image are the same in every
  // locale, so they are built once and shared by that route's localized URLs.
  const routes = routeSpecs(entries).map((spec) => ({
    ...spec,
    alternates: alternateLinks(spec.route),
  }));
  return [
    { loc: absoluteSiteUrl('/') },
    ...seoLocales.flatMap((locale) =>
      routes.map(({ route, alternates, images }) => ({
        loc: absoluteSiteUrl(route(locale)),
        alternates,
        ...(images && { images }),
      })),
    ),
  ];
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return entities[character];
  });
}

export function renderSitemap(entries: CatalogEntry[] = catalogEntries()) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...sitemapEntries(entries).flatMap(({ loc, alternates, images }) => [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      ...(alternates ?? []).map(
        ({ hreflang, href }) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`,
      ),
      ...(images ?? []).map(
        (image) =>
          `    <image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`,
      ),
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n');
}
