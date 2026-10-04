import assert from 'node:assert/strict';
import test from 'node:test';
import { currentLocation } from '../lib/geolocation';

void test('a refreshed fix bypasses the cache while retaining accuracy and timeout', async () => {
  const geo: Pick<Geolocation, 'getCurrentPosition'> = {
    getCurrentPosition(success, _error, options) {
      assert.deepEqual(options, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      success({
        coords: { latitude: 31.23, longitude: 121.47, accuracy: 20 },
      } as GeolocationPosition);
    },
  };
  assert.deepEqual(await currentLocation(geo, true, { maximumAge: 0 }), {
    latitude: 31.23,
    longitude: 121.47,
    accuracy: 20,
  });
});

void test('ordinary location requests retain their existing cache allowance', async () => {
  const geo: Pick<Geolocation, 'getCurrentPosition'> = {
    getCurrentPosition(success, _error, options) {
      assert.equal(options?.maximumAge, 60000);
      success({
        coords: { latitude: 0, longitude: 0, accuracy: 0 },
      } as GeolocationPosition);
    },
  };
  await currentLocation(geo, true);
});

void test('refresh propagates a denied permission and rejects unsupported or insecure contexts', async () => {
  const geo: Pick<Geolocation, 'getCurrentPosition'> = {
    getCurrentPosition(_success, error) {
      error!({ code: 1 } as GeolocationPositionError);
    },
  };
  await assert.rejects(
    currentLocation(geo, true, { maximumAge: 0 }),
    /权限被拒绝/,
  );
  await assert.rejects(currentLocation(undefined, true), /不支持定位/);
  await assert.rejects(currentLocation(geo, false), /安全连接/);
});
