import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AstroTime,
  Ecliptic,
  GeoMoon,
  GeoMoonState,
  HelioState,
  HelioVector,
  JupiterMoons,
  RotateVector,
  Rotation_EQJ_ECL,
  Vector,
  type StateVector,
} from 'astronomy-engine';
import { bodyMotion } from '../lib/body-motion.ts';
import { bodies } from '../lib/solar.ts';
import { comets, cometElements, cometPosition } from '../lib/comets.ts';
import { asteroids, asteroidPosition } from '../lib/asteroids.ts';
import { orbitingMoons } from '../lib/moon-orbits.ts';
import { moonSemimajorKm, moonVectorKm } from '../lib/satellite-elements.ts';
import { astroBodies } from '../lib/ephemeris.ts';
import { AU_SCENE_UNITS } from '../lib/display-scale.ts';
import { AU_KM } from '../lib/eclipse-shadows.ts';
import { physicalParameters } from '../lib/physical-facts.ts';
import { DAY_MS, J2000_MS } from '../lib/simulation-time.ts';

const day = (iso: string) => (Date.parse(iso) - J2000_MS) / DAY_MS;
// Both ends of the supported clock, plus one date inside each catalog's epoch.
const dates = [
  '1700-01-01T00:00:00Z',
  '1910-04-20T00:00:00Z',
  '2026-09-20T12:00:00Z',
  '2061-07-28T00:00:00Z',
  '2200-12-31T23:59:59Z',
].map(day);
const eclipticFrame = Rotation_EQJ_ECL();
const precise = new Set(['Moon', 'Io', 'Europa', 'Ganymede', 'Callisto']);
const parentName = Object.fromEntries(bodies.map((b) => [b.id, b.name]));

const speedKmS = (state: StateVector) =>
  Math.hypot(state.vx, state.vy, state.vz) * (AU_KM / 86_400);
/** The scene's fixed J2000 ecliptic longitude, not the true ecliptic of date. */
function longitude(eqj: Vector) {
  const e = RotateVector(eclipticFrame, eqj);
  return ((Math.atan2(e.y, e.x) * 180) / Math.PI + 360) % 360;
}
function separation(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}
/** km^3 kg^-1 s^-2, for reading a parent's GM back out of a rendered orbit. */
const G = 6.674e-20;
/** Speed a two-body orbit holds at radius `r`, from its own mean motion alone. */
function visViva(semimajorKm: number, periodDays: number, r: number) {
  const n = (2 * Math.PI) / (periodDays * 86_400);
  return Math.sqrt(n * n * semimajorKm ** 3 * (2 / r - 1 / semimajorKm));
}
const kmFromScene = (scene: readonly number[]) =>
  (Math.hypot(...scene) / AU_SCENE_UNITS) * AU_KM;

void test('planet readouts carry the ephemeris velocity and the scene ecliptic longitude', () => {
  for (const date of dates)
    for (const body of bodies) {
      const motion = bodyMotion(body.id, date);
      if (body.id === 'sun') {
        assert.equal(motion, null);
        continue;
      }
      assert.ok(motion, body.id);
      assert.equal(motion.center, '太阳');
      const exact = speedKmS(HelioState(astroBodies[body.id], date));
      // Pluto interpolates a cached integration, so it trails the analytic set.
      assert.ok(
        Math.abs(motion.speed - exact) < 1e-3,
        `${body.id} ${motion.speed} vs ${exact}`,
      );
      assert.ok(
        separation(
          motion.longitude,
          longitude(HelioVector(astroBodies[body.id], date)),
        ) < 1e-9,
        `${body.id} longitude`,
      );
      assert.ok(motion.longitude >= 0 && motion.longitude < 360, body.id);
    }
});

void test('the readout frame is anchored to the J2000 ecliptic, where it meets the ecliptic of date', () => {
  for (const body of bodies.filter((b) => b.id !== 'sun')) {
    const vector = HelioVector(astroBodies[body.id], 0);
    // Only nutation separates the two frames at the epoch itself.
    assert.ok(
      separation(bodyMotion(body.id, 0)!.longitude, Ecliptic(vector).elon) <
        0.01,
    );
    // Precession pulls them apart by the ends of the supported range.
    assert.ok(
      separation(
        bodyMotion(body.id, dates[0])!.longitude,
        Ecliptic(HelioVector(astroBodies[body.id], dates[0])).elon,
      ) > 3,
    );
  }
});

void test('moons orbit their own planet, following the precise lunar and Galilean solutions', () => {
  const galilean = {
    io: 'moon-io',
    europa: 'moon-europa',
    ganymede: 'moon-ganymede',
    callisto: 'moon-callisto',
  } as const;
  for (const date of dates) {
    const lunar = bodyMotion('moon-moon', date)!;
    assert.equal(lunar.center, '地球');
    assert.ok(Math.abs(lunar.speed - speedKmS(GeoMoonState(date))) < 1e-4);
    assert.ok(separation(lunar.longitude, longitude(GeoMoon(date))) < 1e-9);

    const jovian = JupiterMoons(date);
    for (const [key, id] of Object.entries(galilean)) {
      const state = jovian[key as keyof typeof galilean];
      const motion = bodyMotion(id, date)!;
      assert.equal(motion.center, '木星');
      // The published jovicentric velocity leaves out the frame rotation its
      // position carries, so it trails the drawn path by about 0.03%. The
      // readout follows the path, because that is the orbit on screen.
      assert.ok(
        Math.abs(motion.speed - speedKmS(state)) < speedKmS(state) * 5e-4,
        `${id} ${motion.speed} vs ${speedKmS(state)}`,
      );
      assert.ok(
        separation(
          motion.longitude,
          longitude(new Vector(state.x, state.y, state.z, new AstroTime(date))),
        ) < 1e-9,
        id,
      );
    }
    for (const moon of orbitingMoons) {
      const motion = bodyMotion(moon.id, date)!;
      assert.equal(motion.center, parentName[moon.parentId]);
      assert.ok(motion.longitude >= 0 && motion.longitude < 360, moon.id);
    }
  }
});

void test('every moon speed is the Kepler speed of its own orbit about its planet', () => {
  for (const moon of orbitingMoons) {
    if (precise.has(moon.en)) continue;
    const semimajor = moonSemimajorKm(moon);
    // Reading the gravitational parameter back out of speed, radius and
    // semimajor axis needs no period, so the mean elements that drive the orbit
    // and the catalog entry that names it cannot quietly disagree here.
    const measured = dates.map((date) => {
      const speed = bodyMotion(moon.id, date)!.speed;
      const radius = moonVectorKm(moon, date).length();
      return speed ** 2 / (2 / radius - 1 / semimajor);
    });
    for (const mu of measured)
      assert.ok(
        Math.abs(mu - measured[0]) < measured[0] * 1e-5,
        `${moon.id} ${mu} vs ${measured[0]}`,
      );
    // Charon carries a ninth of the pair's mass, so it runs furthest above the
    // planet's own GM; the rest sit within a fraction of a percent of it.
    const parent = G * physicalParameters[moon.parentId].mass;
    assert.ok(
      Math.abs(measured[0] - parent) < parent * 0.15,
      `${moon.id} ${measured[0]} vs ${parent}`,
    );
  }
});

void test('comets and asteroids keep the heliocentric speed their own snapshot orbit implies', () => {
  for (const date of dates) {
    for (const comet of comets) {
      const { au, period } = cometElements(comet);
      const motion = bodyMotion(comet.id, date)!;
      assert.equal(motion.center, '太阳');
      assert.ok(motion.longitude >= 0 && motion.longitude < 360, comet.id);
      const expected = visViva(
        au * AU_KM,
        period,
        kmFromScene(cometPosition(comet, date)),
      );
      assert.ok(
        Math.abs(motion.speed - expected) < expected * 1e-4,
        `${comet.id} ${motion.speed} vs ${expected}`,
      );
    }
    for (const asteroid of asteroids) {
      const { au, period } = asteroid.orbit;
      const motion = bodyMotion(asteroid.id, date)!;
      assert.equal(motion.center, '太阳');
      assert.ok(motion.longitude >= 0 && motion.longitude < 360, asteroid.id);
      const expected = visViva(
        au * AU_KM,
        period,
        kmFromScene(asteroidPosition(asteroid, date, 'distance')),
      );
      assert.ok(
        Math.abs(motion.speed - expected) < expected * 1e-4,
        `${asteroid.id} ${motion.speed} vs ${expected}`,
      );
    }
  }
});

void test('bodies without an orbit of their own report nothing', () => {
  assert.equal(bodyMotion('sun', 0), null);
  assert.equal(bodyMotion('kuiper', 0), null);
  assert.equal(bodyMotion('', 0), null);
});
