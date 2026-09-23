import {
  AstroTime,
  Body,
  Equator,
  Observer,
  RotateVector,
  Rotation_HOR_EQJ,
  Vector,
} from 'astronomy-engine';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { astroBodies, sceneVector } from './ephemeris';
import { bodies, type ScaleMode } from './solar';
import type { SkyLocation } from './sky-events';
import { AU_KM } from './eclipse-shadows';

export const groundBodies = [
  ...bodies.filter((body) => body.id !== 'earth'),
  {
    id: 'moon-moon',
    name: '月球',
    radius: 1737.4,
    texture: 'moon',
    color: '#d8d6cf',
  },
];

/** Local axes are east, zenith, south: a camera looking down -Z faces north. */
export function horizonFrame(days: number, location: SkyLocation) {
  const time = new AstroTime(days);
  const rotation = Rotation_HOR_EQJ(
    time,
    new Observer(location.latitude, location.longitude, location.height),
  );
  const axis = (x: number, y: number, z: number) =>
    new Vector3(
      ...sceneVector(RotateVector(rotation, new Vector(x, y, z, time))),
    );
  const east = axis(0, -1, 0),
    up = axis(0, 0, 1),
    south = axis(-1, 0, 0);
  return {
    east,
    up,
    south,
    rotation: new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(east, up, south),
    ),
  };
}

/** Observer-centred, light-time/aberration-corrected vectors in the star field's fixed frame. */
export function groundBodyVector(
  id: string,
  days: number,
  location: SkyLocation,
) {
  const equatorial = Equator(
    astroBodies[id] ?? Body.Moon,
    days,
    new Observer(location.latitude, location.longitude, location.height),
    false,
    true,
  );
  return new Vector3(...sceneVector(equatorial.vec));
}

/** Both layouts preserve angular size and direction. Only depth is compressed. */
export function groundBodyDisplay(
  id: string,
  vector: Vector3,
  scale: ScaleMode,
  realSizes: boolean,
  radiusKm = groundBodies.find((body) => body.id === id)!.radius,
) {
  const distanceAU = Math.max(vector.length(), 1e-12);
  const distance =
    scale === 'distance' ? distanceAU * 100 : 100 + Math.log1p(distanceAU) * 20;
  const physicalAngle = Math.asin(Math.min(1, radiusKm / (distanceAU * AU_KM)));
  const angle = realSizes
    ? physicalAngle
    : Math.max(
        physicalAngle * 10,
        ((id === 'sun' || id === 'moon-moon' ? 0 : 0.35) * Math.PI) / 180,
      );
  return {
    position: vector.clone().setLength(distance),
    radius: distance * Math.sin(Math.min(Math.PI / 2, angle)),
  };
}
