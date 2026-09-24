import {
  absoluteSiteUrl,
  bodiesIndexPath,
  bodyDetailsPath,
  catalogEntries,
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
};

/** One crawlable document, addressed by the locale it is rendered in. */
type LocalizedRoute = (locale: Locale) => string;

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

function localizedRoutes(entries: CatalogEntry[]): LocalizedRoute[] {
  return [
    bodiesIndexPath,
    ...entries.map(
      (entry): LocalizedRoute =>
        (locale) =>
          bodyDetailsPath(locale, entry.data.id),
    ),
    eventsIndexPath,
    ...eventTopics.map(
      (topic): LocalizedRoute =>
        (locale) =>
          eventDetailsPath(locale, topic.id),
    ),
  ];
}

export function sitemapEntries(
  entries: CatalogEntry[] = catalogEntries(),
): SitemapEntry[] {
  // Each route's reciprocal hreflang set is the same in every locale, so it is
  // built once and shared by that route's localized URLs.
  const routes = localizedRoutes(entries).map((route) => ({
    route,
    alternates: alternateLinks(route),
  }));
  return [
    { loc: absoluteSiteUrl('/') },
    ...seoLocales.flatMap((locale) =>
      routes.map(({ route, alternates }) => ({
        loc: absoluteSiteUrl(route(locale)),
        alternates,
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
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...sitemapEntries(entries).flatMap(({ loc, alternates }) => [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      ...(alternates ?? []).map(
        ({ hreflang, href }) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`,
      ),
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n');
}
