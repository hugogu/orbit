import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentLocation, zoneOffsetHours } from '../lib/geolocation.ts';
import { bodies } from '../lib/solar.ts';
import { extraFacts, physicalParameters } from '../lib/physical-facts.ts';
import { fallbackSkyLocation } from '../lib/sky-events.ts';

const homePage = readFileSync(
  new URL('../app/_pages/home-page.tsx', import.meta.url),
  'utf8',
);

void test('uses Beijing as the default observer reference until location is requested', () => {
  assert.deepEqual(fallbackSkyLocation, {
    latitude: 39.9042,
    longitude: 116.4074,
    height: 43,
    utcOffset: 8,
  });
});

void test('requests location only from the explicit ground-view action, never at startup or in the planner', () => {
  const start = homePage.indexOf('  function enterGround()');
  const end = homePage.indexOf('  // A share link arrives', start);
  assert.ok(start > 0 && end > start);
  const action = homePage.slice(start, end);
  assert.match(action, /currentLocation\(navigator\.geolocation/);
  assert.doesNotMatch(
    homePage.slice(0, start) + homePage.slice(end),
    /navigator\.geolocation/,
  );
  assert.match(homePage, /onClick=\{enterGround\}/);
});

void test('geolocation uses the granted device coordinates without map offsets or fabricated altitude', async () => {
  const geo: Pick<Geolocation, 'getCurrentPosition'> = {
    getCurrentPosition(success) {
      success({
        coords: {
          latitude: 31.2304,
          longitude: 121.4737,
          accuracy: 23.4,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    },
  };
  assert.deepEqual(await currentLocation(geo, true), {
    latitude: 31.2304,
    longitude: 121.4737,
    accuracy: 23.4,
  });
});
void test('denial, timeout, unsupported browsers and bad coordinates remain explicit errors', async () => {
  await assert.rejects(currentLocation(undefined, true), /不支持/);
  await assert.rejects(currentLocation(undefined, false), /HTTPS/);
  for (const [code, message] of [
    [1, /权限被拒绝/],
    [2, /无法获取/],
    [3, /超时/],
  ] as const) {
    const geo: Pick<Geolocation, 'getCurrentPosition'> = {
      getCurrentPosition(_success, error) {
        error!({ code } as GeolocationPositionError);
      },
    };
    await assert.rejects(currentLocation(geo, true), message);
  }
  const broken: Pick<Geolocation, 'getCurrentPosition'> = {
    getCurrentPosition(success) {
      success({
        coords: { latitude: NaN, longitude: 10, accuracy: 5 },
      } as GeolocationPosition);
    },
  };
  await assert.rejects(currentLocation(broken, true), /无效位置/);
});
void test('the device zone resolves to the offset it is on at the simulated moment', () => {
  const july = Date.parse('2026-07-15T12:00:00Z'),
    january = Date.parse('2026-01-15T12:00:00Z');
  // Reading the offset from "now" rather than from the simulated moment would
  // put a summer sky an hour out of a winter one wherever daylight saving runs.
  assert.equal(zoneOffsetHours(july, 'America/New_York'), -4);
  assert.equal(zoneOffsetHours(january, 'America/New_York'), -5);
  assert.equal(zoneOffsetHours(july, 'Europe/London'), 1);
  assert.equal(zoneOffsetHours(january, 'Europe/London'), 0);
  // Zones without daylight saving, and those off the hour, resolve exactly.
  for (const time of [july, january]) {
    assert.equal(zoneOffsetHours(time, 'Asia/Shanghai'), 8);
    assert.equal(zoneOffsetHours(time, 'Asia/Kolkata'), 5.5);
    assert.equal(zoneOffsetHours(time, 'UTC'), 0);
  }
  assert.equal(zoneOffsetHours(july, 'Australia/Lord_Howe'), 10.5);
  assert.equal(zoneOffsetHours(january, 'Australia/Lord_Howe'), 11);
  // Every offset the observer can be given must fit the field that shows it.
  for (const zone of Intl.supportedValuesOf('timeZone')) {
    for (const time of [july, january]) {
      const offset = zoneOffsetHours(time, zone)!;
      assert.ok(Number.isFinite(offset), zone);
      assert.ok(offset >= -12 && offset <= 14, `${zone}: ${offset}`);
      assert.ok(Number.isInteger(offset * 4), `${zone}: ${offset}`);
    }
  }
  // An unreadable zone leaves the caller's own offset in place.
  assert.equal(zoneOffsetHours(july, 'Not/AZone'), undefined);
});
void test('physical data covers each body and preserves mass, radius, density and gravity unit consistency', () => {
  for (const b of bodies) {
    const facts = extraFacts(b);
    assert.ok(facts.length >= 4);
    assert.equal(new Set(facts.map((f) => f.label)).size, facts.length);
    assert.ok(facts.every((f) => f.value && !/NaN|undefined/.test(f.value)));
    if (b.id === 'sun') continue;
    const p = physicalParameters[b.id],
      radius = b.radius * 1000;
    const density = p.mass / ((4 / 3) * Math.PI * radius ** 3) / 1000;
    assert.ok(Math.abs(density / p.density - 1) < 0.01, b.id + ' density');
    const gravity = (6.6743e-11 * p.mass) / radius ** 2;
    assert.ok(Math.abs(gravity / p.gravity - 1) < 0.1, b.id + ' gravity');
    assert.ok(
      Math.abs(Math.sqrt(2 * gravity * radius) / 1000 / p.escape - 1) < 0.05,
      b.id + ' escape',
    );
  }
});
