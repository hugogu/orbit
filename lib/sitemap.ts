import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  seoLocales,
  type CatalogEntry,
} from './seo';
import { defaultLocale, languages } from './i18n';

export type SitemapAlternate = {
  hreflang: string;
  href: string;
};

export type SitemapEntry = {
  loc: string;
  alternates?: SitemapAlternate[];
};

function alternateLinks(entry: CatalogEntry): SitemapAlternate[] {
  return [
    ...seoLocales.map((locale) => ({
      hreflang: languages[locale].intl,
      href: absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id)),
    })),
    {
      hreflang: 'x-default',
      href: absoluteSiteUrl(bodyDetailsPath(defaultLocale, entry.data.id)),
    },
  ];
}

export function sitemapEntries(entries: CatalogEntry[] = catalogEntries()): SitemapEntry[] {
  return [
    { loc: absoluteSiteUrl('/') },
    ...seoLocales.flatMap((locale) =>
      entries.map((entry) => ({
        loc: absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id)),
        alternates: alternateLinks(entry),
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
