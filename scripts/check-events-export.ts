import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  absoluteSiteUrl,
  eventDetailsPath,
  eventAction,
  eventPlanetPlannerTab,
  occurrenceTitle,
  occurrenceName,
  occurrenceSkyCaption,
  eventsIndexPath,
  eventsIndexTitle,
  eventTitle,
  seoLocales,
  seoSiteName,
} from '../lib/seo';
import { eventTopics } from '../lib/event-guide';
import {
  eventOccurrences,
  occurrenceImagePath,
} from '../lib/event-occurrences';
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

const deployment = JSON.parse(readFileSync('vercel.json', 'utf8'));
assert.ok(
  deployment.redirects.some(
    (rule: { source: string; destination: string; permanent: boolean }) =>
      rule.source === '/:locale/events/saturn-opposition' &&
      rule.destination === `/:locale/events/${eventOccurrences[0].id}` &&
      rule.permanent,
  ),
  'legacy Saturn URL redirects to its dated edition',
);

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
    page.head.includes(`<title>${escapeHtml(title)} | ${seoSiteName}</title>`),
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

const sitemap = readFileSync(output('/sitemap.xml'), 'utf8');
assert.ok(sitemap.includes('</urlset>'), 'exported sitemap is complete');
const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
  (match) => match[1],
);

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
  for (const event of eventOccurrences) {
    assert.ok(
      !index.html.includes(`href="${eventDetailsPath(locale, event.id)}"`),
      `${indexPath}: occurrences are not concepts`,
    );
    const path = eventDetailsPath(locale, event.id);
    const entries = sitemapEntries.filter((entry) =>
      entry.includes(`<loc>${absoluteSiteUrl(path)}</loc>`),
    );
    assert.equal(entries.length, 1, `${path}: exported sitemap entry`);
    assert.ok(
      entries[0].includes(absoluteSiteUrl(occurrenceImagePath(event, locale))),
      `${path}: sitemap chart`,
    );
    for (const alternate of seoLocales)
      assert.ok(
        entries[0].includes(
          `href="${absoluteSiteUrl(eventDetailsPath(alternate, event.id))}"`,
        ),
        `${path}: sitemap alternate ${alternate}`,
      );
    const page = documentAt(path);
    checkShell(path, page, locale, occurrenceTitle(event, locale), (item) =>
      eventDetailsPath(item, event.id),
    );
    assert.ok(
      page.html.includes(escapeHtml(occurrenceName(event, locale))),
      path,
    );
    assert.ok(
      page.html.includes(escapeHtml(occurrenceSkyCaption(event, locale))),
      path,
    );
    const image = occurrenceImagePath(event, locale);
    assert.ok(page.html.includes(`src="${image}"`), `${path}: sky chart`);
    assert.ok(
      readFileSync(output(image)).byteLength > 10_000,
      `${path}: generated chart`,
    );
    assert.ok(
      page.head.includes(absoluteSiteUrl(image)),
      `${path}: social chart`,
    );
    assert.ok(
      page.html.includes(`href="${eventDetailsPath(locale, event.concept)}"`),
      `${path}: parent concept`,
    );
    assert.ok(
      !page.graph.some((node) => node['@type'] === 'DefinedTerm'),
      `${path}: dated article, not a concept`,
    );
    const article = page.graph.find((node) => node['@type'] === 'Article');
    assert.equal(
      article?.temporalCoverage,
      new Date(event.peak).toISOString(),
      path,
    );
    assert.ok(
      page.graph.some((node) => node['@type'] === 'ImageObject'),
      path,
    );
  }

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
    const dataNote = eventPlanetPlannerTab(topic)
      ? '周期是长期平均值，具体事件日期由近期天象按模拟时间独立计算；几何时刻与当地最佳观测时段并不相同。'
      : '活跃期、极大日期与出现率为多年平均值，实际情况每年略有差别；计划观测时请以当年的预报为准。';
    assert.ok(
      page.html.includes(escapeHtml(t(dataNote))),
      `${path}: data note`,
    );
    const action = page.html.match(
      /<a class="seo-primary-action" href="([^"]+)">([^<]+)<\/a>/,
    );
    assert.ok(action, `${path}: primary action`);
    assert.equal(
      action[1],
      escapeHtml(eventAction(topic, locale).path),
      `${path}: primary action URL`,
    );
    assert.equal(
      action[2],
      escapeHtml(t(eventAction(topic, locale).label)),
      `${path}: primary action label`,
    );
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
  `Verified ${(eventTopics.length + eventOccurrences.length + 1) * seoLocales.length} exported sky-event pages: concepts, dated forecasts, charts, sitemap entries, localized copy, canonical links, hreflang and structured data.`,
);
