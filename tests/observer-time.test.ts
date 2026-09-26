import assert from 'node:assert/strict';
import test from 'node:test';
import {
  locateTimeZone,
  observerOffset,
  observerTimeLabel,
  parseObserverTime,
  utcOffsetLabel,
} from '../lib/observer-time';
import { MAX_TIME, MIN_TIME } from '../lib/simulation-time';
import { sanitizePreferences } from '../lib/preferences';

const july = Date.parse('2026-07-15T18:00:00Z');
const january = Date.parse('2026-01-15T18:00:00Z');

void test('observer clock resolves coordinates rather than the browser time zone', () => {
  for (const [latitude, longitude, zone, offset] of [
    [31.2304, 121.4737, 'Asia/Shanghai', 8],
    [40.7128, -74.006, 'America/New_York', -4],
    [27.7172, 85.324, 'Asia/Kathmandu', 5.75],
    [-33.8688, 151.2093, 'Australia/Sydney', 10],
  ] as const) {
    const place = locateTimeZone(
      { latitude, longitude, height: 42, utcOffset: 0 },
      july,
    );
    assert.equal(place.timeZone, zone);
    assert.equal(place.utcOffset, offset);
    assert.equal(place.height, 42);
  }
});

void test('the timeline and local seek agree across midnight, fractional offsets and daylight saving', () => {
  const shanghai = { timeZone: 'Asia/Shanghai', utcOffset: 8 };
  const newYork = { timeZone: 'America/New_York', utcOffset: -4 };
  assert.equal(observerTimeLabel(july, shanghai), '2026-07-16 02:00:00');
  assert.equal(observerOffset(january, newYork), -5);
  assert.equal(observerTimeLabel(january, newYork), '2026-01-15 13:00:00');
  assert.equal(parseObserverTime('2026-01-15T13:00:00', newYork), january);
  assert.equal(parseObserverTime('2026-07-16T02:00', shanghai), july);
  for (const utcOffset of [-12, -3.5, 5.75, 14]) {
    const clock = { utcOffset };
    assert.equal(
      parseObserverTime(
        observerTimeLabel(july, clock).replace(' ', 'T'),
        clock,
      ),
      july,
    );
  }
  assert.equal(utcOffsetLabel(5.75), 'UTC+05:45');
  assert.equal(utcOffsetLabel(-3.5), 'UTC−03:30');
});

void test('nonexistent local times are rejected and unchanged repeated times retain their instant', () => {
  const clock = { timeZone: 'America/New_York', utcOffset: -5 };
  assert.equal(parseObserverTime('2026-03-08T02:30:00', clock), null);
  assert.equal(
    parseObserverTime('2026-03-08T03:30:00', clock),
    Date.parse('2026-03-08T07:30:00Z'),
  );
  for (const instant of ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z']) {
    const opened = Date.parse(instant);
    assert.equal(observerTimeLabel(opened, clock), '2026-11-01 01:30:00');
    assert.equal(
      parseObserverTime('2026-11-01T01:30:00', clock, opened),
      opened,
    );
  }
  assert.equal(parseObserverTime('2026-02-30T12:00:00', clock), null);
  assert.equal(parseObserverTime('bad', clock), null);
});

void test('local labels round-trip UTC range boundaries and historical offsets with seconds', () => {
  for (const timeZone of [
    'Asia/Shanghai',
    'America/New_York',
    'Pacific/Auckland',
  ])
    for (const time of [MIN_TIME, january, july, MAX_TIME]) {
      const clock = { timeZone, utcOffset: 0 };
      assert.equal(
        parseObserverTime(
          observerTimeLabel(time, clock).replace(' ', 'T'),
          clock,
        ),
        time,
      );
    }
  assert.equal(
    parseObserverTime('1699-12-31T23:59:59', { utcOffset: 0 }),
    null,
  );
  assert.equal(
    parseObserverTime('2201-01-01T00:00:00', { utcOffset: 0 }),
    null,
  );
});

void test('stored observer zones are validated while old manual offsets still work', () => {
  const location = {
    latitude: 31.23,
    longitude: 121.47,
    height: 12,
    utcOffset: 8,
  };
  assert.deepEqual(
    sanitizePreferences({ observerLocation: location }).observerLocation,
    location,
  );
  const zoned = { ...location, timeZone: 'Asia/Shanghai' };
  assert.deepEqual(
    sanitizePreferences({ observerLocation: zoned }).observerLocation,
    zoned,
  );
  assert.equal(
    sanitizePreferences({
      observerLocation: { ...location, timeZone: 'invalid/zone' },
    }).observerLocation,
    undefined,
  );
});
