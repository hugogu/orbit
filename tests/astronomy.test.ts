import test from 'node:test';
import assert from 'node:assert/strict';
import { Body as AstroBody, Observer, ObserverVector } from 'astronomy-engine';
import { Vector3 } from 'three';
import { bodies } from '../lib/solar.ts';
import {
  planetPosition,
  bodyOrientation,
  sceneVector,
} from '../lib/ephemeris.ts';
import {
  DAY_MS,
  J2000_MS,
  MIN_TIME,
  MAX_TIME,
  advanceTime,
} from '../lib/simulation-time.ts';
import {
  calculateSkyEvents,
  calculateDailySunEvents,
  localDayForTime,
  altitude,
  validateQuery,
  type SkyQuery,
} from '../lib/sky-events.ts';
import {
  cometElements,
  cometPosition,
  cometOrbitPoint,
  comets,
} from '../lib/comets.ts';
import { datedMoonOffset } from '../lib/satellite-elements.ts';
import { orbitingMoons } from '../lib/moon-orbits.ts';
const earth = bodies.find((b) => b.id === 'earth')!;
const days = (iso: string) => (Date.parse(iso) - J2000_MS) / DAY_MS;
const query: SkyQuery = {
  start: Date.parse('2024-04-01T00:00:00Z'),
  day: '2024-04-01',
  latitude: 32.7767,
  longitude: -96.797,
  height: 0,
  utcOffset: -5,
};

void test('UTC clock pauses exactly, seeks independently of selection and clamps supported boundaries', () => {
  const t = Date.parse('2026-09-07T12:34:56Z');
  assert.equal(advanceTime(t, 1, 1 / 86400, false), t + 1000);
  assert.equal(advanceTime(t, 50, 3650, true), t);
  assert.equal(advanceTime(MAX_TIME - 1, 1, 3650, false), MAX_TIME);
  assert.equal(advanceTime(MIN_TIME, 1, -1, false), MIN_TIME);
});
void test('heliocentric Earth at J2000 has the measured quadrant and perihelion distance; frames preserve scale', () => {
  // JPL approximate J2000 elements: https://ssd.jpl.nasa.gov/planets/approx_pos.html
  const p = planetPosition(earth, 0, 'distance').map((x) => x / 3.1);
  assert.ok(p[0] < -0.17 && p[0] > -0.19);
  assert.ok(p[2] < -0.96 && p[2] > -0.98);
  assert.ok(Math.abs(Math.hypot(...p) - 0.9833) < 0.001);
  for (const date of [
    '1700-01-01T00:00:00Z',
    '2024-04-08T18:17:00Z',
    '2200-12-31T23:59:59Z',
  ])
    for (const b of bodies) {
      const a = planetPosition(b, days(date), 'distance');
      assert.ok(a.every(Number.isFinite));
      assert.ok(
        Math.abs(bodyOrientation(b.id, days(date)).length() - 1) < 1e-10,
      );
      if (b.au) {
        const c = planetPosition(b, days(date), 'illustrated');
        assert.ok(
          c.every(
            (v, i) => Math.abs((v * b.au * 3.1) / b.distance - a[i]) < 1e-9,
          ),
        );
      }
    }
});
void test('Earth prime meridian tracks Greenwich at date, with the correct day/night face', () => {
  const d = days('2024-03-20T12:00:00Z');
  const q = bodyOrientation('earth', d);
  const prime = new Vector3(1, 0, 0).applyQuaternion(q);
  const greenwich = new Vector3(
    ...sceneVector(ObserverVector(d, new Observer(0, 0, 0), false)),
  ).normalize();
  assert.ok(prime.dot(greenwich) > 0.999999);
  const sunDirection = new Vector3(...planetPosition(earth, d, 'distance'))
    .negate()
    .normalize();
  assert.ok(prime.dot(sunDirection) > 0.99);
  assert.ok(
    new Vector3(1, 0, 0)
      .applyQuaternion(bodyOrientation('earth', d + 0.5))
      .dot(sunDirection) < -0.99,
  );
});
void test('all 19 dated moon positions are finite, reproducible and move; lunar phase agrees with a known eclipse', () => {
  const d = days('2024-04-08T18:17:00Z');
  for (const moon of orbitingMoons) {
    const p = datedMoonOffset(moon, d, 'illustrated');
    assert.ok(p.every(Number.isFinite));
    assert.deepEqual(p, datedMoonOffset(moon, d, 'illustrated'));
    assert.notDeepEqual(p, datedMoonOffset(moon, d + 0.05, 'illustrated'));
  }
  const m = orbitingMoons.find((m) => m.en === 'Moon')!;
  const toMoon = new Vector3(
    ...datedMoonOffset(m, d, 'illustrated'),
  ).normalize();
  const toSun = new Vector3(...planetPosition(earth, d, 'distance'))
    .negate()
    .normalize();
  assert.ok(toMoon.dot(toSun) > 0.9998);
});
void test('global eclipse peaks agree with NASA catalogs after converting TD to UTC', () => {
  // https://eclipse.gsfc.nasa.gov/SEcat5/SE2001-2100.html (TD 18:18:29, deltaT 74s)
  const a = calculateSkyEvents(query);
  assert.equal(a.solar!.kind, '日全食');
  assert.ok(
    Math.abs(a.solar!.peak - Date.parse('2024-04-08T18:17:15Z')) < 30000,
  );
  assert.equal(a.localSolar!.kind, '日全食');
  assert.ok(
    a.localSolar!.begin! < a.localSolar!.peak &&
      a.localSolar!.end! > a.localSolar!.peak,
  );
  assert.ok(a.localSolar!.altitude! > 0);
  // https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html (TD 06:59:56, deltaT 75s)
  const b = calculateSkyEvents({
    ...query,
    start: Date.parse('2025-03-01T00:00:00Z'),
  });
  assert.equal(b.lunar!.kind, '月全食');
  assert.ok(
    Math.abs(b.lunar!.peak - Date.parse('2025-03-14T06:58:41Z')) < 30000,
  );
});
void test('daily events respect local midnight, opposite UTC date and horizon crossing direction', () => {
  const q = {
    ...query,
    day: '2025-03-01',
    latitude: 39.9042,
    longitude: 116.4074,
    utcOffset: 8,
  };
  const r = calculateSkyEvents(q),
    observer = new Observer(q.latitude, q.longitude, 0);
  assert.equal(new Date(r.rise!).toISOString().slice(0, 10), '2025-02-28');
  for (const ms of [r.rise!, r.set!])
    assert.equal(
      new Date(ms + q.utcOffset * 3600000).toISOString().slice(0, 10),
      q.day,
    );
  assert.ok(
    altitude(AstroBody.Sun, r.rise! + 60000, observer) >
      altitude(AstroBody.Sun, r.rise! - 60000, observer),
  );
  assert.ok(
    altitude(AstroBody.Sun, r.set! + 60000, observer) <
      altitude(AstroBody.Sun, r.set! - 60000, observer),
  );
  assert.ok(Math.abs(altitude(AstroBody.Sun, r.rise!, observer) + 0.27) < 0.1);
  assert.notEqual(r.localSolar!.peak, r.solar!.peak);
});
void test('daily sunrise and sunset can be projected from the simulation clock for Earth', () => {
  const location = {
    latitude: 39.9042,
    longitude: 116.4074,
    height: 0,
    utcOffset: 8,
  };
  const simulationTime = Date.parse('2025-03-01T18:00:00Z');
  const day = localDayForTime(simulationTime, location.utcOffset);
  const daily = calculateDailySunEvents({ ...location, day });
  const full = calculateSkyEvents({
    start: simulationTime,
    day,
    ...location,
  });
  assert.equal(day, '2025-03-02');
  assert.equal(daily.rise, full.rise);
  assert.equal(daily.set, full.set);
  assert.equal(daily.daylight, full.daylight);
});
void test('polar day/night and invalid inputs produce explicit outcomes', () => {
  for (const [day, word] of [
    ['2024-06-21', '极昼'],
    ['2024-12-21', '极夜'],
  ]) {
    const r = calculateSkyEvents({
      ...query,
      day,
      latitude: 69.65,
      longitude: 18.96,
      utcOffset: 2,
    });
    assert.equal(r.rise, null);
    assert.equal(r.set, null);
    assert.match(r.daylight, new RegExp(word));
  }
  for (const patch of [
    { day: '2024-02-30' },
    { latitude: 91 },
    { longitude: NaN },
    { utcOffset: 15 },
    { start: MAX_TIME + 1 },
    { height: Infinity },
  ])
    assert.throws(() => validateQuery({ ...query, ...patch }));
  const end = calculateSkyEvents({ ...query, start: MAX_TIME });
  assert.equal(end.solar, null);
  assert.equal(end.lunar, null);
  assert.equal(end.localSolar, null);
});
void test('comet snapshots orient perihelia and use epochs, so dates are independent of navigation', () => {
  for (const comet of comets) {
    const e = cometElements(comet),
      p = cometOrbitPoint(comet, 0),
      a = cometOrbitPoint(comet, Math.PI);
    assert.ok(Math.abs(Math.hypot(...p) - e.au * (1 - e.e) * 3.1) < 1e-8);
    assert.ok(Math.abs(Math.hypot(...a) - e.au * (1 + e.e) * 3.1) < 1e-8);
    const at = cometPosition(comet, 9500);
    assert.deepEqual(at, cometPosition(comet, 9500));
    assert.notDeepEqual(at, cometPosition(comet, 9600));
    assert.ok(Math.abs(at[2]) > 0);
  }
});
