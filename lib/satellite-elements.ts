import { AstroTime, RotationAxis, Vector } from 'astronomy-engine';
import { Vector3 } from 'three';
import { astroBodies, preciseMoonVector, sceneVector } from './ephemeris';
import { orbitPosition, type ScaleMode } from './solar';
import type { OrbitingMoon } from './moon-orbits';

// JPL mean elements, retrieved 2026-09-07: https://ssd.jpl.nasa.gov/sats/elem/
// a(km), e, argument of periapsis, M, i, node (degrees), period(days),
// Laplace pole RA/Dec(degrees). Null pole means parent equator at J2000.
// Fixed mean elements deliberately omit precession and resonances: approximate only.
type Elements = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  [number, number] | null,
];
const elements: Record<string, Elements> = {
  Phobos: [9375, 0.015, 216.3, 189.7, 1.1, 169.2, 0.3187, [317.7, 52.9]],
  Deimos: [23457, 0, 0, 205, 1.8, 54.3, 1.2625, [316.6, 53.5]],
  Mimas: [186000, 0.02, 160.4, 275.3, 1.6, 66.2, 0.942422, [40.6, 83.5]],
  Enceladus: [238400, 0.005, 119.5, 57, 0, 0, 1.370218, [40.6, 83.5]],
  Titan: [1221900, 0.029, 78.3, 11.7, 0.3, 78.6, 15.945448, [36.4, 84]],
  Iapetus: [3561700, 0.028, 254.5, 74.8, 7.6, 86.5, 79.331002, [288.7, 78.9]],
  Ariel: [190929, 0.001, 9.6, 193.5, 0, 0, 2.520379, null],
  Umbriel: [265986, 0.004, 183.4, 253, 0.1, 174.8, 4.144177, null],
  Titania: [436298, 0.002, 184, 68.1, 0.1, 29.5, 8.705869, null],
  Oberon: [583511, 0.002, 132.2, 143.6, 0.1, 76.8, 13.463237, null],
  Miranda: [129846, 0.001, 154.8, 73, 4.4, 100.9, 1.413479, null],
  Triton: [354800, 0, 0, 63, 157.3, 178.1, 5.876994, [299.8, 43.1]],
  Nereid: [5513900, 0.751, 296.8, 318.5, 5.1, 319.5, 360.133039, null],
  Charon: [19600, 0, 0, 304.1, 0, 0, 6.387222, null],
};
const DEG = Math.PI / 180;
const AU_KM = 149597870.7;
const preciseAxes: Record<string, number> = {
  Moon: 384400,
  Io: 421800,
  Europa: 671100,
  Ganymede: 1070400,
  Callisto: 1882700,
};

export function moonVectorKm(moon: OrbitingMoon, days: number): Vector3 {
  const semimajor = preciseAxes[moon.en] ?? elements[moon.en][0];
  return new Vector3(
    ...datedMoonOffset(moon, days, 'illustrated'),
  ).multiplyScalar(semimajor / moon.distance);
}

export function datedMoonOffset(
  moon: OrbitingMoon,
  days: number,
  scale: ScaleMode,
): [number, number, number] {
  const precise = preciseMoonVector(moon.en, days);
  let v: Vector3;
  if (precise) {
    v = new Vector3(...sceneVector(precise)).multiplyScalar(
      AU_KM / preciseAxes[moon.en],
    );
  } else {
    const [, e, w, m, i, node, period, pole] = elements[moon.en];
    const time = new AstroTime(days);
    // Mean elements use TDB epochs; TT is a sub-second approximation to TDB here.
    const elapsed = time.tt - (moon.en === 'Nereid' ? 7304.5 : 0);
    const p = orbitPosition(
      { au: 1, distance: 1, e, inc: 0, phase: m * DEG, period },
      elapsed,
    );
    v = new Vector3(p[0], -p[2], 0)
      .applyAxisAngle(new Vector3(0, 0, 1), w * DEG)
      .applyAxisAngle(new Vector3(1, 0, 0), i * DEG)
      .applyAxisAngle(new Vector3(0, 0, 1), node * DEG);
    if (moon.en === 'Nereid') {
      v.set(v.x, v.z, -v.y);
    } else {
      const axis = RotationAxis(astroBodies[moon.parentId], 0);
      const ra = (pole?.[0] ?? axis.ra * 15) * DEG,
        dec = (pole?.[1] ?? axis.dec) * DEG;
      const north = new Vector3(
        Math.cos(dec) * Math.cos(ra),
        Math.cos(dec) * Math.sin(ra),
        Math.sin(dec),
      );
      const x = new Vector3(-Math.sin(ra), Math.cos(ra), 0);
      const y = north.clone().cross(x);
      const eqj = x
        .multiplyScalar(v.x)
        .addScaledVector(y, v.y)
        .addScaledVector(north, v.z);
      v.set(...sceneVector(new Vector(eqj.x, eqj.y, eqj.z, time)));
    }
  }
  return v
    .multiplyScalar(moon.distance * (scale === 'distance' ? 0.32 : 1))
    .toArray();
}
