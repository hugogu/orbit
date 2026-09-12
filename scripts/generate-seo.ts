import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { absoluteSiteUrl } from '../lib/seo';
import { renderSitemap } from '../lib/sitemap';

const publicDir = resolve('public');
mkdirSync(publicDir, { recursive: true });

const robots = [
  'User-agent: *',
  'Allow: /',
  `Sitemap: ${absoluteSiteUrl('/sitemap.xml')}`,
  '',
].join('\n');

writeFileSync(resolve(publicDir, 'sitemap.xml'), renderSitemap());
writeFileSync(resolve(publicDir, 'robots.txt'), robots);
