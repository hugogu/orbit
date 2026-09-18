import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { absoluteSiteUrl, catalogEntries, seoLocales } from '../lib/seo';
import { squareImagePath, wideImagePath } from '../lib/profile-images';
import { sharePath } from '../lib/share-view';
import { languages, translator } from '../lib/i18n';
import { htmlTagAttributes } from './lib/html-tags';

const output = (path: string) =>
  resolve('dist/client', `${path.replace(/^\//, '')}.html`);
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      })[character]!,
  );
const entries = catalogEntries();
let checked = 0;
for (const locale of seoLocales) {
  const t = translator(locale);
  const intl = languages[locale].intl;
  for (const entry of [null, ...entries]) {
    const path = sharePath(locale, entry?.data.id ?? null);
    const html = readFileSync(output(path), 'utf8');
    const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0] ?? '';
    const [htmlTag] = htmlTagAttributes(html, 'html');
    const metaTags = htmlTagAttributes(head, 'meta');
    const linkTags = htmlTagAttributes(head, 'link');
    const content = (property: string) =>
      metaTags
        .filter(
          (attributes) =>
            attributes.get('property')?.toLowerCase() === property,
        )
        .map((attributes) => attributes.get('content'));
    const name = entry ? t(entry.data.name) : t('太阳系');
    assert.equal(htmlTag?.get('lang'), intl, path);
    // The card names the body being observed, without the link's details.
    assert.ok(
      head.includes(`<title>${escapeHtml(name)} | ORBIT</title>`),
      path,
    );
    assert.deepEqual(content('og:title'), [escapeHtml(name)], path);
    // Clients crop og:image differently, so the subject-first square leads.
    assert.deepEqual(
      content('og:image'),
      entry
        ? [
            absoluteSiteUrl(squareImagePath(entry.data.id)),
            absoluteSiteUrl(wideImagePath(locale, entry.data.id)),
          ]
        : [absoluteSiteUrl('/og-image.png')],
      path,
    );
    assert.deepEqual(
      metaTags
        .filter(
          (attributes) =>
            attributes.get('name')?.toLowerCase() === 'twitter:image',
        )
        .map((attributes) => attributes.get('content')),
      [
        entry
          ? absoluteSiteUrl(wideImagePath(locale, entry.data.id))
          : absoluteSiteUrl('/og-image.png'),
      ],
      path,
    );
    // Neither may be present: a crawler would rewrite the posted link to it and
    // drop the observed moment the link carries in its query string.
    assert.deepEqual(content('og:url'), [], path);
    assert.ok(
      !linkTags.some((attributes) =>
        (attributes.get('rel') ?? '')
          .split(/\s+/)
          .some((value) => value.toLowerCase() === 'canonical'),
      ),
      path,
    );
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, path);
    checked++;
  }
}
console.log(
  `Verified ${checked} exported share landing pages: localized titles, matching social cards and link-preserving metadata.`,
);
