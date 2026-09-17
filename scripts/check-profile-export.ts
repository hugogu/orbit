import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp/lib/index.js';
import {
  absoluteSiteUrl,
  bodyDetailsPath,
  catalogEntries,
  entryImagePath,
  ogImagePath,
  profileTitle,
  seoSiteName,
  seoLocales,
  siteOrigin,
} from '../lib/seo';
import { squareImagePath, portraitCredit } from '../lib/profile-images';
import { profileContent } from '../lib/profile-content';
import { languages, translator } from '../lib/i18n';
import { htmlTagAttributes } from './lib/html-tags';

const output = (path: string) =>
  resolve('dist/client', path.replace(/^\//, ''));
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      })[c]!,
  );
const entries = catalogEntries();
const hasRel = (attributes: ReadonlyMap<string, string>, rel: string) =>
  (attributes.get('rel') ?? '')
    .split(/\s+/)
    .some((value) => value.toLowerCase() === rel);
for (const entry of entries) {
  const credit = portraitCredit(entry);
  for (const [path, size] of [
    [entryImagePath(entry), 1000],
    [squareImagePath(entry.data.id), 600],
  ] as const) {
    const image = await sharp(output(path)).metadata();
    assert.equal(image.width, size, path);
    assert.equal(image.height, size, path);
    assert.ok(image.xmp?.toString().includes(credit.license), path);
  }
  for (const locale of seoLocales) {
    const path = bodyDetailsPath(locale, entry.data.id);
    const html = readFileSync(output(`${path}.html`), 'utf8');
    const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0] ?? '';
    const [htmlTag] = htmlTagAttributes(html, 'html');
    const linkTags = htmlTagAttributes(head, 'link');
    const metaTags = htmlTagAttributes(head, 'meta');
    assert.ok(
      linkTags.some(
        (attributes) =>
          hasRel(attributes, 'manifest') &&
          attributes.get('href') === '/manifest.webmanifest',
      ),
      `PWA manifest: ${path}`,
    );
    assert.ok(
      linkTags.some(
        (attributes) =>
          hasRel(attributes, 'apple-touch-icon') &&
          attributes.get('href') === '/icons/apple-touch-icon.png',
      ),
      `Apple touch icon: ${path}`,
    );
    assert.ok(
      metaTags.some(
        (attributes) =>
          attributes.get('name') === 'theme-color' &&
          attributes.get('content') === '#080d16',
      ),
      `PWA theme color: ${path}`,
    );
    const t = translator(locale);
    assert.equal(htmlTag?.get('lang'), languages[locale].intl, path);
    assert.ok(
      head.includes(
        `<title>${escapeHtml(profileTitle(entry, locale))} | ORBIT</title>`,
      ),
      path,
    );
    assert.ok(
      linkTags.some(
        (attributes) =>
          hasRel(attributes, 'canonical') &&
          attributes.get('href') === absoluteSiteUrl(path),
      ),
      path,
    );
    for (const alternate of seoLocales) {
      assert.ok(
        linkTags.some(
          (attributes) =>
            hasRel(attributes, 'alternate') &&
            attributes.get('hreflang') === languages[alternate].intl &&
            attributes.get('href') ===
              absoluteSiteUrl(bodyDetailsPath(alternate, entry.data.id)),
        ),
        path,
      );
    }
    const ogTags = metaTags.filter((attributes) =>
      (attributes.get('property') ?? '').toLowerCase().startsWith('og:image'),
    );
    assert.equal(
      ogTags
        .find(
          (attributes) =>
            attributes.get('property')?.toLowerCase() === 'og:image',
        )
        ?.get('content'),
      absoluteSiteUrl(squareImagePath(entry.data.id)),
      path,
    );
    assert.ok(
      ogTags.some(
        (attributes) =>
          attributes.get('property')?.toLowerCase() === 'og:image:width' &&
          attributes.get('content') === '600',
      ),
      path,
    );
    assert.ok(
      ogTags.some(
        (attributes) =>
          attributes.get('property')?.toLowerCase() === 'og:image:width' &&
          attributes.get('content') === '1200',
      ),
      path,
    );
    assert.ok(
      ogTags.some(
        (attributes) =>
          attributes.get('property')?.toLowerCase() === 'og:image:alt',
      ),
      path,
    );
    assert.ok(
      metaTags.some(
        (attributes) =>
          attributes.get('name')?.toLowerCase() === 'twitter:card' &&
          attributes.get('content') === 'summary_large_image',
      ),
      path,
    );
    assert.ok(
      metaTags.some(
        (attributes) =>
          attributes.get('name')?.toLowerCase() === 'twitter:image' &&
          attributes.get('content') ===
            absoluteSiteUrl(ogImagePath(locale, entry.data.id)),
      ),
      path,
    );
    assert.ok(
      html.includes(escapeHtml(t(profileContent[entry.data.id].intro))),
      path,
    );
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, path);
    const hero =
      html.match(/<figure class="seo-hero">[\s\S]*?<\/figure>/)?.[0] ?? '';
    assert.ok(hero.includes(entryImagePath(entry)), path);
    assert.ok(!hero.includes('/textures/'), path);
    assert.ok(!html.includes('透明说明假设'), path);
    const graph = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )![1],
    )['@graph'];
    const webpage = graph.find(
      (node: Record<string, unknown>) => node['@type'] === 'WebPage',
    );
    const primaryImage = webpage.primaryImageOfPage as Record<string, unknown>;
    assert.equal(primaryImage.license, credit.license, path);
    assert.equal(
      primaryImage.acquireLicensePage,
      new URL(credit.url, `${siteOrigin}/`).toString(),
      path,
    );
    assert.deepEqual(
      primaryImage.creator,
      {
        '@type': 'Organization',
        name: seoSiteName,
        url: siteOrigin,
      },
      path,
    );
    assert.match(String(primaryImage.copyrightNotice), /Source attribution/);
    assert.equal(
      primaryImage.creditText,
      `${credit.name}; rendered by ORBIT`,
      path,
    );
    assert.equal(
      primaryImage.contentUrl,
      absoluteSiteUrl(entryImagePath(entry)),
      path,
    );
    const image = await sharp(
      output(ogImagePath(locale, entry.data.id)),
    ).metadata();
    assert.equal(image.width, 1200, path);
    assert.equal(image.height, 630, path);
    assert.ok(image.xmp?.toString().includes(credit.license), path);
  }
}
console.log(
  `Verified ${entries.length * seoLocales.length} exported profiles: rendered images, localized copy, metadata, hreflang, canonical links and attribution.`,
);
