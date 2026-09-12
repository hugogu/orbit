import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { absoluteSiteUrl, bodyDetailsPath, catalogEntries, seoLocales } from '../lib/seo';

const publicDir = resolve('public');
mkdirSync(publicDir, { recursive: true });
const entries = catalogEntries();

const sitemapUrls = [
  absoluteSiteUrl('/'),
  ...seoLocales.flatMap((locale) =>
    entries.map((entry) => absoluteSiteUrl(bodyDetailsPath(locale, entry.data.id))),
  ),
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapUrls.map((url) => `  <url><loc>${url}</loc></url>`),
  '</urlset>',
  '',
].join('\n');

const robots = [
  'User-agent: *',
  'Allow: /',
  `Sitemap: ${absoluteSiteUrl('/sitemap.xml')}`,
  '',
].join('\n');

writeFileSync(resolve(publicDir, 'sitemap.xml'), sitemap);
writeFileSync(resolve(publicDir, 'robots.txt'), robots);
