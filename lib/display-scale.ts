import { Vector3 } from 'three';
import { bodies, type ScaleMode } from './solar';
import { asteroids } from './asteroids';
import {
  orbitingMoons,
  type OrbitingMoon,
  moonSystemExtent,
} from './moon-orbits';
import { AU_KM, moonRadii } from './eclipse-shadows';
import {
  datedMoonOffset,
  moonSemimajorKm,
  moonVectorKm,
} from './satellite-elements';

export function kmToScene(scale: ScaleMode) {
  return scale === 'distance' ? 3.1 / AU_KM : 4.8 / 696340;
}
/** Scene units per AU while distances are to scale. */
export const AU_SCENE_UNITS = AU_KM * kmToScene('distance');
// The outer populations are authored as illustrated annuli. Once distances are
// to scale they belong at the heliocentric distances their own region cards
// quote. The Oort cloud is deliberately absent: it starts near 2,000 AU, so no
// placement in this scene is honest and it stays illustrated-only.
export const outerStructures = {
  kuiper: { illustrated: [99, 128], au: [30, 50] },
  scattered: { illustrated: [130, 166], au: [50, 100] },
  heliosphere: { illustrated: [167, 167], au: [120, 120] },
} as const;
export type OuterStructure = keyof typeof outerStructures;
/** Uniform scale that moves an authored band onto its physical distance. */
export function outerStructureScale(id: OuterStructure, scale: ScaleMode) {
  if (scale !== 'distance') return 1;
  const { illustrated, au } = outerStructures[id];
  return ((au[0] + au[1]) * AU_SCENE_UNITS) / (illustrated[0] + illustrated[1]);
}
export function displayRadius(
  id: string,
  scale: ScaleMode,
  realSizes: boolean,
) {
  const body = bodies.find((b) => b.id === id);
  const moon = orbitingMoons.find((m) => m.id === id);
  const asteroid = asteroids.find((item) => item.id === id);
  const radius =
    body?.radius ?? asteroid?.radius ?? (moon ? moonRadii[moon.en] : 1);
  const size = body?.size ?? asteroid?.size ?? moon?.size ?? 1;
  return realSizes
    ? radius * kmToScene(scale)
    : size * (scale === 'distance' ? (id === 'sun' ? 0.09 : 0.32) : 1);
}
export function moonDisplayOffset(
  moon: OrbitingMoon,
  days: number,
  scale: ScaleMode,
  realSizes: boolean,
) {
  return realSizes && scale === 'distance'
    ? moonVectorKm(moon, days).multiplyScalar(kmToScene(scale))
    : new Vector3(...datedMoonOffset(moon, days, scale));
}
export function displaySystemExtent(
  id: string,
  scale: ScaleMode,
  realSizes: boolean,
) {
  if (!realSizes || scale !== 'distance') return moonSystemExtent(id, scale);
  return Math.max(
    0,
    ...orbitingMoons
      .filter((m) => m.parentId === id)
      .map(
        (m) =>
          (moonSemimajorKm(m) * (1 + m.e) + moonRadii[m.en]) * kmToScene(scale),
      ),
  );
}
