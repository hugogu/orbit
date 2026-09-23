/**
 * The satellites a sandbox run can carry.
 *
 * The large moons of the catalogue, every one over 500 km in radius. The run
 * shares one step, set by its tightest orbit, so the smallest moons would
 * cost the most while mattering least: Mimas, Enceladus and Miranda weigh
 * 10¹⁹–10²⁰ kg, too little to move anything around them, yet their day-long
 * orbits would make every step of the run nearly twice as fine as Io needs,
 * and Phobos's seven-hour one more than five times as fine.
 *
 * Masses come from JPL's satellite gravitational parameters, taken as a
 * ratio to the Sun's so that no value of G enters; the Moon's is Astronomy
 * Engine's own, so Earth plus Moon is exactly the Earth–Moon barycentre the
 * run otherwise carries. Starting states come from the ephemeris the explorer
 * draws the moons with — Astronomy Engine for the Moon and the Galilean moons,
 * JPL mean elements for the rest — so a run forks from the sky on screen.
 */
import { Body as AstroBody, MassProduct } from 'astronomy-engine';
import { AU_KM, moonRadii } from '../eclipse-shadows';
import { orbitingMoons, type OrbitingMoon } from '../moon-orbits';
import { moonVectorKm } from '../satellite-elements';
import { GRAVITY, SOLAR_MASS_KG, type Vec3 } from './physics';

/** GM in km³/s², JPL Solar System Dynamics satellite physical parameters. */
const gravitationalParameters: Record<string, number> = {
  Io: 5959.9155,
  Europa: 3202.7121,
  Ganymede: 9887.8328,
  Callisto: 7179.2834,
  Titan: 8978.1382,
  Iapetus: 120.5038,
  Ariel: 83.5,
  Umbriel: 85.1,
  Titania: 226.9,
  Oberon: 205.3,
  Triton: 1427.6,
  Charon: 105.88,
};

const SECONDS_PER_DAY = 86_400;

/** A GM in km³/s² as a mass in kilograms, on the integrator's own scale. */
function massFromParameter(gm: number) {
  const perDay = (gm * SECONDS_PER_DAY ** 2) / AU_KM ** 3;
  return (perDay / GRAVITY) * SOLAR_MASS_KG;
}

export type SandboxMoon = OrbitingMoon & {
  /** Kilograms. */
  massKg: number;
  /** Mean radius in kilometres. */
  radiusKm: number;
};

export const sandboxMoons: SandboxMoon[] = orbitingMoons.flatMap((moon) => {
  const massKg =
    moon.en === 'Moon'
      ? (MassProduct(AstroBody.Moon) / GRAVITY) * SOLAR_MASS_KG
      : gravitationalParameters[moon.en] === undefined
        ? null
        : massFromParameter(gravitationalParameters[moon.en]);
  return massKg === null
    ? []
    : [{ ...moon, massKg, radiusKm: moonRadii[moon.en] }];
});

/** Half the interval the velocity is differenced over, in days. */
const DIFFERENCE_DAYS = 1e-3;

/**
 * A moon's place and motion relative to its planet, in AU and AU/day on the
 * scene axes. The velocity is differenced from the very positions the
 * explorer draws rather than read from a published one: Astronomy Engine's
 * Galilean velocities trail the derivative of its positions by about 0.03%,
 * and the mean-element moons publish none.
 */
export function moonState(
  moon: OrbitingMoon,
  days: number,
): { position: Vec3; velocity: Vec3 } {
  const here = moonVectorKm(moon, days);
  const before = moonVectorKm(moon, days - DIFFERENCE_DAYS);
  const after = moonVectorKm(moon, days + DIFFERENCE_DAYS);
  const motion = after.sub(before).divideScalar(2 * DIFFERENCE_DAYS);
  return {
    position: [here.x / AU_KM, here.y / AU_KM, here.z / AU_KM],
    velocity: [motion.x / AU_KM, motion.y / AU_KM, motion.z / AU_KM],
  };
}
