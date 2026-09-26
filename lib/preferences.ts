import { isTextureQuality, type TextureQuality } from './texture-quality';
import { isOrbitLineWidth } from './orbit-line-width';
import type { ScaleMode } from './solar';
import type { ChosenLocationSource, SkyLocation } from './sky-events';

export const preferencesStorageKey = 'orbit-observatory-preferences-v1';

export type ObservatoryPreferences = {
  orbits: boolean;
  orbitLineWidth: number;
  labels: boolean;
  belts: boolean;
  scale: ScaleMode;
  shadows: boolean;
  shadowGuides: boolean;
  galaxy: boolean;
  stars: boolean;
  constellations: boolean;
  solarActivity: boolean;
  cometTails: boolean;
  realSizes: boolean;
  realSurface: boolean;
  realTerrain: boolean;
  textureQuality: TextureQuality;
  actionLabels: boolean;
  observerLocation: SkyLocation;
  observerLocationSource: ChosenLocationSource;
};

export type StoredPreferences = Partial<ObservatoryPreferences>;

const booleanKeys = [
  'orbits',
  'labels',
  'belts',
  'shadows',
  'shadowGuides',
  'galaxy',
  'stars',
  'constellations',
  'solarActivity',
  'cometTails',
  'realSizes',
  'realSurface',
  'realTerrain',
  'actionLabels',
] as const;

export function sanitizePreferences(value: unknown): StoredPreferences {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const result: StoredPreferences = {};
  for (const key of booleanKeys) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }
  if (isOrbitLineWidth(source.orbitLineWidth))
    result.orbitLineWidth = source.orbitLineWidth;
  if (source.scale === 'illustrated' || source.scale === 'distance')
    result.scale = source.scale;
  if (isTextureQuality(source.textureQuality))
    result.textureQuality = source.textureQuality;
  if (isObserverLocation(source.observerLocation))
    result.observerLocation = source.observerLocation;
  if (
    source.observerLocationSource === 'device' ||
    source.observerLocationSource === 'manual'
  )
    result.observerLocationSource = source.observerLocationSource;
  return result;
}

function validTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function isObserverLocation(value: unknown): value is SkyLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Record<string, unknown>;
  return (
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    typeof location.height === 'number' &&
    Number.isFinite(location.height) &&
    location.height >= -500 &&
    location.height <= 10000 &&
    typeof location.utcOffset === 'number' &&
    Number.isFinite(location.utcOffset) &&
    location.utcOffset >= -12 &&
    location.utcOffset <= 14 &&
    (location.timeZone === undefined ||
      (typeof location.timeZone === 'string' &&
        validTimeZone(location.timeZone)))
  );
}

function storageOrNull(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read versioned preferences and migrate settings saved by older releases. */
export function loadPreferences(storage?: Storage | null): StoredPreferences {
  const target = storageOrNull(storage);
  if (!target) return {};
  try {
    const versioned = target.getItem(preferencesStorageKey);
    if (versioned) return sanitizePreferences(JSON.parse(versioned));
    const legacy: Record<string, unknown> = {
      galaxy: target.getItem('orbit-galaxy') !== 'false',
      solarActivity: target.getItem('orbit-solar-activity') !== 'false',
      realSizes: target.getItem('orbit-real-sizes') === 'true',
    };
    const textureQuality = target.getItem('orbit-texture-quality');
    if (textureQuality) legacy.textureQuality = textureQuality;
    return sanitizePreferences(legacy);
  } catch {
    return {};
  }
}

export function savePreferences(
  preferences: StoredPreferences,
  storage?: Storage | null,
): boolean {
  const target = storageOrNull(storage);
  if (!target) return false;
  try {
    target.setItem(
      preferencesStorageKey,
      JSON.stringify(sanitizePreferences(preferences)),
    );
    return true;
  } catch {
    return false;
  }
}
