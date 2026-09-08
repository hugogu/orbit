import { Vector3 } from 'three';
import { bodies, type ScaleMode } from './solar';
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
export function displayRadius(
  id: string,
  scale: ScaleMode,
  realSizes: boolean,
) {
  const body = bodies.find((b) => b.id === id);
  const moon = orbitingMoons.find((m) => m.id === id);
  const radius = body?.radius ?? (moon ? moonRadii[moon.en] : 1);
  const size = body?.size ?? moon?.size ?? 1;
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
