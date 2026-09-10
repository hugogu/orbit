import { isTextureQuality, type TextureQuality } from './texture-quality';
import type { ScaleMode } from './solar';

export const preferencesStorageKey = 'orbit-observatory-preferences-v1';

export type ObservatoryPreferences = {
  orbits: boolean;
  labels: boolean;
  belts: boolean;
  scale: ScaleMode;
  shadows: boolean;
  shadowGuides: boolean;
  galaxy: boolean;
  solarActivity: boolean;
  realSizes: boolean;
  textureQuality: TextureQuality;
};

export type StoredPreferences = Partial<ObservatoryPreferences>;

const booleanKeys = [
  'orbits',
  'labels',
  'belts',
  'shadows',
  'shadowGuides',
  'galaxy',
  'solarActivity',
  'realSizes',
] as const;

export function sanitizePreferences(value: unknown): StoredPreferences {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const result: StoredPreferences = {};
  for (const key of booleanKeys) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }
  if (source.scale === 'illustrated' || source.scale === 'distance')
    result.scale = source.scale;
  if (isTextureQuality(source.textureQuality))
    result.textureQuality = source.textureQuality;
  return result;
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
