import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decodeShareView,
  defaultShareView,
  encodeShareView,
  explorerHref,
  hasShareView,
  isShareableBody,
  shareDateLabel,
  shareMomentLabel,
  sharePath,
  shareSubjectName,
  withoutShareView,
  type ShareView,
} from '../lib/share-view';
import { shareImageSize } from '../lib/share-image';
import { MAX_TIME, MIN_TIME } from '../lib/simulation-time';
import { catalogEntries, seoLocales } from '../lib/seo';
import { localePath, translator } from '../lib/i18n';
import { regions, speeds } from '../lib/solar';

const moment = Date.UTC(2026, 8, 18, 12, 34, 56);
const base: ShareView = { ...defaultShareView, time: moment };
const roundTrip = (view: ShareView) =>
  decodeShareView(encodeShareView(view), view.selected);

void test('a shared view survives the round trip through a link', () => {
  for (const view of [
    base,
    { ...base, selected: 'saturn', paused: true, speedIndex: 4, top: true },
    { ...base, selected: 'moon-titan', speedIndex: speeds.length - 1 },
    { ...base, selected: 'halley', cometClose: true },
    { ...base, selected: 'halley', cometClose: false },
    { ...base, selected: 'bennu' },
    { ...base, region: 'kuiper', view: 275 },
    { ...base, view: 510, top: true },
    {
      ...base,
      selected: 'earth',
      camera: { azimuth: -1.2345, polar: 1.0472, zoom: 0.3125 },
    },
    {
      ...base,
      camera: { azimuth: 3.1416, polar: 0.0001, zoom: 12.5 },
    },
  ] as ShareView[])
    assert.deepEqual(roundTrip(view), view, JSON.stringify(view));
});

void test('a shared pose is rounded only far below what an eye can see', () => {
  const camera = { azimuth: Math.PI, polar: 2 / 3, zoom: 1 / 3 };
  const restored = roundTrip({ ...base, selected: 'earth', camera }).camera!;
  // Under a thousandth of a degree, and under a thousandth of the framing
  // distance, so the recipient cannot tell the link apart from the capture.
  assert.ok(Math.abs(restored.azimuth - camera.azimuth) < 1e-4);
  assert.ok(Math.abs(restored.polar - camera.polar) < 1e-4);
  assert.ok(Math.abs(restored.zoom - camera.zoom) < 1e-4);
});

void test('links stay short by omitting everything already at its default', () => {
  assert.equal(
    encodeShareView(base).toString(),
    't=2026-09-18T12%3A34%3A56.000Z',
  );
  const params = encodeShareView({ ...base, selected: 'mars', view: 400 });
  // An overview distance means nothing while a body is followed.
  assert.equal(params.get('v'), null);
  assert.equal(params.get('cc'), null);
  assert.equal(encodeShareView({ ...base, selected: 'encke' }).get('cc'), '0');
  assert.equal(encodeShareView(base).get('c'), null);
  assert.equal(
    encodeShareView({
      ...base,
      camera: { azimuth: 0.123456789, polar: 1.5, zoom: 2 },
    }).get('c'),
    '0.1235,1.5,2',
  );
});

void test('a hand-edited or truncated link falls back to the defaults', () => {
  const decoded = decodeShareView(
    new URLSearchParams({
      t: 'not-a-date',
      s: '999',
      v: '-4',
      r: 'atlantis',
      p: 'yes',
      top: 'true',
    }),
    'not-a-body',
  );
  assert.deepEqual(decoded, defaultShareView);
  assert.equal(
    decodeShareView(new URLSearchParams({ t: '1200-01-01T00:00:00Z' })).time,
    defaultShareView.time,
  );
  assert.equal(
    decodeShareView(new URLSearchParams({ t: '2400-01-01T00:00:00Z' })).time,
    defaultShareView.time,
  );
  for (const edge of [MIN_TIME, MAX_TIME])
    assert.equal(
      decodeShareView(new URLSearchParams({ t: new Date(edge).toISOString() }))
        .time,
      edge,
    );
  // A region only applies to the structure tour, which follows no body.
  assert.equal(
    decodeShareView(new URLSearchParams({ r: 'kuiper' }), 'saturn').region,
    null,
  );
  // An unusable pose falls back to the scene's own framing rather than
  // pointing the camera at nothing.
  for (const c of [
    '1,2',
    '1,2,3,4',
    'a,b,c',
    '99,1,1',
    '1,-0.5,1',
    '1,4,1',
    '1,1,0',
    '1,1,900',
    '',
  ])
    assert.equal(decodeShareView(new URLSearchParams({ c })).camera, null, c);
  assert.deepEqual(
    decodeShareView(new URLSearchParams({ c: '-1.5,0,0.5' })).camera,
    {
      azimuth: -1.5,
      polar: 0,
      zoom: 0.5,
    },
  );
});

void test('an ordinary explorer URL carries no observation state', () => {
  assert.equal(hasShareView(new URLSearchParams('lang=ja')), false);
  assert.equal(hasShareView(new URLSearchParams('lang=ja&t=')), true);
  assert.equal(hasShareView(new URLSearchParams('c=1,1,1')), true);
  // Following a different body makes the link stale; the language does not.
  assert.equal(
    withoutShareView('?lang=ja&t=2026-09-18T00:00:00.000Z&c=1,1,1&top=1'),
    '?lang=ja',
  );
  assert.equal(withoutShareView('?t=2026-09-18T00:00:00.000Z'), '');
  assert.equal(withoutShareView(''), '');
  assert.ok(isShareableBody('moon-io'));
  assert.ok(!isShareableBody('moon-io '));
  assert.ok(!isShareableBody(undefined));
});

void test('share landing paths resolve to one crawlable page per body and language', () => {
  const paths = new Set<string>();
  for (const locale of seoLocales) {
    paths.add(sharePath(locale, null));
    for (const entry of catalogEntries())
      paths.add(sharePath(locale, entry.data.id));
    assert.equal(
      sharePath(locale, 'nonexistent'),
      `/${localePath(locale)}/share`,
    );
  }
  assert.equal(paths.size, seoLocales.length * (catalogEntries().length + 1));
  assert.equal(sharePath('en', 'moon-io'), '/en-US/share/moon-io');
});

void test('the landing page forwards a sanitized state to the explorer', () => {
  assert.equal(
    explorerHref(
      'ja',
      'saturn',
      '?t=2026-09-18T12:34:56.000Z&p=1&s=4&top=1&c=-1.5,1.2,0.4',
    ),
    '/?t=2026-09-18T12%3A34%3A56.000Z&p=1&s=4&top=1&c=-1.5%2C1.2%2C0.4&lang=ja#saturn',
  );
  // Unknown keys and invalid values never reach the explorer.
  assert.equal(
    explorerHref('zh-CN', 'not-a-body', '?t=broken&next=//evil.example&s=99'),
    `/?t=${encodeURIComponent(new Date(defaultShareView.time).toISOString())}&lang=zh-CN`,
  );
  assert.equal(
    explorerHref('en', null, '?r=oort'),
    `/?t=${encodeURIComponent(new Date(defaultShareView.time).toISOString())}&r=oort&lang=en`,
  );
});

void test('every language names the shared subject and stamps the frame in UTC', () => {
  assert.equal(shareMomentLabel(moment), '2026-09-18 12:34 UTC');
  for (const locale of seoLocales) {
    const t = translator(locale);
    assert.equal(
      shareSubjectName({ ...base, selected: 'saturn' }, t),
      t('土星'),
    );
    assert.equal(
      shareSubjectName({ ...base, region: 'kuiper' }, t),
      t(regions.find((region) => region.id === 'kuiper')!.name),
    );
    assert.equal(shareSubjectName(base, t), t('太阳系'));
    const date = shareDateLabel(moment, locale);
    assert.ok(date.includes('2026'), `${locale}: ${date}`);
    // The label is read in UTC, so a late evening frame keeps its own day
    // wherever the reader happens to be.
    assert.equal(shareDateLabel(Date.UTC(2026, 8, 18, 23, 59), locale), date);
    assert.notEqual(shareDateLabel(Date.UTC(2026, 8, 19), locale), date);
  }
});

void test('captured frames scale down to the share limit without changing framing', () => {
  assert.deepEqual(shareImageSize(2560, 1440), { width: 1600, height: 900 });
  assert.deepEqual(shareImageSize(900, 1600), { width: 900, height: 1600 });
  assert.deepEqual(shareImageSize(3200, 3200, 800), {
    width: 800,
    height: 800,
  });
  assert.deepEqual(shareImageSize(0, 0), { width: 0, height: 0 });
  assert.deepEqual(shareImageSize(Number.NaN, 10), { width: 0, height: 0 });
});

void test('share landing routes re-export the shared page module', () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), 'utf8');
  const overview = read('../app/(localized)/[locale]/share/page.tsx');
  const body = read('../app/(localized)/[locale]/share/[id]/page.tsx');
  assert.match(overview, /generateOverviewMetadata as generateMetadata/);
  assert.match(body, /generateBodyMetadata as generateMetadata/);
  assert.match(body, /generateStaticParams/);
  assert.match(body, /dynamicParams/);
  const shared = read('../app/_pages/share-page.tsx');
  // Crawlers rewrite a posted link to og:url or the canonical, which would drop
  // the moment the link carries in its query string.
  assert.match(shared, /alternates: \{ canonical: null \}/);
  assert.doesNotMatch(shared, /openGraph: \{\s*type: 'website',\s*url:/);
});
