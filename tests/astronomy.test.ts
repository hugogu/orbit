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
  calculateEclipseList,
  calculateDailySunEvents,
  localDayForTime,
  altitude,
  validateEclipseQuery,
  ECLIPSE_LIST_SIZE,
  type EclipseQuery,
  type DailySunQuery,
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
const query: EclipseQuery = {
  start: Date.parse('2024-04-01T00:00:00Z'),
  latitude: 32.7767,
  longitude: -96.797,
  height: 0,
  utcOffset: -5,
};
const dailyQuery: DailySunQuery = { ...query, day: '2024-04-01' };

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
  const a = calculateEclipseList(query).solar.events;
  assert.equal(a[0].kind, '日全食');
  assert.ok(Math.abs(a[0].peak - Date.parse('2024-04-08T18:17:15Z')) < 30000);
  // Dallas stands on the 2024 path, so the first listed eclipse carries its own
  // local contacts. The observer's maximum is its own instant, later than the
  // global peak and bracketed by the contacts seen there.
  const dallas = a[0].local!;
  assert.equal(dallas.kind, '日全食');
  assert.ok(dallas.begin < dallas.peak && dallas.end > dallas.peak);
  assert.ok(dallas.peak > a[0].peak);
  assert.ok(
    Math.abs(dallas.peak - Date.parse('2024-04-08T18:42:00Z')) < 120000,
  );
  assert.ok(dallas.altitude > 0);
  assert.ok(dallas.obscuration > 0.99);
  // https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html (TD 06:59:56, deltaT 75s)
  const b = calculateEclipseList({
    ...query,
    start: Date.parse('2025-03-01T00:00:00Z'),
  }).lunar.events;
  assert.equal(b[0].kind, '月全食');
  assert.ok(Math.abs(b[0].peak - Date.parse('2025-03-14T06:58:41Z')) < 30000);
});
void test('each list holds one screen of upcoming eclipses in order, after the requested moment', () => {
  const list = calculateEclipseList(query);
  for (const events of [list.lunar.events, list.solar.events]) {
    assert.ok(events.length >= ECLIPSE_LIST_SIZE);
    for (const [index, event] of events.entries()) {
      assert.ok(event.peak > query.start);
      assert.ok(Number.isFinite(event.peak));
      if (index > 0) assert.ok(event.peak > events[index - 1].peak);
    }
  }
  assert.equal(list.lunar.events.length, ECLIPSE_LIST_SIZE);
  // Every listed lunar eclipse reports its penumbral span and the Moon's height.
  for (const event of list.lunar.events) {
    assert.ok(event.begin! < event.peak && event.end! > event.peak);
    assert.ok(Math.abs(event.altitude!) <= 90);
  }
  assert.equal(list.solar.events.filter((event) => event.local).length, 1);
  assert.equal(
    calculateEclipseList({ ...query, count: 2 }).lunar.events.length,
    2,
  );
});
void test('a location that sees none of the listed solar eclipses still gets its next visible one', () => {
  const beijing = {
    ...query,
    start: Date.parse('2026-09-19T00:00:00Z'),
    latitude: 39.9042,
    longitude: 116.4074,
    height: 43,
    utcOffset: 8,
  };
  const solar = calculateEclipseList(beijing).solar.events;
  assert.equal(solar.length, ECLIPSE_LIST_SIZE + 1);
  assert.ok(solar.slice(0, ECLIPSE_LIST_SIZE).every((event) => !event.local));
  const visible = solar.at(-1)!;
  assert.ok(visible.local);
  assert.ok(visible.peak > solar[ECLIPSE_LIST_SIZE - 1].peak);
  assert.ok(visible.obscuration === undefined);
  assert.ok(visible.local!.obscuration > 0);
  // The appended entry keeps its own global classification and peak, so the
  // list reads in one frame of reference however far ahead it reaches.
  assert.match(visible.kind, /^日/);
  assert.ok(Math.abs(visible.local!.peak - visible.peak) < DAY_MS / 2);
});
void test('following pages continue the sequence without gaps, repeats or a second visible hunt', () => {
  const place = {
    ...query,
    start: Date.parse('2026-09-19T00:00:00Z'),
    latitude: 39.9042,
    longitude: 116.4074,
    height: 43,
    utcOffset: 8,
  };
  const first = calculateEclipseList(place);
  // The cursor follows the global run, not the visible eclipse appended past
  // it: continuing from that one would skip every eclipse in between.
  const appended = first.solar.events.at(-1)!;
  assert.equal(first.solar.events.length, ECLIPSE_LIST_SIZE + 1);
  assert.ok(appended.peak > first.solar.next!);
  assert.equal(
    first.solar.next,
    first.solar.events[ECLIPSE_LIST_SIZE - 1].peak + 1,
  );
  // The preview is not part of the run, so paging is expected to reach that
  // eclipse again in its own right; the list merges the two by peak.
  const seen = first.solar.events.slice(0, ECLIPSE_LIST_SIZE);
  let cursor: number | null = first.solar.next;
  for (let page = 0; page < 4; page++) {
    const next = calculateEclipseList({ ...place, start: cursor!, page: true });
    // A following page is a plain global run: no repeated visible-eclipse hunt,
    // so nothing is appended twice.
    assert.equal(next.solar.events.length, ECLIPSE_LIST_SIZE);
    for (const event of next.solar.events) {
      assert.ok(event.peak >= cursor!);
      assert.ok(
        !seen.some((other) => Math.abs(other.peak - event.peak) < DAY_MS),
        new Date(event.peak).toISOString(),
      );
      seen.push(event);
    }
    cursor = next.solar.next;
  }
  const reached = seen.filter(
    (event) => Math.abs(event.peak - appended.peak) < DAY_MS,
  );
  assert.equal(reached.length, 1);
  assert.ok(reached[0].local, 'the run reports it as visible too');
  // Lunar pages carry their own cursor, since the two series do not align.
  assert.notEqual(first.lunar.next, first.solar.next);
  const lunarPage = calculateEclipseList({
    ...place,
    start: first.lunar.next!,
    page: true,
  });
  assert.ok(lunarPage.lunar.events[0].peak > first.lunar.next!);
  // The cursor closes at the end of the supported range rather than looping.
  const tail = calculateEclipseList({
    ...place,
    start: MAX_TIME - 200 * DAY_MS,
  });
  assert.equal(tail.solar.next, null);
  assert.equal(tail.lunar.next, null);
});
void test('daily events respect local midnight, opposite UTC date and horizon crossing direction', () => {
  const q = {
    ...dailyQuery,
    day: '2025-03-01',
    latitude: 39.9042,
    longitude: 116.4074,
    utcOffset: 8,
  };
  const r = calculateDailySunEvents(q),
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
});
void test('daily sunrise and sunset are projected from the simulation clock for Earth', () => {
  const location = {
    latitude: 39.9042,
    longitude: 116.4074,
    height: 0,
    utcOffset: 8,
  };
  const simulationTime = Date.parse('2025-03-01T18:00:00Z');
  const day = localDayForTime(simulationTime, location.utcOffset);
  assert.equal(day, '2025-03-02');
  const daily = calculateDailySunEvents({ ...location, day });
  assert.ok(daily.rise! < daily.set!);
  assert.equal(
    localDayForTime(daily.rise!, location.utcOffset),
    localDayForTime(daily.set!, location.utcOffset),
  );
});
void test('polar day/night and invalid inputs produce explicit outcomes', () => {
  for (const [day, word] of [
    ['2024-06-21', '极昼'],
    ['2024-12-21', '极夜'],
  ]) {
    const r = calculateDailySunEvents({
      ...dailyQuery,
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
    { latitude: 91 },
    { longitude: NaN },
    { utcOffset: 15 },
    { start: MAX_TIME + 1 },
    { height: Infinity },
  ])
    assert.throws(() => validateEclipseQuery({ ...query, ...patch }));
  for (const patch of [{ day: '2024-02-30' }, { latitude: 91 }])
    assert.throws(() => calculateDailySunEvents({ ...dailyQuery, ...patch }));
  const end = calculateEclipseList({ ...query, start: MAX_TIME });
  assert.deepEqual(end.solar, { events: [], next: null });
  assert.deepEqual(end.lunar, { events: [], next: null });
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
