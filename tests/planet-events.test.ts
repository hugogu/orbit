import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Body,
  Ecliptic,
  GeoVector,
  SearchRelativeLongitude,
} from 'astronomy-engine';
import { calculatePlanetEvents, nextOpposition } from '../lib/planet-events';
import { fallbackSkyLocation } from '../lib/sky-events';
import { DAY_MS, MIN_TIME, MAX_TIME } from '../lib/simulation-time';

const query = { ...fallbackSkyLocation, start: Date.UTC(2026, 9, 3) };
const date = (ms: number) => new Date(ms).toISOString().slice(0, 10);

void test('Saturn 2026 opposition agrees with the IGN almanac within model accuracy', () => {
  // IGN Atlas 2026: October 4, 12:28 UTC. Astronomy Engine is accurate to ~1 arcminute.
  const peak = nextOpposition(Body.Saturn, query.start);
  assert.equal(nextOpposition(Body.Saturn, peak), peak);
  assert.ok(Math.abs(peak - Date.UTC(2026, 9, 4, 12, 28)) < 5 * 60_000);
  const sun = Ecliptic(GeoVector(Body.Sun, new Date(peak), true)).elon;
  const saturn = Ecliptic(GeoVector(Body.Saturn, new Date(peak), true)).elon;
  assert.ok(Math.abs(((saturn - sun + 360) % 360) - 180) < 1e-5);
  const alignment = SearchRelativeLongitude(
    Body.Saturn,
    0,
    new Date(query.start),
  ).date.getTime();
  assert.ok(Math.abs(peak - alignment) > 5 * 60_000);
  assert.equal(date(nextOpposition(Body.Saturn, peak + 60_000)), '2027-10-18');
  assert.throws(() => nextOpposition(Body.Venus, query.start));
});

void test('upcoming lists cover every eligible planet and remain chronological', () => {
  const result = calculatePlanetEvents(query);
  assert.equal(result.opposition.length, 15);
  assert.equal(result.transit.length, 4);
  for (const body of ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'])
    assert.equal(
      result.opposition.filter((event) => event.body === body).length,
      3,
    );
  for (const body of ['mercury', 'venus'])
    assert.equal(
      result.transit.filter((event) => event.body === body).length,
      2,
    );
  for (const events of [result.opposition, result.transit]) {
    assert.equal(
      new Set(events.map((event) => `${event.body}-${event.peak}`)).size,
      events.length,
    );
    for (const [index, event] of events.entries()) {
      assert.ok(event.peak >= query.start && event.peak <= MAX_TIME);
      assert.ok(index === 0 || event.peak > events[index - 1].peak);
      assert.ok(event.altitude >= -90 && event.altitude <= 90);
      assert.ok(Number.isFinite(event.magnitude) && event.distance > 0);
    }
  }
});

void test('Mercury and Venus transits match the NASA catalog, with ordered contacts', () => {
  const events = calculatePlanetEvents(query).transit;
  assert.deepEqual(
    events.map((event) => [event.body, date(event.peak)]),
    [
      ['mercury', '2032-11-13'],
      ['mercury', '2039-11-07'],
      ['venus', '2117-12-11'],
      ['venus', '2125-12-08'],
    ],
  );
  for (const event of events) {
    assert.ok(event.begin! < event.peak && event.peak < event.end!);
    assert.ok(event.end! - event.begin! < DAY_MS);
  }
  const mercury = events[0];
  const later = calculatePlanetEvents({
    ...query,
    start: mercury.peak + 60_000,
  });
  assert.equal(date(later.transit[0].peak), '2039-11-07');
});

void test('geocentric dates are independent of location but local altitudes are not', () => {
  const first = calculatePlanetEvents(query);
  const second = calculatePlanetEvents({
    ...query,
    latitude: -33.87,
    longitude: 151.21,
    utcOffset: 11,
  });
  for (const kind of ['opposition', 'transit'] as const) {
    assert.deepEqual(
      first[kind].map((event) => event.peak),
      second[kind].map((event) => event.peak),
    );
    assert.notEqual(first[kind][0].altitude, second[kind][0].altitude);
  }
});

void test('supported range is bounded at both ends and exhausted lists are empty', () => {
  assert.ok(
    calculatePlanetEvents({ ...query, start: MIN_TIME }).opposition.length > 0,
  );
  const last = calculatePlanetEvents({ ...query, start: MAX_TIME });
  assert.deepEqual(last, { opposition: [], transit: [] });
  for (const start of [MIN_TIME - 1, MAX_TIME + 1, NaN, Infinity])
    assert.throws(() => calculatePlanetEvents({ ...query, start }));
});
