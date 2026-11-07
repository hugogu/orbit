import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraNavigationChanged } from '../lib/camera-navigation';

const initial = {
  selected: 'earth',
  reset: 0,
  view: 205,
  top: false,
  scale: 'illustrated' as const,
  realSizes: false,
  systemView: false,
  width: 1280,
  height: 900,
  paused: true,
  locale: 'en-US',
};

void test('resizing and unrelated state changes do not request a camera flight', () => {
  let previous = initial;
  for (const [width, height] of [
    [1000, 720],
    [390, 844],
    [844, 390],
    [1280, 900],
    [640, 450],
  ]) {
    const current = { ...previous, width, height };
    assert.equal(cameraNavigationChanged(previous, current), false);
    previous = current;
  }
  const unrelated = { ...previous, paused: false, locale: 'ja-JP' };
  assert.equal(cameraNavigationChanged(previous, unrelated), false);
});

void test('initial framing and explicit navigation still request a camera flight', () => {
  assert.equal(cameraNavigationChanged(null, initial), true);
  for (const change of [
    { selected: 'moon' },
    { selected: null },
    { reset: 1 },
    { view: 400 },
    { top: true },
    { scale: 'distance' as const },
    { realSizes: true },
    { systemView: true },
  ]) {
    assert.equal(
      cameraNavigationChanged(initial, { ...initial, ...change }),
      true,
      JSON.stringify(change),
    );
    const resized = { ...initial, ...change, width: 390, height: 844 };
    assert.equal(
      cameraNavigationChanged(initial, resized),
      true,
      'navigation still applies when it coincides with a resize',
    );
  }
});
