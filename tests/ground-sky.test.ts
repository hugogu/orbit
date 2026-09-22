import test from 'node:test';
import assert from 'node:assert/strict';
import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import { Vector3 } from 'three';
import * as THREE from 'three';
import {
  groundBodies,
  groundBodyDisplay,
  groundBodyVector,
  horizonFrame,
} from '../lib/ground-sky';
import {
  deviceAttitude,
  requestOrientationPermission,
} from '../lib/device-attitude';
import { DAY_MS, J2000_MS } from '../lib/simulation-time';
import { astroBodies } from '../lib/ephemeris';

const radians = Math.PI / 180;
const site = {
  latitude: 39.9042,
  longitude: 116.4074,
  height: 45,
  utcOffset: 8,
};
const days = (Date.parse('2026-09-22T13:00:00Z') - J2000_MS) / DAY_MS;
const close = (a: number, b: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);

void test('ground planets and Moon match independent equatorial-of-date horizon calculations worldwide', () => {
  for (const location of [
    site,
    { ...site, latitude: -33.86, longitude: 151.21 },
    { ...site, latitude: 89.9, longitude: -179.9 },
    { ...site, latitude: 0, longitude: 0 },
  ])
    for (const day of [days, 0, -100000, 70000]) {
      const frame = horizonFrame(day, location);
      close(frame.east.dot(frame.up), 0);
      close(frame.east.clone().cross(frame.up).dot(frame.south), 1);
      for (const body of groundBodies) {
        const vector = groundBodyVector(body.id, day, location).normalize();
        const equatorial = Equator(
          astroBodies[body.id] ?? Body.Moon,
          day,
          new Observer(location.latitude, location.longitude, location.height),
          true,
          true,
        );
        const horizon = Horizon(
          day,
          new Observer(location.latitude, location.longitude, location.height),
          equatorial.ra,
          equatorial.dec,
        );
        close(Math.asin(vector.dot(frame.up)) / radians, horizon.altitude);
        const azimuth =
          Math.atan2(vector.dot(frame.east), -vector.dot(frame.south)) /
          radians;
        close(Math.sin(azimuth * radians), Math.sin(horizon.azimuth * radians));
        close(Math.cos(azimuth * radians), Math.cos(horizon.azimuth * radians));
      }
    }
});

void test('size and distance toggles preserve topocentric directions; true size preserves angular diameters', () => {
  for (const body of groundBodies) {
    const vector = groundBodyVector(body.id, days, site);
    const real = groundBodyDisplay(body.id, vector, 'distance', true);
    const compressed = groundBodyDisplay(body.id, vector, 'illustrated', true);
    close(
      real.radius / real.position.length(),
      compressed.radius / compressed.position.length(),
    );
    for (const scale of ['distance', 'illustrated'] as const)
      for (const realSizes of [true, false]) {
        const display = groundBodyDisplay(body.id, vector, scale, realSizes);
        close(
          display.position
            .clone()
            .normalize()
            .distanceTo(vector.clone().normalize()),
          0,
        );
        if (!realSizes)
          assert.ok(
            display.radius / display.position.length() >=
              (real.radius / real.position.length()) * 9.99,
          );
      }
    if (body.id === 'sun' || body.id === 'moon-moon') {
      const diameter =
        (2 * Math.asin(real.radius / real.position.length())) / radians;
      assert.ok(diameter > 0.45 && diameter < 0.6, `${body.id}: ${diameter}`);
    }
  }
});

void test('Moon includes the observer parallax instead of using a geocentric sky', () => {
  const opposite = {
    ...site,
    latitude: -site.latitude,
    longitude: site.longitude - 180,
  };
  const difference =
    groundBodyVector('moon-moon', days, site).angleTo(
      groundBodyVector('moon-moon', days, opposite),
    ) / radians;
  assert.ok(difference > 0.1 && difference < 2);
});

void test('device attitude follows north/east/up and landscape changes roll, not the sightline', () => {
  const reading = { alpha: 0, beta: 90, gamma: 0, absolute: true };
  const forward = (q: ReturnType<typeof deviceAttitude>) =>
    new Vector3(0, 0, -1).applyQuaternion(q!);
  close(
    forward(deviceAttitude(reading, 0)).distanceTo(new Vector3(0, 0, -1)),
    0,
  );
  close(
    forward(deviceAttitude({ ...reading, alpha: 270 }, 0)).distanceTo(
      new Vector3(1, 0, 0),
    ),
    0,
  );
  close(
    forward(deviceAttitude({ ...reading, beta: 180 }, 0)).distanceTo(
      new Vector3(0, 1, 0),
    ),
    0,
  );
  for (const screen of [-90, 90, 180]) {
    const tilted = { ...reading, beta: 63, gamma: -21, alpha: 310 };
    close(
      forward(deviceAttitude(tilted, screen)).distanceTo(
        forward(deviceAttitude(tilted, 0)),
      ),
      0,
    );
  }
  // A magnetic heading of 80° plus 10° east declination points due east.
  close(
    forward(
      deviceAttitude(
        {
          ...reading,
          absolute: false,
          webkitCompassHeading: 80,
          webkitCompassAccuracy: 5,
        },
        0,
        10,
      ),
    ).distanceTo(new Vector3(1, 0, 0)),
    0,
  );
  close(
    forward(deviceAttitude(reading, 0, 0, 90)).distanceTo(new Vector3(1, 0, 0)),
    0,
  );
});

void test('relative, absent and uncalibrated compass readings never masquerade as absolute headings', () => {
  const reading = { alpha: 0, beta: 90, gamma: 0, absolute: true };
  assert.equal(deviceAttitude({ ...reading, alpha: null }, 0), null);
  assert.equal(deviceAttitude({ ...reading, beta: NaN }, 0), null);
  assert.equal(deviceAttitude({ ...reading, absolute: false }, 0), null);
  assert.equal(
    deviceAttitude(
      { ...reading, webkitCompassHeading: 10, webkitCompassAccuracy: -1 },
      0,
    ),
    null,
  );
});

void test('orientation permission handles iOS grant/denial and unsupported or insecure browsers', async () => {
  let absoluteRequested = false;
  await requestOrientationPermission(
    {
      requestPermission: async (absolute) => {
        absoluteRequested = !!absolute;
        return 'granted';
      },
    },
    true,
  );
  assert.ok(absoluteRequested);
  await requestOrientationPermission({}, true);
  await assert.rejects(requestOrientationPermission(undefined, true), /不支持/);
  await assert.rejects(requestOrientationPermission({}, false), /HTTPS/);
  await assert.rejects(
    requestOrientationPermission(
      { requestPermission: async () => 'denied' },
      true,
    ),
    /拒绝/,
  );
});

void test('ground renderer integrates camera attitude, physical bodies, texture reuse, resize and teardown', async () => {
  const { createGroundSky } = await import('../components/ground-sky');
  const { translator } = await import('../lib/i18n');
  const elements: Array<{
    style: Record<string, string>;
    textContent: string;
    hidden: boolean;
  }> = [];
  const element = () => {
    const value = {
      style: {} as Record<string, string>,
      textContent: '',
      hidden: false,
      className: '',
      classList: { toggle() {} },
      appendChild() {},
      remove() {},
    };
    elements.push(value);
    return value;
  };
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: element },
  });
  try {
    const canvas = Object.assign(new EventTarget(), {
      clientHeight: 720,
      setPointerCapture() {},
    }) as unknown as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshStandardMaterial({ map: texture }),
    );
    const sky = createGroundSky(
      scene,
      element() as unknown as HTMLElement,
      canvas,
      new Map([['moon-moon', moon]]),
    );
    assert.equal(scene.children[0].visible, false);
    sky.setActive(true);
    const update = (
      q: THREE.Quaternion | null,
      width = 1280,
      height = 720,
      scale: 'distance' | 'illustrated' = 'illustrated',
      real = false,
    ) =>
      sky.update(
        days,
        site,
        scale,
        real,
        q,
        width,
        height,
        true,
        translator('en'),
      );
    const q = deviceAttitude(
      { alpha: 270, beta: 110, gamma: 12, absolute: true },
      90,
    )!;
    update(q);
    const expected = horizonFrame(days, site).rotation.multiply(q);
    close(sky.camera.quaternion.angleTo(expected), 0);
    update(q, 390, 844, 'distance', true);
    close(sky.camera.quaternion.angleTo(expected), 0);
    close(sky.camera.aspect, 390 / 844);
    const meshes = scene.children[0].children.filter(
      (object) => object instanceof THREE.Mesh,
    );
    const groundMoon =
      meshes[groundBodies.findIndex((body) => body.id === 'moon-moon')];
    assert.equal((groundMoon.material as THREE.MeshBasicMaterial).map, texture);
    close(
      groundMoon.position
        .clone()
        .normalize()
        .distanceTo(groundBodyVector('moon-moon', days, site).normalize()),
      0,
    );
    const material = groundMoon.material as THREE.MeshBasicMaterial;
    const shader = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {} as Record<string, { value: unknown }>,
    };
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      {} as THREE.WebGLRenderer,
    );
    const light = shader.uniforms.groundSunDirection.value as THREE.Vector3;
    close(
      light.distanceTo(
        groundBodyVector('sun', days, site)
          .sub(groundBodyVector('moon-moon', days, site))
          .normalize(),
      ),
      0,
    );
    assert.match(
      shader.fragmentShader,
      /dot\(normalize\(groundNormal\), groundSunDirection\)/,
    );
    const before = sky.camera.getWorldDirection(new THREE.Vector3());
    update(null);
    close(
      sky.camera.getWorldDirection(new THREE.Vector3()).distanceTo(before),
      0,
    );
    sky.setActive(false);
    assert.equal(scene.children[0].visible, false);
    sky.dispose();
    assert.equal(scene.children.length, 0);
    moon.geometry.dispose();
    moon.material.dispose();
    texture.dispose();
  } finally {
    if (previousDocument)
      Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
