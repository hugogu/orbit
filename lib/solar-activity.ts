// Procedural teaching model, not observed active regions or a space-weather forecast.
// Timescales: NASA's /image-article/what-solar-prominence/ and /sun/sunspots/.
export const SOLAR_ACTIVITY_SLOTS = 10;
export const SOLAR_REFERENCE_RATE = 14.1844; // IAU solar prime meridian, deg/day.
const radians = Math.PI / 180;
const turn = Math.PI * 2;

function random(seed: number) {
  let value = Math.imul(seed ^ 0x45d9f3b, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
export function activityEnvelope(age: number, lifetime: number, rise = 1) {
  if (age <= 0 || age >= lifetime) return 0;
  return (
    smooth(age / rise) * smooth((lifetime - age) / Math.max(1, lifetime * 0.2))
  );
}

// Approximation of the observed latitude dependence, 25 d equator to 36 d poles.
export function solarRotationRate(latitude: number) {
  return 360 / (25 + 11 * Math.sin(latitude) ** 2);
}
export function solarSurfacePoint(
  latitude: number,
  longitude: number,
): [number, number, number] {
  return [
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    -Math.cos(latitude) * Math.sin(longitude),
  ];
}
export function solarActivityRegion(slot: number, days: number) {
  const cadence = 96 + slot * 4;
  const offset = random(slot + 900) * cadence;
  const generation = Math.floor((days + offset) / cadence);
  const born = generation * cadence - offset;
  const seed = Math.imul(generation, 131) + slot * 7919;
  const sample = (index: number) => random(seed + index * 104729);
  const latitude = (8 + sample(1) * 30) * (slot % 2 ? -1 : 1) * radians;
  const initialLongitude = sample(2) * turn;
  const age = days - born;
  const longitude =
    (initialLongitude +
      (solarRotationRate(latitude) - SOLAR_REFERENCE_RATE) * age * radians) %
    turn;
  const prominenceDays = 14 + sample(3) * 72;
  const sunspotDays = 6 + sample(4) * (slot % 3 === 0 ? 58 : 26);
  const prominence = activityEnvelope(age, prominenceDays);
  const sunspot = activityEnvelope(age - 0.2, sunspotDays, 1.5);
  return {
    id: `${slot}:${generation}`,
    born,
    age,
    latitude,
    longitude,
    prominenceDays,
    sunspotDays,
    prominence,
    sunspot,
    height: 0.1 + sample(5) * 0.16,
    spotRadius: (0.018 + sample(6) * 0.024) * Math.sqrt(sunspot),
    tilt: (sample(7) - 0.5) * 1.2,
    phase: sample(8) * turn,
  };
}
export function solarActivityAt(days: number) {
  return Array.from({ length: SOLAR_ACTIVITY_SLOTS }, (_, slot) =>
    solarActivityRegion(slot, days),
  );
}
