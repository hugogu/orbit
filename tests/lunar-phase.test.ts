import test from 'node:test';
import assert from 'node:assert/strict';
import { Body, Observer, SearchRiseSet } from 'astronomy-engine';
import {
  lunarMonth,
  monthForTime,
  moonMomentAt,
  moonObservingWindow,
  moonQuarters,
  observingNotes,
  phaseDiscPath,
  phaseName,
  phaseNames,
  quarterNames,
  shiftMonth,
  validateMonth,
  QUARTER_LIST_SIZE,
} from '../lib/lunar-phase.ts';
import { DAY_MS, MAX_TIME, MIN_TIME } from '../lib/simulation-time.ts';
import { altitude, type SkyLocation } from '../lib/sky-events.ts';

const beijing: SkyLocation = {
  latitude: 39.9042,
  longitude: 116.4074,
  height: 43,
  utcOffset: 8,
};
const fairbanks: SkyLocation = {
  latitude: 64.8378,
  longitude: -147.7164,
  height: 135,
  utcOffset: -9,
};
const iso = (ms: number) => new Date(ms).toISOString();

void test('a phase name never contradicts the illuminated fraction beside it', () => {
  // The principal phases keep their names for the days around the instant.
  assert.equal(phaseName(0), '新月');
  assert.equal(phaseName(359.9), '新月');
  assert.equal(phaseName(7.4), '新月');
  assert.equal(phaseName(7.6), '蛾眉月');
  assert.equal(phaseName(90), '上弦月');
  assert.equal(phaseName(180), '满月');
  assert.equal(phaseName(270), '下弦月');
  assert.equal(phaseName(352.4), '残月');
  assert.equal(phaseName(352.6), '新月');
  // A crescent is always less than half lit and a gibbous Moon always more, so
  // a reader never sees "waxing crescent" beside 63%.
  const crescents = new Set(['蛾眉月', '残月']);
  const gibbous = new Set(['盈凸月', '亏凸月']);
  for (let angle = 0; angle < 360; angle += 0.25) {
    const name = phaseName(angle);
    const lit = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
    if (crescents.has(name)) assert.ok(lit < 0.5, `${angle}°: ${lit}`);
    if (gibbous.has(name)) assert.ok(lit > 0.5, `${angle}°: ${lit}`);
  }
  // Every name is reachable, and the wrap is handled from either side.
  const seen = new Set<string>();
  for (let angle = 0; angle < 360; angle += 0.5) seen.add(phaseName(angle));
  assert.deepEqual([...seen].sort(), [...phaseNames].sort());
  assert.equal(phaseName(-10), phaseName(350));
});

void test('the instant readout matches the known new moon of the 2024 total solar eclipse', () => {
  // The eclipse of 8 April 2024 happened at new moon: greatest eclipse 18:17 UTC.
  const newMoon = Date.parse('2024-04-08T18:21:00Z');
  const moment = moonMomentAt(newMoon, beijing);
  assert.ok(
    Math.min(moment.elongation, 360 - moment.elongation) < 0.5,
    `elongation ${moment.elongation}`,
  );
  assert.equal(moment.phase, '新月');
  assert.ok(moment.illumination < 0.001, `illumination ${moment.illumination}`);
  assert.ok(moment.age < 0.05 || moment.age > 29, `age ${moment.age}`);
  // A lunation is never far from the 29.53-day mean.
  assert.ok(
    moment.lunation > 29.2 && moment.lunation < 29.9,
    `lunation ${moment.lunation}`,
  );
  // The Moon's distance and apparent size stay inside the published extremes.
  assert.ok(
    moment.distanceKm > 356_000 && moment.distanceKm < 407_000,
    `distance ${moment.distanceKm}`,
  );
  assert.ok(
    moment.apparentDiameter > 29 && moment.apparentDiameter < 34,
    `diameter ${moment.apparentDiameter}`,
  );
  assert.ok(moment.ra >= 0 && moment.ra < 24);
  assert.ok(Math.abs(moment.dec) < 29);
  assert.ok(moment.azimuth >= 0 && moment.azimuth < 360);
});

void test('illumination, age and the waxing flag follow one lunation end to end', () => {
  const start = Date.parse('2026-01-01T00:00:00Z');
  const quarters = moonQuarters(start, 4);
  const [first, second, third, fourth] = quarters;
  // Four consecutive quarters advance by roughly a week and cycle the names.
  for (const [before, after] of [
    [first, second],
    [second, third],
    [third, fourth],
  ]) {
    const gap = (after.time - before.time) / DAY_MS;
    assert.ok(gap > 5.5 && gap < 9, `gap ${gap}`);
    assert.equal(after.quarter, (before.quarter + 1) % 4);
    assert.equal(after.name, quarterNames[after.quarter]);
  }
  for (const quarter of quarters) {
    const moment = moonMomentAt(quarter.time, beijing);
    const expected = [0, 90, 180, 270][quarter.quarter];
    const offset = Math.abs(((moment.elongation - expected + 540) % 360) - 180);
    assert.ok(
      offset < 0.05,
      `${quarter.name}: elongation ${moment.elongation}`,
    );
    assert.equal(moment.phase, quarter.name);
    // Illumination is the projected fraction of the lit hemisphere.
    const projected = (1 - Math.cos((moment.elongation * Math.PI) / 180)) / 2;
    assert.ok(
      Math.abs(moment.illumination - projected) < 0.01,
      `${quarter.name}: ${moment.illumination} vs ${projected}`,
    );
    assert.equal(moment.waxing, moment.elongation < 180);
  }
  const full = quarters.find((q) => q.quarter === 2)!;
  assert.ok(moonMomentAt(full.time, beijing).illumination > 0.995);
});

void test('the quarter series stays ordered and stops at the end of the supported range', () => {
  const events = moonQuarters(Date.parse('2026-09-20T00:00:00Z'));
  assert.equal(events.length, QUARTER_LIST_SIZE);
  for (let index = 1; index < events.length; index++)
    assert.ok(events[index].time > events[index - 1].time);
  assert.ok(events[0].time > Date.parse('2026-09-20T00:00:00Z'));
  // Three lunations is a little under 89 days.
  const span = (events.at(-1)!.time - events[0].time) / DAY_MS;
  assert.ok(span > 78 && span < 84, `span ${span}`);
  assert.equal(moonQuarters(MAX_TIME - DAY_MS, QUARTER_LIST_SIZE).length, 0);
  assert.throws(() => moonQuarters(MIN_TIME - DAY_MS));
});

void test('the drawn disc encloses exactly the illuminated fraction, mirrored when waning', () => {
  const radius = 100;
  const area = (elongation: number) => {
    const { path } = phaseDiscPath(elongation, radius);
    // Semicircle plus or minus the terminator's half-ellipse, as drawn.
    const width = Number(path.split('A')[2].trim().split(' ')[0]);
    const sweep = Number(path.split('A')[2].trim().split(' ')[4]);
    const half = (Math.PI * radius * radius) / 2;
    const lens = (Math.PI * width * radius) / 2;
    return (half + (sweep === 1 ? lens : -lens)) / (Math.PI * radius * radius);
  };
  for (let elongation = 0; elongation < 360; elongation += 7.5) {
    const expected = (1 - Math.cos((elongation * Math.PI) / 180)) / 2;
    assert.ok(
      Math.abs(area(elongation) - expected) < 0.002,
      `${elongation}°: ${area(elongation)} vs ${expected}`,
    );
  }
  // The quarters collapse the terminator to a straight line, which SVG draws
  // for a zero-width arc.
  assert.match(phaseDiscPath(90, radius).path, /A 0 100 0 0 0 0 -100/);
  assert.match(phaseDiscPath(270, radius).path, /A 0 100 0 0 0 0 -100/);
  // A waning Moon reuses the waxing shape; only the flag flips it.
  assert.equal(phaseDiscPath(60, radius).path, phaseDiscPath(300, radius).path);
  assert.equal(phaseDiscPath(60, radius).waxing, true);
  assert.equal(phaseDiscPath(300, radius).waxing, false);
});

void test('the observing window is the Moon above the horizon inside the coming night', () => {
  // A waxing gibbous evening: the Moon is already up when the Sun sets.
  const window = moonObservingWindow(
    Date.parse('2026-09-20T09:00:00Z'),
    beijing,
  );
  assert.equal(window.note, '');
  assert.ok(window.start !== null && window.end !== null);
  assert.ok(window.nightStart < window.nightEnd);
  assert.ok(window.start! >= window.nightStart);
  assert.ok(window.end! <= window.nightEnd);
  // Astronomical darkness sits inside the night it belongs to.
  assert.ok(window.darkStart !== null && window.darkEnd !== null);
  assert.ok(window.darkStart! > window.nightStart);
  assert.ok(window.darkEnd! < window.nightEnd);
  assert.ok(window.darkStart! < window.darkEnd!);
  // The Moon really is up across the window and down outside the night.
  const observer = new Observer(
    beijing.latitude,
    beijing.longitude,
    beijing.height,
  );
  assert.ok(window.best !== null);
  assert.ok(
    window.best!.time >= window.start! && window.best!.time <= window.end!,
  );
  assert.ok(
    window.best!.altitude > 0,
    `best altitude ${window.best!.altitude}`,
  );
  // Nothing inside the window stands higher than the moment reported as best.
  for (let step = 0; step <= 12; step++) {
    const sample = window.start! + ((window.end! - window.start!) * step) / 12;
    assert.ok(
      altitude(Body.Moon, sample, observer) <= window.best!.altitude + 0.01,
      `sample ${iso(sample)}`,
    );
  }
  assert.equal(window.phase, moonMomentAt(window.best!.time, beijing).phase);
  assert.ok(window.illumination > 0 && window.illumination <= 1);
  // The night it answers is the one that opens at the sunset around that moment.
  const sunset = SearchRiseSet(
    Body.Sun,
    observer,
    -1,
    new Date(Date.parse('2026-09-20T09:00:00Z')),
    2,
  )!;
  assert.equal(iso(window.nightStart), iso(sunset.date.getTime()));
});

void test('a night already under way is the one answered, not the following one', () => {
  const evening = Date.parse('2026-09-20T14:00:00Z'); // 22:00 local, after sunset
  const window = moonObservingWindow(evening, beijing);
  assert.ok(window.nightStart < evening && window.nightEnd > evening);
});

void test('polar day and polar night are reported rather than invented', () => {
  // Midsummer above the Arctic Circle: the Sun does not set.
  const midsummer = moonObservingWindow(Date.parse('2026-06-21T12:00:00Z'), {
    ...fairbanks,
    latitude: 71.29,
    longitude: -156.79,
  });
  assert.equal(midsummer.note, observingNotes.polarDay);
  assert.equal(midsummer.start, null);
  assert.equal(midsummer.best, null);
  // Midwinter at the same place: the Sun does not rise.
  const midwinter = moonObservingWindow(Date.parse('2026-12-21T12:00:00Z'), {
    ...fairbanks,
    latitude: 71.29,
    longitude: -156.79,
  });
  assert.equal(midwinter.note, observingNotes.polarNight);
  assert.equal((midwinter.nightEnd - midwinter.nightStart) / DAY_MS, 1);
});

void test('a month of rows carries every field, keeps local days and flags skipped events', () => {
  const month = lunarMonth({ ...beijing, month: '2026-09' });
  assert.equal(month.days.length, 30);
  assert.equal(month.month, '2026-09');
  assert.equal(month.previous, '2026-08');
  assert.equal(month.next, '2026-10');
  month.days.forEach((day, index) => {
    assert.match(day.day, /^2026-09-\d{2}$/);
    assert.equal(day.day.slice(-2), String(index + 1).padStart(2, '0'));
    // Local noon really is noon at the observer's fixed offset.
    assert.equal(
      new Date(day.noon + beijing.utcOffset * 3600000)
        .toISOString()
        .slice(11, 16),
      '12:00',
    );
    assert.ok(day.age >= 0 && day.age < 30, `age ${day.age}`);
    assert.ok(day.illumination >= 0 && day.illumination <= 1);
    assert.equal(day.phase, phaseName(day.elongation));
    assert.ok(day.distanceKm > 356_000 && day.distanceKm < 407_000);
    assert.ok(day.apparentDiameter > 29 && day.apparentDiameter < 34);
    assert.ok(day.ra >= 0 && day.ra < 24 && Math.abs(day.dec) < 29);
    for (const event of [day.rise, day.set])
      if (event !== null) {
        const local = new Date(event + beijing.utcOffset * 3600000)
          .toISOString()
          .slice(0, 10);
        assert.equal(local, day.day);
      }
    if (day.transit) {
      assert.ok(day.transit.azimuth >= 0 && day.transit.azimuth < 360);
      assert.ok(Math.abs(day.transit.altitude) <= 90);
    }
  });
  // The Moon rises about fifty minutes later each day, so within one month it
  // skips a rise and a set; that is the fact the empty cells report.
  assert.ok(month.days.some((day) => day.rise === null));
  assert.ok(month.days.some((day) => day.set === null));
  // Age runs up and resets at the new moon rather than wrapping mid-month.
  const resets = month.days.filter(
    (day, index) => index > 0 && day.age < month.days[index - 1].age,
  );
  assert.equal(resets.length, 1);
});

void test('principal phases and lunar eclipses are marked on the local day they fall on', () => {
  const month = lunarMonth({ ...beijing, month: '2026-09' });
  const marked = month.days.filter((day) => day.quarter);
  assert.ok(marked.length >= 3 && marked.length <= 5);
  for (const day of marked) {
    assert.equal(
      new Date(day.quarter!.time + beijing.utcOffset * 3600000)
        .toISOString()
        .slice(0, 10),
      day.day,
    );
    assert.equal(day.quarter!.name, quarterNames[day.quarter!.quarter]);
  }
  // The next total lunar eclipse after 2026 is 2028-12-31; the pair of 2025
  // eclipses is what a reader checks the marking against.
  const march = lunarMonth({ ...beijing, month: '2025-03' });
  const eclipse = march.days.find((day) => day.eclipse);
  assert.ok(eclipse, 'March 2025 holds a total lunar eclipse');
  assert.equal(eclipse!.day, '2025-03-14');
  assert.equal(eclipse!.eclipse!.kind, '月全食');
  // A total eclipse buries the whole disc in the umbra: obscuration reaches 1.
  assert.equal(eclipse!.eclipse!.obscuration, 1);
  // A month with no lunar eclipse carries no marks at all.
  assert.ok(month.days.every((day) => !day.eclipse));
  // A penumbral eclipse never reaches the umbra, so its obscuration is zero:
  // the calendar must mark the day without printing that as a depth.
  const penumbral = lunarMonth({ ...beijing, month: '2027-02' }).days.find(
    (day) => day.eclipse,
  );
  assert.equal(penumbral!.eclipse!.kind, '月半影食');
  assert.equal(penumbral!.eclipse!.obscuration, 0);
});

void test('the observation point moves the local calendar without moving the sky', () => {
  const east = lunarMonth({ ...beijing, month: '2026-09' });
  const west = lunarMonth({
    ...beijing,
    longitude: -74.006,
    latitude: 40.7128,
    utcOffset: -4,
    month: '2026-09',
  });
  // A quarter is one instant; the two places may file it under different days.
  const eastFull = east.days.find((day) => day.quarter?.quarter === 2)!;
  const westFull = west.days.find((day) => day.quarter?.quarter === 2)!;
  assert.equal(eastFull.quarter!.time, westFull.quarter!.time);
  assert.notEqual(eastFull.day, westFull.day);
  // Rise and set are the observer's own, so they differ; the disc is not.
  assert.notEqual(east.days[0].rise, west.days[0].rise);
  assert.ok(
    Math.abs(east.days[0].illumination - west.days[0].illumination) < 0.05,
  );
});

void test('months are validated, stepped and read back from a moment', () => {
  assert.equal(monthForTime(Date.parse('2026-09-20T18:00:00Z'), 8), '2026-09');
  // Late UTC on the last of the month is already the next month locally.
  assert.equal(monthForTime(Date.parse('2026-09-30T18:00:00Z'), 8), '2026-10');
  assert.equal(monthForTime(Date.parse('2026-10-01T02:00:00Z'), -8), '2026-09');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('1700-01', -1), null);
  assert.equal(shiftMonth('2200-12', 1), null);
  assert.equal(lunarMonth({ ...beijing, month: '2200-12' }).next, null);
  assert.equal(lunarMonth({ ...beijing, month: '1700-01' }).previous, null);
  assert.equal(lunarMonth({ ...beijing, month: '2024-02' }).days.length, 29);
  assert.equal(lunarMonth({ ...beijing, month: '2026-02' }).days.length, 28);
  for (const bad of ['2026-1', '2026/09', '1699-12', '2201-01', ''])
    assert.throws(() => validateMonth(bad), `accepted ${bad}`);
  assert.throws(() =>
    lunarMonth({ ...beijing, latitude: 95, month: '2026-09' }),
  );
  assert.throws(() => moonMomentAt(MAX_TIME + DAY_MS, beijing));
});

void test('a high-latitude month still answers, and every value stays finite', () => {
  const month = lunarMonth({ ...fairbanks, month: '2026-12' });
  assert.equal(month.days.length, 31);
  for (const day of month.days) {
    for (const value of [
      day.age,
      day.illumination,
      day.elongation,
      day.distanceKm,
      day.apparentDiameter,
      day.ra,
      day.dec,
    ])
      assert.ok(Number.isFinite(value), `${day.day}: ${value}`);
  }
  const window = moonObservingWindow(
    Date.parse('2026-12-20T06:00:00Z'),
    fairbanks,
  );
  assert.ok(Number.isFinite(window.nightStart));
  assert.ok(window.nightEnd > window.nightStart);
});
