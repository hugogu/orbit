import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import {
  DeviceAttitudeTracker,
  smoothDeviceAttitude,
  type AttitudeReading,
} from '../lib/device-attitude';

const radians = Math.PI / 180;
const up = new Vector3(0, 1, 0);
const wrap = (degrees: number) => ((degrees % 360) + 360) % 360;
const pose = (azimuth: number, altitude: number, roll = 0) =>
  new Quaternion().setFromEuler(
    new Euler(altitude * radians, -azimuth * radians, roll * radians, 'YXZ'),
  );
const near = (actual: Quaternion | null, expected: Quaternion) => {
  assert.ok(actual);
  assert.ok(actual.angleTo(expected) < 1e-7);
};

function deviceAngles(orientation: Quaternion) {
  const m = new Matrix4().makeRotationFromQuaternion(orientation).elements;
  const inverted = m[10] < 0;
  let beta = Math.asin(Math.max(-1, Math.min(1, m[6])));
  if (inverted) beta = beta >= 0 ? Math.PI - beta : -Math.PI - beta;
  const singular = Math.abs(m[6]) > 1 - 1e-12;
  const alpha = singular
    ? Math.atan2(m[1], m[0])
    : inverted
      ? Math.atan2(m[4], -m[5])
      : Math.atan2(-m[4], m[5]);
  const gamma = singular
    ? 0
    : inverted
      ? Math.atan2(m[2], -m[10])
      : Math.atan2(-m[2], m[10]);
  return {
    alpha: wrap(alpha / radians),
    beta: beta / radians,
    gamma: gamma / radians,
  };
}

// Relative and Earth-referenced W3C frames differ only by yaw. Apple's
// compass heading is the Earth-referenced alpha, with the opposite sign.
function gyroReading(physical: Quaternion, declination = 0): AttitudeReading {
  const relative = new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
    .multiply(new Quaternion().setFromAxisAngle(up, 57 * radians))
    .multiply(physical);
  const angles = deviceAngles(relative);
  return {
    ...angles,
    absolute: false,
    webkitCompassHeading: wrap(57 - angles.alpha - declination),
    webkitCompassAccuracy: 5,
  };
}

function alignedTracker(declination = 0, initial = pose(0, -90)) {
  const tracker = new DeviceAttitudeTracker();
  near(
    tracker.read(gyroReading(initial, declination), 0, declination),
    initial,
  );
  return tracker;
}

void test('Safari preserves a continuous physical sweep through horizon, zenith and Euler branches', () => {
  for (const roll of [-100, -20, 0, 20, 100]) {
    const tracker = alignedTracker(10, pose(270, 0, roll));
    let previous: Quaternion | null = null;
    for (let index = 0; index <= 300; index++) {
      const expected = pose(340 + index * 0.2, -30 + index * 0.5, roll);
      const reading = gyroReading(expected, 10);
      // Later magnetic samples are deliberately inconsistent with the gyro.
      reading.webkitCompassHeading = wrap(index * 137);
      const actual = tracker.read(reading, 0, 10);
      assert.ok(actual, `roll=${roll}, index=${index}`);
      assert.ok(
        actual.angleTo(expected) < 1e-7,
        `roll=${roll}, index=${index}, error=${actual.angleTo(expected) / radians}`,
      );
      if (previous) assert.ok(previous.angleTo(actual!) < 0.6 * radians);
      previous = actual;
    }
  }
});

void test('compass heading aligns the Earth-referenced alpha before screen rotation and manual correction', () => {
  for (const screen of [-90, 0, 90, 180])
    for (const altitude of [-60, 30, 80, 100]) {
      const physical = pose(80, altitude, 15);
      const expected = new Quaternion()
        .setFromAxisAngle(up, -12 * radians)
        .multiply(physical)
        .multiply(
          new Quaternion().setFromAxisAngle(
            new Vector3(0, 0, 1),
            -screen * radians,
          ),
        );
      near(
        alignedTracker(-7).read(gyroReading(physical, -7), screen, -7, 12),
        expected,
      );
    }
});

void test('unreliable compass samples keep gyro motion after initialization, but cannot initialize north', () => {
  const tracker = new DeviceAttitudeTracker();
  assert.equal(
    tracker.read({ ...gyroReading(pose(15, 0)), webkitCompassHeading: NaN }, 0),
    null,
  );
  assert.equal(
    tracker.read(
      { ...gyroReading(pose(15, 45)), webkitCompassAccuracy: -1 },
      0,
    ),
    null,
  );
  near(tracker.read(gyroReading(pose(15, 45)), 0), pose(15, 45));
  for (const accuracy of [-1, 80, NaN])
    near(
      tracker.read(
        { ...gyroReading(pose(70, 65)), webkitCompassAccuracy: accuracy },
        0,
      ),
      pose(70, 65),
    );
  near(
    tracker.read(
      { ...gyroReading(pose(90, 70)), webkitCompassHeading: NaN },
      0,
    ),
    pose(90, 70),
  );
});

void test('tilted compass disagreement cannot rotate a stationary sky or reverse west', () => {
  const tracker = alignedTracker(0, pose(270, 0));
  for (const altitude of [0, 30, 80, 100]) {
    const physical = pose(270, altitude);
    for (let sample = 0; sample < 600; sample++) {
      const heading = sample < 300 ? 90 : wrap(sample * 17);
      near(
        tracker.read(
          { ...gyroReading(physical), webkitCompassHeading: heading },
          0,
        ),
        physical,
      );
    }
  }
});

void test('north initializes automatically at any facing direction and tilt', () => {
  for (const azimuth of [0, 90, 180, 270])
    for (const altitude of [-90, -30, 0, 30, 90])
      for (const roll of [-70, 0, 70]) {
        const physical = pose(azimuth, altitude, roll);
        const actual = new DeviceAttitudeTracker().read(
          gyroReading(physical),
          0,
        );
        assert.ok(actual);
        assert.ok(
          actual.angleTo(physical) < 1e-7,
          `azimuth=${azimuth}, altitude=${altitude}, roll=${roll}, error=${actual.angleTo(physical) / radians}`,
        );
      }
});

void test('one session never alternates relative, compass and Earth reference frames', () => {
  const absolute = { alpha: 20, beta: 120, gamma: 10, absolute: true };
  const tracker = new DeviceAttitudeTracker();
  assert.equal(tracker.read({ ...absolute, absolute: false }, 0), null);
  const expected = tracker.read(absolute, 0)!;
  assert.equal(tracker.read(gyroReading(pose(80, 40)), 0), null);
  near(tracker.read(absolute, 0), expected);
  assert.equal(tracker.read({ ...absolute, beta: null }, 0), null);
  const safari = alignedTracker();
  assert.equal(safari.read(absolute, 0), null);
});

void test('quaternion damping reduces jitter, takes the short path and is independent of display rate', () => {
  const target = pose(1, 95, 20);
  const final = (fps: number) => {
    const current = pose(359, 80, 20);
    for (let frame = 0; frame < fps; frame++)
      smoothDeviceAttitude(current, target, 1 / fps);
    return current;
  };
  near(final(30), final(120));
  near(final(60), target);
  const current = pose(0, 30);
  let largestStep = 0;
  for (let frame = 0; frame < 120; frame++) {
    const previous = current.clone();
    smoothDeviceAttitude(current, pose(frame % 2 ? 1 : -1, 30), 1 / 60);
    largestStep = Math.max(largestStep, previous.angleTo(current));
  }
  assert.ok(largestStep < 0.5 * radians);
  const moving = pose(0, 0);
  for (let frame = 1; frame <= 120; frame++)
    smoothDeviceAttitude(moving, pose(frame * 0.5, 0), 1 / 60);
  assert.ok(moving.angleTo(pose(60, 0)) < 1.5 * radians);
});
