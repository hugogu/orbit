import { MathUtils, Vector3 } from 'three';

export type PlanetEventView = { body: string; kind: 'opposition' | 'transit' };
export type FramingSphere = { center: Vector3; radius: number };

/** Frame the actual scene geometry from Earth's side of the Sun–planet line. */
export function framePlanetEvent({
  kind,
  sun,
  earth,
  planet,
  fov,
  aspect,
  compact,
}: {
  kind: PlanetEventView['kind'];
  sun: FramingSphere;
  earth: FramingSphere;
  planet: FramingSphere;
  fov: number;
  aspect: number;
  compact: boolean;
}) {
  const target = planet.center.clone();
  const axis = (kind === 'opposition' ? planet.center : earth.center)
    .clone()
    .sub(sun.center);
  axis.y = 0;
  if (axis.lengthSq() < 1e-12) axis.set(0, 0, 1);
  axis.normalize();
  const north = new Vector3(0, 1, 0);
  const right = north.clone().cross(axis).normalize();
  const tanY = Math.tan(MathUtils.degToRad(fov / 2));
  const tanX = tanY * aspect;
  const horizontal = aspect > 1.2 ? 0.5 : 0.8;
  const vertical = compact ? 0.55 : 0.65;
  const spheres = [sun, earth, planet];
  let result!: { target: Vector3; offset: Vector3; distance: number };
  // Start behind the planet/Earth and lift only enough to reveal the Sun and
  // planet. Earth may overlap the Sun: that makes the alignment easier to read.
  for (const elevation of [15, 25, 35, 50, 65]) {
    const angle = MathUtils.degToRad(elevation);
    const direction = axis
      .clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(north, Math.sin(angle));
    const up = direction.clone().cross(right).normalize();
    const positions = spheres.map(({ center, radius }) => {
      const delta = center.clone().sub(target);
      return {
        x: delta.dot(right),
        y: delta.dot(up),
        depth: delta.dot(direction),
        radius,
      };
    });
    const distance = Math.max(
      ...positions.map(
        ({ x, y, depth, radius }) =>
          depth +
          radius +
          Math.max(
            (Math.abs(x) + radius) / (tanX * horizontal),
            (Math.abs(y) + radius) / (tanY * vertical),
          ),
      ),
    );
    result = { target, offset: direction.multiplyScalar(distance), distance };
    const discs = positions.map(({ x, y, depth, radius }) => ({
      x: x / (distance - depth),
      y: y / (distance - depth),
      radius: radius / (distance - depth - radius),
    }));
    const [solarDisc, earthDisc, planetDisc] = discs;
    const gap = (a: typeof solarDisc, b: typeof solarDisc) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const sunAndPlanetVisible =
      gap(solarDisc, planetDisc) > solarDisc.radius + planetDisc.radius;
    const sunNotCovered =
      gap(solarDisc, earthDisc) + solarDisc.radius > earthDisc.radius;
    if (sunAndPlanetVisible && sunNotCovered) break;
  }
  return result;
}
