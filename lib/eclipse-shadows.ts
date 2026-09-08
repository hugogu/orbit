import { HelioVector } from 'astronomy-engine';
import { Vector3 } from 'three';
import { astroBodies, sceneVector, bodyOrientation } from './ephemeris';
import { bodies } from './solar';
import { orbitingMoons } from './moon-orbits';
import { moonVectorKm } from './satellite-elements';

export const SUN_RADIUS_KM = 695700;
export const AU_KM = 149597870.7;
// Rounded mean radii (km), JPL satellite physical parameters. Spherical approximation.
const moonRadii: Record<string, number> = {
  Moon: 1737.4,
  Phobos: 11.1,
  Deimos: 6.2,
  Io: 1821.6,
  Europa: 1560.8,
  Ganymede: 2631.2,
  Callisto: 2410.3,
  Titan: 2574.7,
  Enceladus: 252.1,
  Mimas: 198.2,
  Iapetus: 734.5,
  Miranda: 235.8,
  Ariel: 578.9,
  Umbriel: 584.7,
  Titania: 788.9,
  Oberon: 761.4,
  Triton: 1353.4,
  Nereid: 170,
  Charon: 606,
};
export type ShadowBody = {
  id: string;
  position: Vector3;
  radius: number;
  size: number;
};
export type ShadowFrame = Map<string, ShadowBody>;
export function shadowFrame(days: number, ids?: string[]): ShadowFrame {
  const frame: ShadowFrame = new Map();
  const parents = orbitingMoons
    .filter((m) => ids?.includes(m.id))
    .map((m) => m.parentId);
  for (const body of bodies.filter(
    (b) =>
      !ids || b.id === 'sun' || ids.includes(b.id) || parents.includes(b.id),
  ))
    frame.set(body.id, {
      id: body.id,
      position: new Vector3(
        ...sceneVector(HelioVector(astroBodies[body.id], days)),
      ).multiplyScalar(AU_KM),
      radius:
        body.id === 'sun'
          ? SUN_RADIUS_KM
          : body.id === 'earth'
            ? 6378.137
            : body.radius,
      size: body.size,
    });
  for (const moon of orbitingMoons.filter((m) => !ids || ids.includes(m.id)))
    frame.set(moon.id, {
      id: moon.id,
      position: frame
        .get(moon.parentId)!
        .position.clone()
        .add(moonVectorKm(moon, days)),
      radius: moonRadii[moon.en],
      size: moon.size,
    });
  return frame;
}
const clamp = (x: number) => Math.max(-1, Math.min(1, x));
export function diskObscuration(
  sunRadius: number,
  occRadius: number,
  separation: number,
): number {
  if (separation >= sunRadius + occRadius) return 0;
  if (separation <= Math.abs(sunRadius - occRadius))
    return Math.min(1, (occRadius / sunRadius) ** 2);
  // Normalize by the solar angular radius to avoid tiny-area cancellation.
  const r = occRadius / sunRadius,
    d = separation / sunRadius;
  const a = Math.acos(clamp((d * d + 1 - r * r) / (2 * d)));
  const b = Math.acos(clamp((d * d + r * r - 1) / (2 * d * r)));
  const lens = Math.sqrt(
    Math.max(0, (-d + 1 + r) * (d + 1 - r) * (d - 1 + r) * (d + 1 + r)),
  );
  return Math.max(0, Math.min(1, (a + r * r * b - lens / 2) / Math.PI));
}
export function obscuration(
  point: Vector3,
  sun: Vector3,
  occ: Vector3,
  radius: number,
): number {
  const s = sun.clone().sub(point),
    o = occ.clone().sub(point);
  const sd = s.length(),
    od = o.length();
  if (od <= radius || od >= sd || s.dot(o) <= 0) return 0;
  const angle = Math.atan2(s.clone().cross(o).length(), s.dot(o));
  return diskObscuration(
    Math.asin(SUN_RADIUS_KM / sd),
    Math.asin(radius / od),
    angle,
  );
}
export function possibleCasters(
  receiver: ShadowBody,
  frame: ShadowFrame,
): ShadowBody[] {
  const toSun = frame.get('sun')!.position.clone().sub(receiver.position);
  const sd = toSun.length();
  return [...frame.values()]
    .filter((other) => {
      if (other.id === receiver.id || other.id === 'sun') return false;
      const o = other.position.clone().sub(receiver.position),
        d = o.length();
      if (d <= receiver.radius + other.radius || d >= sd || o.dot(toSun) <= 0)
        return false;
      return (
        Math.atan2(o.clone().cross(toSun).length(), o.dot(toSun)) <
        Math.asin(SUN_RADIUS_KM / sd) +
          Math.asin(Math.min(1, (other.radius + receiver.radius) / d))
      );
    })
    .sort(
      (a, b) =>
        b.radius / b.position.distanceTo(receiver.position) -
        a.radius / a.position.distanceTo(receiver.position),
    );
}

function sphereHit(
  origin: Vector3,
  direction: Vector3,
  radius: number,
): Vector3 | null {
  const b = origin.dot(direction),
    c = origin.lengthSq() - radius * radius;
  // Cross-product form is more stable for long rays grazing a small sphere.
  const disc = radius * radius - origin.clone().cross(direction).lengthSq();
  if (disc < 0) return null;
  const near = -b - Math.sqrt(disc),
    far = -b + Math.sqrt(disc);
  const t = near > 0 ? near : far > 0 ? far : -1;
  if (t < 0 || c < 0) return null;
  return origin.clone().addScaledVector(direction, t);
}
export function shadowAxisHit(
  receiver: ShadowBody,
  sun: Vector3,
  caster: ShadowBody,
): Vector3 | null {
  const direction = caster.position.clone().sub(sun).normalize();
  return sphereHit(
    caster.position.clone().sub(receiver.position),
    direction,
    receiver.radius,
  );
}
export type BoundaryKind = 'umbra' | 'penumbra' | 'antumbra';
export function shadowBoundary(
  receiver: ShadowBody,
  sun: Vector3,
  caster: ShadowBody,
  kind: BoundaryKind,
  samples = 192,
): (Vector3 | null)[] {
  const axis = caster.position.clone().sub(sun),
    distance = axis.length();
  axis.divideScalar(distance);
  const sine =
    (SUN_RADIUS_KM + (kind === 'penumbra' ? caster.radius : -caster.radius)) /
    distance;
  const cosine = Math.sqrt(1 - sine * sine),
    slope = sine / cosine;
  const x = new Vector3(
    Math.abs(axis.y) < 0.9 ? 0 : 1,
    Math.abs(axis.y) < 0.9 ? 1 : 0,
    0,
  )
    .cross(axis)
    .normalize();
  const y = axis.clone().cross(x);
  const localCaster = caster.position.clone().sub(receiver.position);
  const apex = caster.radius / sine;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const angle = (2 * Math.PI * i) / samples;
    const radial = x
      .clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(y, Math.sin(angle));
    const origin = localCaster
      .clone()
      .addScaledVector(radial, caster.radius / cosine);
    const direction = axis
      .clone()
      .addScaledVector(radial, kind === 'penumbra' ? slope : -slope)
      .normalize();
    const hit = sphereHit(origin, direction, receiver.radius);
    if (!hit) return null;
    const z = hit.clone().sub(localCaster).dot(axis);
    if (
      z < 0 ||
      (kind === 'umbra' && z > apex) ||
      (kind === 'antumbra' && z <= apex)
    )
      return null;
    // Discard the receiver's night side and the far-side sphere intersection.
    if (hit.dot(sun.clone().sub(receiver.position).sub(hit)) <= 0) return null;
    return hit;
  });
}

// Geographic track: previous 90 minutes, expressed in the rotating body's local frame.
// Only bodies with a calibrated rotational ephemeris get a ground track.
export function shadowTrack(
  receiverId: string,
  casterId: string,
  days: number,
): (Vector3 | null)[] {
  if (!astroBodies[receiverId]) return [];
  return Array.from({ length: 46 }, (_, i) => {
    const date = days - (90 - i * 2) / 1440;
    const frame = shadowFrame(date, [receiverId, casterId]),
      target = frame.get(receiverId)!,
      caster = frame.get(casterId)!;
    const hit = shadowAxisHit(target, frame.get('sun')!.position, caster);
    return (
      hit
        ?.divideScalar(target.radius)
        .applyQuaternion(bodyOrientation(receiverId, date).invert()) ?? null
    );
  });
}
