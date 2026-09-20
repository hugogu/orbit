import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  absoluteSiteUrl,
  eventDetailsPath,
  eventsIndexPath,
  eventsIndexTitle,
  eventTitle,
  seoLocales,
} from '../lib/seo';
import { eventTopics } from '../lib/event-guide';
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
const hasRel = (attributes: ReadonlyMap<string, string>, rel: string) =>
  (attributes.get('rel') ?? '')
    .split(/\s+/)
    .some((value) => value.toLowerCase() === rel);

/** One exported document, with the parts every page of the guide must carry. */
function documentAt(path: string) {
  const html = readFileSync(output(`${path}.html`), 'utf8');
  const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0] ?? '';
  const graph = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
  )['@graph'] as Array<Record<string, unknown>>;
  return {
    html,
    graph,
    htmlTag: htmlTagAttributes(html, 'html')[0],
    links: htmlTagAttributes(head, 'link'),
    head,
  };
}

function checkShell(
  path: string,
  page: ReturnType<typeof documentAt>,
  locale: (typeof seoLocales)[number],
  title: string,
  alternates: (item: (typeof seoLocales)[number]) => string,
) {
  assert.equal(page.htmlTag?.get('lang'), languages[locale].intl, path);
  assert.ok(
    page.head.includes(`<title>${escapeHtml(title)} | ORBIT</title>`),
    path,
  );
  assert.equal((page.html.match(/<h1\b/g) ?? []).length, 1, path);
  assert.ok(
    page.links.some(
      (attributes) =>
        hasRel(attributes, 'canonical') &&
        attributes.get('href') === absoluteSiteUrl(path),
    ),
    path,
  );
  for (const item of [...seoLocales, 'x-default' as const]) {
    const hreflang = item === 'x-default' ? 'x-default' : languages[item].intl;
    const href = absoluteSiteUrl(
      alternates(item === 'x-default' ? 'zh-CN' : item),
    );
    assert.ok(
      page.links.some(
        (attributes) =>
          hasRel(attributes, 'alternate') &&
          attributes.get('hreflang') === hreflang &&
          attributes.get('href') === href,
      ),
      `${path}: ${hreflang}`,
    );
  }
}

for (const locale of seoLocales) {
  const t = translator(locale);
  const indexPath = eventsIndexPath(locale);
  const index = documentAt(indexPath);
  checkShell(
    indexPath,
    index,
    locale,
    eventsIndexTitle(locale),
    eventsIndexPath,
  );
  const termSet = index.graph.find(
    (node) => node['@type'] === 'DefinedTermSet',
  )!;
  const terms = termSet.hasDefinedTerm as Array<Record<string, string>>;
  assert.equal(terms.length, eventTopics.length, indexPath);

  for (const topic of eventTopics) {
    const path = eventDetailsPath(locale, topic.id);
    // Every topic is reachable from the index, in this locale's own URLs.
    assert.ok(
      index.html.includes(`href="${path}"`),
      `${indexPath}: ${topic.id}`,
    );
    assert.ok(
      terms.some((term) => term.url === absoluteSiteUrl(path)),
      `${indexPath}: ${topic.id}`,
    );

    const page = documentAt(path);
    checkShell(path, page, locale, eventTitle(topic, locale), (item) =>
      eventDetailsPath(item, topic.id),
    );
    assert.ok(page.html.includes(escapeHtml(t(topic.intro))), path);
    assert.ok(page.html.includes(escapeHtml(t(topic.observing[0]))), path);
    for (const source of topic.sources)
      assert.ok(page.html.includes(source.url), `${path}: ${source.url}`);
    // The breadcrumb ancestor is the guide index, never the topic itself.
    const trail = page.graph.find((node) => node['@type'] === 'BreadcrumbList')!
      .itemListElement as Array<Record<string, string>>;
    assert.deepEqual(
      trail.map((step) => step.item),
      [absoluteSiteUrl('/'), absoluteSiteUrl(indexPath), absoluteSiteUrl(path)],
      path,
    );
    const term = page.graph.find((node) => node['@type'] === 'DefinedTerm')!;
    assert.equal(term.termCode, topic.id, path);
  }
}

console.log(
  `Verified ${(eventTopics.length + 1) * seoLocales.length} exported sky-event pages: localized copy, titles, canonical links, hreflang, sources and structured data.`,
);
