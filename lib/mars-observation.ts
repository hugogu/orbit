import { Body, Illumination, KM_PER_AU } from 'astronomy-engine';
import { bodies } from './solar';

const radiusKm = bodies.find((body) => body.id === 'mars')!.radius;

/** Apparent spherical disc at Earth's centre, using light-time corrected ephemeris. */
export function marsObservation(time: number) {
  const distanceAu = Illumination(Body.Mars, new Date(time)).geo_dist;
  const distanceKm = distanceAu * KM_PER_AU;
  const diameterArcsec =
    2 * Math.atan(radiusKm / distanceKm) * (180 / Math.PI) * 3600;
  return { distanceAu, distanceKm, diameterArcsec };
}
