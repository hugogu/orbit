import { moonRadii } from './eclipse-shadows';
import { physicalParameters } from './physical-facts';
import { moonSemimajorKm } from './satellite-elements';
import type { CatalogEntry } from './seo';
import { bodies } from './solar';

/**
 * UN/CEFACT common codes (Recommendation 20) for the units a profile prints,
 * so structured data names each unit exactly rather than in words.
 */
export const propertyUnits = {
  km: { code: 'KMT', symbol: 'km' },
  au: { code: 'A12', symbol: 'AU' },
  day: { code: 'DAY', symbol: 'd' },
  hour: { code: 'HUR', symbol: 'h' },
  kg: { code: 'KGM', symbol: 'kg' },
  density: { code: '23', symbol: 'g/cm³' },
  acceleration: { code: 'MSK', symbol: 'm/s²' },
  speed: { code: 'M62', symbol: 'km/s' },
  degree: { code: 'DD', symbol: '°' },
} as const;

export type PropertyUnit = keyof typeof propertyUnits;

/**
 * One figure from a profile's facts list, in its source unit. `label` is the
 * catalogue key the page prints beside it, so structured data only ever
 * states a value the reader can see; a text value is a catalogue key too.
 */
export type ProfileProperty = {
  id: string;
  label: string;
  value: number | string;
  unit?: PropertyUnit;
};

/** Derived figures lose the floating-point noise the page never prints. */
const rounded = (value: number) => Number(value.toPrecision(6));

export function profileProperties(entry: CatalogEntry): ProfileProperty[] {
  if (entry.kind === 'body') {
    const body = entry.data;
    const physical = physicalParameters[body.id];
    return [
      { id: 'meanRadius', label: '平均半径', value: body.radius, unit: 'km' },
      ...(body.au
        ? [
            {
              id: 'meanSunDistance',
              label: '平均日距',
              value: body.au,
              unit: 'au' as const,
            },
          ]
        : []),
      ...(body.period
        ? [
            {
              id: 'orbitalPeriod',
              label: '公转周期',
              value: body.period,
              unit: 'day' as const,
            },
          ]
        : []),
      {
        id: 'rotationPeriod',
        label: '自转周期',
        value: Math.abs(body.day),
        unit: 'day',
      },
      ...(physical
        ? [
            {
              id: 'mass',
              label: '质量（约）',
              value: physical.mass,
              unit: 'kg' as const,
            },
            {
              id: 'meanDensity',
              label: '平均密度',
              value: physical.density,
              unit: 'density' as const,
            },
            {
              id: 'equatorialGravity',
              label: '赤道引力加速度',
              value: physical.gravity,
              unit: 'acceleration' as const,
            },
            {
              id: 'escapeVelocity',
              label: '逃逸速度',
              value: physical.escape,
              unit: 'speed' as const,
            },
            {
              id: 'orbitalEccentricity',
              label: '轨道偏心率（约）',
              value: body.e,
            },
            {
              id: 'orbitalInclination',
              label: '轨道倾角（约）',
              value: body.inc,
              unit: 'degree' as const,
            },
          ]
        : []),
    ];
  }
  if (entry.kind === 'moon') {
    const moon = entry.data;
    const parent = bodies.find((body) => body.id === moon.parentId);
    return [
      {
        id: 'meanRadius',
        label: '平均半径',
        value: moonRadii[moon.en],
        unit: 'km',
      },
      {
        id: 'semimajorAxis',
        label: '轨道半长轴',
        value: moonSemimajorKm(moon),
        unit: 'km',
      },
      {
        id: 'orbitalPeriod',
        label: '公转周期',
        value: moon.period,
        unit: 'day',
      },
      ...(parent
        ? [{ id: 'parentPlanet', label: '所属行星', value: parent.name }]
        : []),
    ];
  }
  if (entry.kind === 'asteroid') {
    const asteroid = entry.data;
    return [
      {
        id: 'equivalentDiameter',
        label: '等效直径',
        value: asteroid.diameter,
        unit: 'km',
      },
      {
        id: 'semimajorAxis',
        label: '轨道半长轴',
        value: asteroid.orbit.au,
        unit: 'au',
      },
      {
        id: 'orbitalPeriod',
        label: '模型公转周期',
        value: asteroid.orbit.period,
        unit: 'day',
      },
      {
        id: 'rotationPeriod',
        label: '自转周期',
        value: asteroid.rotationHours,
        unit: 'hour',
      },
      {
        id: 'orbitalInclination',
        label: '轨道倾角',
        value: asteroid.orbit.inc,
        unit: 'degree',
      },
      {
        id: 'orbitalEccentricity',
        label: '轨道偏心率',
        value: asteroid.orbit.e,
      },
    ];
  }
  const comet = entry.data;
  return [
    {
      id: 'orbitalPeriod',
      label: '模型公转周期',
      value: comet.period,
      unit: 'day',
    },
    {
      id: 'orbitalInclination',
      label: '轨道倾角',
      value: comet.inc,
      unit: 'degree',
    },
    {
      id: 'perihelionDistance',
      label: '模型近日点',
      value: rounded(comet.au * (1 - comet.e)),
      unit: 'au',
    },
    {
      id: 'aphelionDistance',
      label: '模型远日点',
      value: rounded(comet.au * (1 + comet.e)),
      unit: 'au',
    },
  ];
}
