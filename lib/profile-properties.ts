import { moonRadii } from './eclipse-shadows';
import { physicalParameters } from './physical-facts';
import { moonSemimajorKm } from './satellite-elements';
import type { CatalogEntry } from './seo';
import { bodies, type Body } from './solar';
import { translator, type Locale } from './i18n';

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

// NASA/NSSDC obliquity-to-orbit figures, checked 2026-10-04. These are
// fixed educational values, not obliquity computed at the simulation epoch.
// Venus's rendering tilt is the complement; Pluto's rendering tilt is not
// the published obliquity. Keep those presentation parameters unchanged.
export const axialTiltSource =
  'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
export const axialTiltNote =
  '轴倾角是自转轴与自身轨道平面法线的夹角（0–180°）；轨道倾角是轨道平面与黄道面的夹角。轴倾角采用 NASA/NSSDC 的固定科普近似值，不随模拟日期更新；金星与冥王星使用资料值，不直接使用场景的姿态参数。';

export function profileAxialTilt(body: Body): number | undefined {
  if (body.id === 'venus') return 177.36;
  if (body.id === 'pluto') return 119.51;
  if (
    [
      'mercury',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ].includes(body.id) &&
    Number.isFinite(body.tilt) &&
    body.tilt >= 0 &&
    body.tilt <= 180
  )
    return body.tilt;
  return undefined;
}

/** Derived figures lose the floating-point noise the page never prints. */
const rounded = (value: number) => Number(value.toPrecision(6));

/** Planetary day values are sidereal, as defined in NASA's fact-sheet notes:
 * https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html
 * The Sun keeps its generic label; it has latitude-dependent rotation.
 */
export function profileRotationProperty(body: Body): ProfileProperty {
  const days = Math.abs(body.day);
  return {
    id: 'rotationPeriod',
    label: body.id === 'sun' ? '自转周期' : '恒星自转周期',
    value: Number(days.toFixed(days < 2 ? 5 : 2)),
    unit: 'day',
  };
}

export function profileRotationFact(body: Body, locale: Locale) {
  const t = translator(locale);
  const property = profileRotationProperty(body);
  return [
    t(property.label),
    `${property.value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 5 })} ${t('天')}`,
  ];
}

export function profileProperties(entry: CatalogEntry): ProfileProperty[] {
  if (entry.kind === 'body') {
    const body = entry.data;
    const physical = physicalParameters[body.id];
    const axialTilt = profileAxialTilt(body);
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
      profileRotationProperty(body),
      ...(axialTilt !== undefined
        ? [
            {
              id: 'axialTilt',
              label: '轴倾角（约）',
              value: axialTilt,
              unit: 'degree' as const,
            },
          ]
        : []),
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
