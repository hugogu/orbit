import { Body, Illumination } from 'astronomy-engine';

/** Signed geocentric opening angle in degrees, independent of scene scale. */
export function saturnRingTilt(time: number) {
  return Illumination(Body.Saturn, new Date(time)).ring_tilt!;
}
