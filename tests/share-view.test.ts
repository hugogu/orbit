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
import {
  contrastRatio,
  qrBadgeLayout,
  qrBadgePalette,
  qrCanvasSize,
  relativeLuminance,
  saveImageRoute,
  shareImageSize,
} from '../lib/share-image';
import { encode } from 'uqr';
import { MAX_TIME, MIN_TIME } from '../lib/simulation-time';
import { catalogEntries, seoLocales } from '../lib/seo';
import { localePath, translator } from '../lib/i18n';
import { regions, speeds } from '../lib/solar';

const moment = Date.UTC(2026, 8, 18, 12, 34, 56);
const base: ShareView = { ...defaultShareView, time: moment };
const roundTrip = (view: ShareView) =>
  decodeShareView(encodeShareView(view), view.selected);
/**
 * Brackets a decode with the wall clock, so a moment the decoder chose for
 * itself can be told apart from any fixed one it might have fallen back to.
 */
const decodeNow = (search: string, selected: string | null = null) => {
  const before = Date.now();
  const view = decodeShareView(new URLSearchParams(search), selected);
  return { view, live: view.time >= before && view.time <= Date.now() };
};
const absoluteShareLink = (id: string, query: string) =>
  `https://www.orbits.observer${sharePath('zh-CN', id)}${query}`;

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
  const { view: decoded, live } = decodeNow(
    't=not-a-date&s=999&v=-4&r=atlantis&p=yes&top=true',
    'not-a-body',
  );
  // Every other field falls back to its default; the moment falls back to now.
  assert.ok(live, new Date(decoded.time).toISOString());
  assert.deepEqual({ ...decoded, time: 0 }, { ...defaultShareView, time: 0 });
  // A moment outside the simulated range is no more usable than a broken one,
  // and neither may strand the visitor at the far end of that range.
  for (const t of ['1200-01-01T00:00:00Z', '2400-01-01T00:00:00Z', ''])
    assert.ok(decodeNow(`t=${encodeURIComponent(t)}`).live, t);
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
  // Framing without a moment describes no observation, and never travels alone.
  assert.equal(hasShareView(new URLSearchParams('c=1,1,1')), false);
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

void test('a link decorated with tracking parameters is not a shared view', () => {
  // `t`, `s`, `r`, `v`, `c` and `p` are among the commonest tracking and
  // redirect parameters on the web. An ordinary link that picked one up used to
  // take the share path and, finding no usable moment, land 300 years in the
  // past; now only the moment itself marks a link as carrying an observation.
  for (const search of [
    'r=3',
    's=',
    'v=',
    'c=',
    'p=1',
    'cc=1',
    'top=1',
    'utm_source=newsletter&s=weekly&r=2',
  ])
    assert.equal(hasShareView(new URLSearchParams(search)), false, search);
  // Every link the dialog writes carries its moment, so none of them is lost.
  assert.ok(hasShareView(encodeShareView(base)));
  assert.ok(hasShareView(encodeShareView({ ...base, selected: 'halley' })));
  // The landing page decodes without consulting that guard, so the fallback has
  // to hold on its own: a stray key and no moment still opens on the live sky.
  const { view, live } = decodeNow('r=3&utm_source=newsletter');
  assert.ok(live, new Date(view.time).toISOString());
  assert.notEqual(view.time, MIN_TIME);
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
  // Unknown keys and invalid values never reach the explorer, and a landing
  // page reached without a usable moment forwards the current one.
  for (const [href, tail] of [
    [
      explorerHref('zh-CN', 'not-a-body', '?t=broken&next=//evil.example&s=99'),
      'lang=zh-CN',
    ],
    [explorerHref('en', null, '?r=oort'), 'r=oort&lang=en'],
  ]) {
    const forwarded = new URLSearchParams(href.slice(href.indexOf('?'))).get(
      't',
    )!;
    assert.equal(href, `/?t=${encodeURIComponent(forwarded)}&${tail}`);
    assert.ok(Math.abs(Date.parse(forwarded) - Date.now()) < 60_000, href);
    assert.notEqual(Date.parse(forwarded), MIN_TIME);
  }
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

void test('keeping the frame goes through the system sheet on a touch screen', () => {
  // Where the sheet carries a picture, its own save action is the only way a
  // page can reach the photo library, and social applications take the image
  // from that same sheet; a download folder serves neither on a phone.
  assert.equal(saveImageRoute(true, true), 'album');
  // A desktop sheet has no album behind it, so the file is the useful result.
  assert.equal(saveImageRoute(true, false), 'download');
  // An in-app browser without file sharing still has the long-press gesture,
  // but nothing this dialog can invoke, so it keeps offering the download.
  assert.equal(saveImageRoute(false, true), 'download');
  assert.equal(saveImageRoute(false, false), 'download');
});

void test('the scannable badge keeps whole-pixel modules and its quiet zone', () => {
  // A long link: every field set, the longest catalog id, and a camera pose.
  const longest = absoluteShareLink(
    'moon-ganymede',
    '?t=2026-09-18T12:34:56.000Z&p=1&s=8&top=1&cc=1&c=-3.1416,3.1416,499.9999',
  );
  for (const link of [
    absoluteShareLink('sun', '?t=2026-09-18T00:00:00.000Z'),
    longest,
  ])
    for (const [width, height] of [
      [1600, 1000],
      [739, 1600],
      [1000, 1000],
      [640, 360],
    ] as const) {
      const symbol = encode(link, { ecc: 'M', border: 0 });
      const layout = qrBadgeLayout(width, height, symbol.size)!;
      const where = `${link.length}ch ${width}x${height}`;
      assert.ok(layout, where);
      // Whole pixels per module, or a camera cannot separate neighbours.
      assert.ok(Number.isInteger(layout.unit) && layout.unit >= 2, where);
      assert.equal(layout.symbol, layout.unit * symbol.size, where);
      // Four modules of clear space on every side, as scanners require.
      assert.equal(layout.quiet, layout.unit * 4, where);
      assert.equal(layout.card, layout.symbol + layout.quiet * 2, where);
      // The badge plus its label has to fit inside the frame it stamps.
      assert.ok(layout.card * 1.2 <= Math.min(width, height), where);
    }
});

void test('the badge stays muted over the sky without starving a scanner', () => {
  const { card, module, label } = qrBadgePalette;
  // Known ratios anchor the maths before it judges the palette.
  assert.equal(Number(contrastRatio('#000000', '#ffffff').toFixed(2)), 21);
  assert.equal(Number(contrastRatio('#ffffff', '#ffffff').toFixed(2)), 1);
  assert.equal(Number(relativeLuminance('#ffffff').toFixed(3)), 1);
  assert.equal(Number(relativeLuminance('#000000').toFixed(3)), 0);
  // Comfortably past the separation a scanner needs, with room to spare.
  assert.ok(contrastRatio(module, card) >= 7, 'symbol contrast');
  assert.ok(contrastRatio(label, card) >= 4.5, 'wordmark contrast');
  // Dark modules on a lighter card: an inverted symbol is what scanners refuse.
  assert.ok(relativeLuminance(module) < relativeLuminance(card));
  // Far enough below white that it no longer glares out of a dark frame.
  assert.ok(relativeLuminance(card) <= 0.55, 'card is muted');
});

void test('the on-screen code is drawn at device pixels a camera can resolve', () => {
  // 41 modules plus the quiet zone on either side.
  const across = 41 + 4 * 2;
  // Browser zoom pushes the ratio past the usual 2 and 3, and every one of
  // them has to come out exact, or the browser rescales what it is handed.
  for (const ratio of [1, 1.5, 2, 2.5, 3, 4, 6]) {
    const { unit, side } = qrCanvasSize(180, 41, ratio);
    const where = `dpr ${ratio}`;
    // Whole device pixels per module, and the canvas is exactly that many, so
    // presenting it at side/ratio never resamples the modules together.
    assert.ok(Number.isInteger(unit) && unit >= 1, where);
    assert.equal(side, unit * across, where);
    assert.ok(side <= 180 * ratio, where);
    // The canvas is presented at side/ratio CSS pixels, which the display then
    // paints with exactly `side` of its own: one drawn pixel per real pixel.
    // Compared loosely, since a fractional ratio cannot round-trip exactly in
    // binary and the browser lays out in subpixels anyway.
    assert.ok(Math.abs((side / ratio) * ratio - side) < 1e-9, where);
    // The badge burnt into the frame lands near one CSS pixel per module once
    // the preview scales it down; this has to clear that by a wide margin.
    assert.ok(
      unit / ratio >= 3,
      `${where}: ${(unit / ratio).toFixed(2)} css px per module`,
    );
  }
  // Never zero, however little room it is handed — it overflows instead of
  // collapsing into a symbol no scanner could resolve, as the doc warns.
  const cramped = qrCanvasSize(10, 177, 1);
  assert.equal(cramped.unit, 1);
  assert.ok(cramped.side > 10);
  // The dialog code is a control among buttons, so it carries their weight
  // rather than the badge's, which has a picture to sit on without glaring.
  assert.ok(contrastRatio(qrBadgePalette.module, qrBadgePalette.screen) >= 10);
  assert.ok(
    relativeLuminance(qrBadgePalette.screen) >
      relativeLuminance(qrBadgePalette.card),
  );
  // Within reach of the button it sits beside, and clear of plain white.
  assert.ok(relativeLuminance(qrBadgePalette.screen) >= 0.5);
  assert.ok(relativeLuminance(qrBadgePalette.screen) <= 0.72);
});

void test('an unusable badge size is refused rather than drawn illegibly', () => {
  assert.equal(qrBadgeLayout(1600, 1000, 0), null);
  assert.equal(qrBadgeLayout(1600, 1000, 2.5), null);
  assert.equal(qrBadgeLayout(0, 0, 41), null);
  assert.equal(qrBadgeLayout(Number.NaN, 100, 41), null);
  // A symbol that cannot hold two whole pixels per module on a tiny frame.
  assert.equal(qrBadgeLayout(60, 60, 177), null);
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
