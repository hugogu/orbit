import { bodies, orbitPosition, type ScaleMode } from './solar';
import { moonSystems } from './moons';

// Approximate periods (days), display radii, display semimajor axes and colors.
// JPL mean elements: https://ssd.jpl.nasa.gov/sats/elem/ . Sizes/distances are exaggerated.
const parameters: Record<
  string,
  [number, number, number, string, number?, number?]
> = {
  Moon: [27.322, 0.26, 2.5, '#c5c6cb'],
  Phobos: [0.31891, 0.13, 1.5, '#a99683'],
  Deimos: [1.26244, 0.1, 2.3, '#c0ac94'],
  Io: [1.769, 0.4, 5.2, '#e0c05e'],
  Europa: [3.551, 0.34, 7, '#d4c5ab'],
  Ganymede: [7.155, 0.53, 9.1, '#a99c89'],
  Callisto: [16.689, 0.48, 11.5, '#8a827d'],
  Titan: [15.945, 0.52, 10.7, '#d6a04e'],
  Enceladus: [1.37, 0.2, 7, '#edf6ff'],
  Mimas: [0.942, 0.17, 6.1, '#c6c6cb'],
  Iapetus: [79.321, 0.28, 14, '#9e9588'],
  Miranda: [1.413, 0.17, 3.0, '#b3b0a8'],
  Ariel: [2.52, 0.24, 4.2, '#d0d4d3'],
  Umbriel: [4.144, 0.24, 5.4, '#777979'],
  Titania: [8.706, 0.32, 6.8, '#bbb3a5'],
  Oberon: [13.463, 0.31, 8.3, '#a6968c'],
  Triton: [5.877, 0.38, 4.1, '#dbc6c4', 157],
  Nereid: [360.13, 0.15, 20, '#aaa6a1', 7, 0.751],
  Charon: [6.387, 0.23, 2.1, '#aaa6a2'],
};
export const orbitingMoons = Object.entries(moonSystems).flatMap(
  ([parentId, system]) =>
    system.moons.map((moon, index) => {
      const [period, size, distance, color, inc = 0, e = 0] =
        parameters[moon.en];
      return {
        ...moon,
        id: `moon-${moon.en.toLowerCase()}`,
        parentId,
        period,
        size,
        distance,
        color,
        inc,
        e,
        phase: 0.7 + index * 1.7,
        au: 0,
      };
    }),
);
export type OrbitingMoon = (typeof orbitingMoons)[number];

export function moonOffset(
  moon: OrbitingMoon,
  days: number,
  scale: ScaleMode,
): [number, number, number] {
  const p = orbitPosition(moon, days);
  const parent = bodies.find((b) => b.id === moon.parentId)!;
  const tilt =
    ((moon.parentId === 'earth' ? 5.1 : parent.tilt) * Math.PI) / 180;
  const factor = scale === 'distance' ? 0.32 : 1;
  return [
    (p[0] * Math.cos(tilt) - p[1] * Math.sin(tilt)) * factor,
    (p[0] * Math.sin(tilt) + p[1] * Math.cos(tilt)) * factor,
    p[2] * factor,
  ];
}
export function moonSystemExtent(parentId: string, scale: ScaleMode) {
  return (
    Math.max(
      0,
      ...orbitingMoons
        .filter((m) => m.parentId === parentId)
        .map((m) => m.distance * (1 + m.e) + m.size),
    ) * (scale === 'distance' ? 0.32 : 1)
  );
}
