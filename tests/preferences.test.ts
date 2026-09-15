import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  loadPreferences,
  preferencesStorageKey,
  sanitizePreferences,
  savePreferences,
} from '../lib/preferences';
import {
  DEFAULT_ORBIT_LINE_WIDTH,
  isOrbitLineWidth,
} from '../lib/orbit-line-width';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

void test('terrain lighting and geometry default to enabled for new users', () => {
  const source = readFileSync(
    new URL('../app/_pages/home-page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /\[realSurface, setRealSurface\] = useState\(true\)/);
  assert.match(source, /\[realTerrain, setRealTerrain\] = useState\(true\)/);
  assert.match(
    source,
    /\[orbitLineWidth, setOrbitLineWidth\] = useState\(DEFAULT_ORBIT_LINE_WIDTH\)/,
  );
  assert.equal(DEFAULT_ORBIT_LINE_WIDTH, 2.5);
  assert.ok(isOrbitLineWidth(1));
  assert.ok(isOrbitLineWidth(6));
  assert.ok(!isOrbitLineWidth(2.25));
});

void test('preferences are validated and persisted as one versioned record', () => {
  const storage = memoryStorage();
  assert.equal(
    savePreferences(
      {
        galaxy: false,
        cometTails: false,
        scale: 'distance',
        textureQuality: 'ultra',
        realSurface: true,
        realTerrain: true,
        labels: true,
        orbitLineWidth: 4.5,
        observerLocation: {
          latitude: 31.23,
          longitude: 121.47,
          height: 12,
          utcOffset: 8,
        },
        observerLocationSource: 'manual',
        invalid: 'ignored',
      } as never,
      storage,
    ),
    true,
  );
  assert.deepEqual(loadPreferences(storage), {
    galaxy: false,
    cometTails: false,
    scale: 'distance',
    textureQuality: 'ultra',
    realSurface: true,
    realTerrain: true,
    labels: true,
    orbitLineWidth: 4.5,
    observerLocation: {
      latitude: 31.23,
      longitude: 121.47,
      height: 12,
      utcOffset: 8,
    },
    observerLocationSource: 'manual',
  });
  assert.deepEqual(
    sanitizePreferences({
      shadows: 'yes',
      scale: 'wrong',
      orbitLineWidth: 2.25,
    }),
    {},
  );
  assert.deepEqual(
    sanitizePreferences({ observerLocation: { latitude: 91 } }),
    {},
  );
  assert.deepEqual(sanitizePreferences({ observerLocationSource: 'device' }), {
    observerLocationSource: 'device',
  });
  assert.deepEqual(
    sanitizePreferences({ observerLocationSource: 'remote' }),
    {},
  );
});

void test('legacy individual keys are migrated when no versioned record exists', () => {
  const storage = memoryStorage({
    'orbit-galaxy': 'false',
    'orbit-solar-activity': 'true',
    'orbit-real-sizes': 'true',
    'orbit-texture-quality': 'standard',
  });
  assert.deepEqual(loadPreferences(storage), {
    galaxy: false,
    solarActivity: true,
    realSizes: true,
    textureQuality: 'standard',
  });
  assert.equal(storage.getItem(preferencesStorageKey), null);
});
