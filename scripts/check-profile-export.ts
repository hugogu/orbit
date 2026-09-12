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
  seoLocales,
} from '../lib/seo';
import { squareImagePath, portraitCredit } from '../lib/profile-images';
import { profileContent } from '../lib/profile-content';
import { languages, translator } from '../lib/i18n';

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
    const head = html.split('</head>')[0];
    const t = translator(locale);
    assert.ok(head.includes(`<html lang="${languages[locale].intl}"`), path);
    assert.ok(
      head.includes(
          `<title>${escapeHtml(profileTitle(entry, locale))} | ORBIT</title>`,
      ),
      path,
    );
    assert.ok(
      head.includes(`rel="canonical" href="${absoluteSiteUrl(path)}"`),
      path,
    );
    for (const alternate of seoLocales) {
      assert.ok(
        head.includes(
          `hrefLang="${languages[alternate].intl}" href="${absoluteSiteUrl(bodyDetailsPath(alternate, entry.data.id))}"`,
        ),
        path,
      );
    }
    const ogTags = [
      ...head.matchAll(/<meta property="og:image(?::[^"]+)?"[^>]*>/g),
    ].map((m) => m[0]);
    assert.ok(
      ogTags[0].includes(absoluteSiteUrl(squareImagePath(entry.data.id))),
      path,
    );
    assert.ok(
      ogTags.some(
        (tag) => tag.includes('og:image:width') && tag.includes('600'),
      ),
      path,
    );
    assert.ok(
      ogTags.some(
        (tag) => tag.includes('og:image:width') && tag.includes('1200'),
      ),
      path,
    );
    assert.ok(
      ogTags.some((tag) => tag.includes('og:image:alt')),
      path,
    );
    assert.ok(
      head.includes('name="twitter:card" content="summary_large_image"'),
      path,
    );
    assert.ok(
      head.includes(
        `name="twitter:image" content="${absoluteSiteUrl(ogImagePath(locale, entry.data.id))}"`,
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
    assert.equal(webpage.primaryImageOfPage.license, credit.license, path);
    assert.equal(
      webpage.primaryImageOfPage.contentUrl,
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
