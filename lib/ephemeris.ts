import {
  AstroTime,
  Body as AstroBody,
  HelioVector,
  GeoMoon,
  JupiterMoons,
  RotationAxis,
  Rotation_EQJ_ECL,
  RotateVector,
  Vector,
  Observer,
  ObserverVector,
} from 'astronomy-engine';
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Body, ScaleMode } from './solar';

export const astroBodies: Record<string, AstroBody> = {
  sun: AstroBody.Sun,
  mercury: AstroBody.Mercury,
  venus: AstroBody.Venus,
  earth: AstroBody.Earth,
  mars: AstroBody.Mars,
  jupiter: AstroBody.Jupiter,
  saturn: AstroBody.Saturn,
  uranus: AstroBody.Uranus,
  neptune: AstroBody.Neptune,
  pluto: AstroBody.Pluto,
  'moon-moon': AstroBody.Moon,
};
const eqjToEcliptic = Rotation_EQJ_ECL();
export function sceneVector(v: Vector): [number, number, number] {
  const e = RotateVector(eqjToEcliptic, v);
  return [e.x, e.z, -e.y];
}
// A direction has no epoch; the rotation between the two fixed J2000 frames
// is the same at every instant, so one stand-in time serves them all.
const fixedFrameTime = new AstroTime(0);
/** Rotate a fixed EQJ direction, such as a catalogued star, into scene axes. */
export function sceneDirection(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return sceneVector(new Vector(x, y, z, fixedFrameTime));
}
export function planetPosition(
  body: Body,
  days: number,
  scale: ScaleMode,
): [number, number, number] {
  const v = sceneVector(HelioVector(astroBodies[body.id], days));
  const factor =
    scale === 'distance' ? 3.1 : body.au ? body.distance / body.au : 0;
  return v.map((x) => x * factor) as [number, number, number];
}

// Local +X is the prime meridian, +Y the IAU pole. EQJ -> fixed J2000 ecliptic.
export function bodyOrientation(id: string, days: number): Quaternion {
  const axis = RotationAxis(astroBodies[id], days);
  const ra = (axis.ra * Math.PI) / 12;
  const node = new Vector3(-Math.sin(ra), Math.cos(ra), 0);
  const north = new Vector3(
    axis.north.x,
    axis.north.y,
    axis.north.z,
  ).normalize();
  const tangent = north.clone().cross(node).normalize();
  const w = ((axis.spin % 360) * Math.PI) / 180;
  const prime = node
    .multiplyScalar(Math.cos(w))
    .addScaledVector(tangent, Math.sin(w));
  const toScene = (v: Vector3) =>
    new Vector3(...sceneVector(new Vector(v.x, v.y, v.z, axis.north.t)));
  const x =
    id === 'earth'
      ? new Vector3(
          ...sceneVector(ObserverVector(days, new Observer(0, 0, 0), false)),
        ).normalize()
      : toScene(prime).normalize();
  const y = toScene(north).normalize();
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(x, y, x.clone().cross(y).normalize()),
  );
}

// Astronomy Engine's lunar and Galilean solutions include perturbations.
let jovianTime = NaN;
let jovian: ReturnType<typeof JupiterMoons>;
export function preciseMoonVector(name: string, days: number): Vector | null {
  if (name === 'Moon') return GeoMoon(days);
  const key = (
    {
      Io: 'io',
      Europa: 'europa',
      Ganymede: 'ganymede',
      Callisto: 'callisto',
    } as const
  )[name as 'Io'];
  if (!key) return null;
  if (jovianTime !== days) {
    jovian = JupiterMoons(days);
    jovianTime = days;
  }
  const v = jovian[key];
  return new Vector(v.x, v.y, v.z, new AstroTime(days));
}
