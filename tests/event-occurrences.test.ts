import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Body,
  Equator,
  Horizon,
  Observer,
  RotateVector,
  Rotation_EQJ_HOR,
} from 'astronomy-engine';
import {
  eventOccurrences,
  occurrenceCircumstances,
  occurrenceForPlanetEvent,
  occurrenceImagePath,
  occurrenceReferenceLocation,
} from '../lib/event-occurrences';
import { calculatePlanetEvents, nextOpposition } from '../lib/planet-events';
import {
  eventDetailsPath,
  occurrenceExplorerPath,
  occurrenceJsonLd,
  occurrenceName,
  occurrenceTitle,
  seoLocales,
} from '../lib/seo';
import { sitemapEntries } from '../lib/sitemap';
import { isProfilePath, isPwaAssetPath } from '../lib/pwa';
import {
  chartBodyPosition,
  projectSkyPosition,
  renderOccurrenceSkyChart,
} from '../lib/occurrence-sky-chart';
import {
  parseStarCatalog,
  parseConstellationFigures,
  starCount,
} from '../lib/star-catalog';
import { DAY_MS } from '../lib/simulation-time';
import sharp from 'sharp/lib/index.js';
import { renderSkyChartImage } from '../scripts/lib/sky-chart-image';

void test('dated editions have distinct identities and match the actual planetary planner events', () => {
  assert.equal(new Set(eventOccurrences.map((event) => event.id)).size, 3);
  const planets = calculatePlanetEvents({
    ...occurrenceReferenceLocation,
    start: Date.UTC(2026, 9, 3),
  });
  for (const event of eventOccurrences) {
    assert.equal(event.id, `saturn-opposition-${event.date}`);
    assert.ok(
      Math.abs(
        nextOpposition(Body.Saturn, Date.parse(`${event.date}T00:00Z`)) -
          event.peak,
      ) < 1000,
    );
    const calculated = planets.opposition.find(
      (card) => Math.abs(card.peak - event.peak) < 1000,
    );
    assert.ok(calculated);
    assert.equal(
      occurrenceForPlanetEvent('opposition', calculated.body, calculated.peak),
      event,
    );
    assert.equal(
      occurrenceForPlanetEvent('transit', 'saturn', event.peak),
      undefined,
    );
    assert.equal(
      occurrenceForPlanetEvent('opposition', 'jupiter', event.peak),
      undefined,
    );
    assert.equal(
      occurrenceForPlanetEvent('opposition', 'saturn', event.peak + DAY_MS),
      undefined,
    );
  }
});

void test('edition titles, canonical routes and images preserve year/month and concept hierarchy', () => {
  const sitemap = sitemapEntries();
  for (const event of eventOccurrences)
    for (const locale of seoLocales) {
      const path = eventDetailsPath(locale, event.id);
      assert.ok(isProfilePath(path));
      assert.ok(isPwaAssetPath(occurrenceImagePath(event, locale)));
      assert.match(
        occurrenceName(event, locale),
        new RegExp(event.date.slice(0, 4)),
      );
      assert.match(
        occurrenceName(event, locale),
        locale === 'en' ? /October/ : /10月/,
      );
      assert.ok(
        occurrenceTitle(event, locale).includes(occurrenceName(event, locale)),
      );
      const entry = sitemap.find((item) => item.loc.endsWith(path));
      assert.equal(entry?.alternates?.length, 4);
      assert.ok(
        entry?.images?.[0].endsWith(occurrenceImagePath(event, locale)),
      );
      const graph = occurrenceJsonLd(event, locale)['@graph'];
      assert.ok(!graph.some((node) => node['@type'] === 'DefinedTerm'));
      const article = graph.find((node) => node['@type'] === 'Article')!;
      assert.ok('temporalCoverage' in article && 'about' in article);
      assert.equal(
        article.temporalCoverage,
        new Date(event.peak).toISOString(),
      );
      assert.ok(article.about['@id'].endsWith('/events/opposition#sky-event'));
      const intent = new URL(
        occurrenceExplorerPath(event, locale),
        'https://orbits.observer',
      );
      assert.equal(intent.searchParams.get('planner'), 'opposition');
      assert.equal(intent.hash, '#saturn');
      assert.equal(intent.searchParams.get('p'), '1');
      assert.equal(
        Date.parse(intent.searchParams.get('t')!),
        event.peak - 60_000,
      );
    }
});

void test('each forecast uses its own measurements and a complete Beijing observing night', () => {
  const values = eventOccurrences.map(occurrenceCircumstances);
  assert.equal(new Set(values.map((data) => data.ringTilt)).size, 3);
  assert.ok(
    values[0].ringTilt < values[1].ringTilt &&
      values[1].ringTilt < values[2].ringTilt,
  );
  assert.ok(values[0].distance > values[2].distance);
  for (const [index, event] of eventOccurrences.entries()) {
    const data = values[index];
    assert.ok(data.rise && data.transit && data.set);
    assert.ok(data.rise < data.transit && data.transit < data.set);
    assert.ok(data.set - data.rise < DAY_MS);
    const night = new Date(event.chartTime + 8 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    assert.equal(
      new Date(data.rise + 8 * 3_600_000).toISOString().slice(0, 10),
      night,
    );
    assert.equal(
      new Date(data.set + 8 * 3_600_000).toISOString().slice(0, 10),
      new Date(event.chartTime + DAY_MS + 8 * 3_600_000)
        .toISOString()
        .slice(0, 10),
    );
    const observer = new Observer(
      occurrenceReferenceLocation.latitude,
      occurrenceReferenceLocation.longitude,
      occurrenceReferenceLocation.height,
    );
    const sun = Equator(
      Body.Sun,
      new Date(event.chartTime),
      observer,
      true,
      true,
    );
    assert.ok(
      Horizon(new Date(event.chartTime), observer, sun.ra, sun.dec, 'normal')
        .altitude < -18,
    );
    const eqj = Equator(
      Body.Saturn,
      new Date(event.chartTime),
      observer,
      false,
      true,
    );
    const local = RotateVector(
      Rotation_EQJ_HOR(new Date(event.chartTime), observer),
      eqj.vec,
    );
    const azimuth =
      ((Math.atan2(-local.y, local.x) * 180) / Math.PI + 360) % 360;
    assert.ok(Math.abs(azimuth - data.azimuth) < 1e-8);
    assert.equal(
      chartBodyPosition(Body.Saturn, event)?.altitude,
      data.altitude,
    );
  }
});

void test('chart projection preserves direction and rejects positions outside the displayed sky', () => {
  assert.ok(projectSkyPosition(90, 30)!.x < projectSkyPosition(180, 30)!.x);
  assert.ok(projectSkyPosition(135, 60)!.y < projectSkyPosition(135, 15)!.y);
  for (const [azimuth, altitude] of [
    [0, 30],
    [135, -1],
    [135, 90],
    [NaN, 20],
    [90, Infinity],
  ])
    assert.equal(projectSkyPosition(azimuth, altitude), null);
});

void test('localized charts use real topocentric positions and rasterize every label with the bundled font', async () => {
  const bytes = readFileSync('public/sky/bright-stars.bin');
  const stars = parseStarCatalog(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const figures = parseConstellationFigures(
    JSON.parse(readFileSync('public/sky/constellations.json', 'utf8')),
    starCount(stars),
  );
  const editions: string[] = [];
  for (const event of eventOccurrences) {
    const expected = occurrenceCircumstances(event);
    for (const locale of seoLocales) {
      const svg = renderOccurrenceSkyChart(event, locale, stars, figures);
      assert.ok(svg.includes(occurrenceName(event, locale)));
      assert.ok((svg.match(/<circle /g) ?? []).length > 100);
      const marker = svg.match(
        /data-body="Saturn" data-azimuth="([^"]+)" data-altitude="([^"]+)"/,
      );
      assert.ok(marker);
      assert.equal(Number(marker[1]), expected.azimuth);
      assert.equal(Number(marker[2]), expected.altitude);
      assert.ok(svg.includes(event.date.slice(0, 4)) && svg.includes('22:00'));
      const rendered = await renderSkyChartImage(svg);
      const metadata = await sharp(rendered).metadata();
      assert.equal(metadata.width, 1400);
      assert.equal(metadata.height, 820);
      assert.ok(rendered.byteLength > 10_000);
      if (locale === 'en') editions.push(svg);
    }
  }
  assert.equal(new Set(editions).size, 3);
});

void test('chart generation rejects characters missing from the bundled font', async () => {
  await assert.rejects(
    renderSkyChartImage(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50" fill="#fff" font-size="18">🪐</text></svg>',
    ),
    /Sky-chart font lacks/,
  );
});
