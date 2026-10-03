import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { calculatePlanetEvents } from '../lib/planet-events';
import { framePlanetEvent } from '../lib/planet-event-view';
import { planetPosition } from '../lib/ephemeris';
import { displayRadius } from '../lib/display-scale';
import { bodies } from '../lib/solar';
import { J2000_MS, DAY_MS } from '../lib/simulation-time';
import { fallbackSkyLocation } from '../lib/sky-events';
import {
  decodeShareView,
  encodeShareView,
  defaultShareView,
} from '../lib/share-view';

const events = calculatePlanetEvents({
  ...fallbackSkyLocation,
  start: Date.UTC(2026, 9, 3),
});

for (const kind of ['opposition', 'transit'] as const) {
  for (const event of events[kind]) {
    void test(`${kind}: ${event.body} ${new Date(event.peak).getUTCFullYear()} fits both the Sun and planet across layouts`, () => {
      for (const scale of ['illustrated', 'distance'] as const) {
        for (const realSizes of [false, true]) {
          for (const [width, height] of [
            [1280, 900],
            [1000, 720],
            [390, 844],
            [844, 390],
          ]) {
            const days = (event.peak - J2000_MS) / DAY_MS;
            const spheres = ['sun', 'earth', event.body].map((id) => ({
              center: new Vector3(
                ...planetPosition(
                  bodies.find((body) => body.id === id)!,
                  days,
                  scale,
                ),
              ),
              radius:
                displayRadius(id, scale, realSizes) *
                (id === 'saturn' ? 2.4 : id === 'sun' ? 1.3 : 1),
            }));
            const [sun, earth, planet] = spheres;
            const original = spheres.map((sphere) => sphere.center.clone());
            const frame = framePlanetEvent({
              kind,
              sun,
              earth,
              planet,
              fov: 47,
              aspect: width / height,
              compact: height <= 720,
            });
            const camera = new PerspectiveCamera(
              47,
              width / height,
              1e-10,
              1e5,
            );
            camera.position.copy(frame.target).add(frame.offset);
            camera.lookAt(frame.target);
            camera.updateMatrixWorld();
            assert.ok(frame.distance > 0 && Number.isFinite(frame.distance));
            assert.ok(
              frame.target.equals(planet.center),
              'sharing stays relative to the selected planet',
            );
            spheres.forEach(({ center, radius }, index) => {
              assert.ok(
                center.equals(original[index]),
                'framing does not change body positions',
              );
              for (const direction of [
                new Vector3(1, 0, 0),
                new Vector3(-1, 0, 0),
                new Vector3(0, 1, 0),
                new Vector3(0, -1, 0),
                new Vector3(0, 0, 1),
                new Vector3(0, 0, -1),
              ]) {
                const projected = center
                  .clone()
                  .addScaledVector(direction, radius)
                  .project(camera);
                assert.ok(
                  Math.abs(projected.x) < 0.81 &&
                    Math.abs(projected.y) < 0.66 &&
                    projected.z < 1,
                  `${kind} ${event.body} ${scale} ${String(realSizes)} ${width}x${height}: body ${index} ${projected.toArray().join(',')}`,
                );
              }
            });
            const sunScreen = sun.center.clone().project(camera);
            const planetScreen = planet.center.clone().project(camera);
            const sunRay = sun.center.clone().sub(camera.position);
            const planetRay = planet.center.clone().sub(camera.position);
            assert.ok(
              sunRay.angleTo(planetRay) >
                Math.asin(sun.radius / sunRay.length()) +
                  Math.asin(planet.radius / planetRay.length()),
              'the planet and rings cannot hide the Sun',
            );
            assert.ok(
              sunScreen.distanceTo(planetScreen) > 0.01,
              'the Sun and planet have distinct screen positions',
            );
            // The base zoom ratio preserves this view when a share link restores
            // around the planet without the planner's temporary preset.
            const baseDistance = realSizes
              ? (displayRadius(event.body, scale, realSizes) * 6) /
                Math.min(1, width / height)
              : 10;
            const zoom =
              camera.position.distanceTo(frame.target) / baseDistance;
            const params = encodeShareView({
              ...defaultShareView,
              time: event.peak,
              selected: event.body,
              camera: { azimuth: 0, polar: 1, zoom },
            });
            const restored = decodeShareView(params, event.body).camera;
            assert.ok(
              restored,
              'event camera survives the share codec at physical sizes',
            );
            assert.ok(Math.abs(restored.zoom - zoom) < 1e-4);
            const restoredOffset = frame.offset
              .clone()
              .normalize()
              .multiplyScalar(baseDistance * zoom);
            assert.ok(restoredOffset.distanceTo(frame.offset) < 1e-10);
          }
        }
      }
    });
  }
}

void test('a degenerate alignment still produces a finite framing', () => {
  const sphere = { center: new Vector3(), radius: 1 };
  const frame = framePlanetEvent({
    kind: 'opposition',
    sun: sphere,
    earth: sphere,
    planet: sphere,
    fov: 47,
    aspect: 1,
    compact: false,
  });
  assert.ok(frame.offset.toArray().every(Number.isFinite));
  assert.ok(frame.distance > 1);
});
