import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.createSourceFile(
  'home-page.tsx',
  readFileSync(new URL('../app/_pages/home-page.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let handler = '';
function findHandler(node: ts.Node) {
  if (
    ts.isFunctionDeclaration(node) &&
    ['enterGround', 'locateEarth', 'requestObserverLocation'].includes(
      node.name?.text ?? '',
    )
  )
    handler += node.getText(source) + '\n';
  ts.forEachChild(node, findHandler);
}
findHandler(source);
assert.ok(handler, 'exercise the real mode-switch handler');
const compiled = ts.transpileModule(handler, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function modeContext(paused: boolean, observerLocationSource = 'manual') {
  const context = {
    Error,
    ground: false,
    selected: null as string | null,
    observerView: null as { latitude: number; longitude: number } | null,
    time: Date.parse('2024-04-08T18:17:15Z'),
    paused,
    speed: 4,
    sandboxRun: null,
    sandboxEarthAvailable: true,
    locationTicket: { current: 0 },
    observerLocationSource,
    observerLocation: { latitude: 0, longitude: 0 },
    window: { matchMedia: () => ({ matches: false }), isSecureContext: true },
    navigator: { geolocation: {} },
    sensor: { start: () => assert.fail('desktop does not request sensors') },
    setGround: (value: boolean) => {
      context.ground = value;
    },
    setObserverView: (
      value: { latitude: number; longitude: number } | null,
    ) => {
      context.observerView = value;
    },
    select: (id: string) => {
      context.selected = id;
      context.ground = false;
      context.observerView = null;
      context.locationTicket.current++;
    },
    setTop: () => {},
    setEclipseView: () => {},
    setCameraPose: () => {},
    setPlanetEventView: (value: unknown) => {
      assert.equal(value, null, 'ground sky clears the planetary event camera');
    },
    notice: '',
    setNotice: (value: string) => {
      context.notice = value;
    },
    seekTime: () =>
      assert.fail('mode changes must not seek or resume playback'),
    setEpoch: () => assert.fail('mode changes must not reset the clock'),
    setTime: () => assert.fail('mode changes must not replace the time'),
    setPaused: () => assert.fail('mode changes must preserve playback'),
    setSpeed: () => assert.fail('mode changes must preserve speed'),
    currentLocation: async (
      _geolocation: unknown,
      _secure: boolean,
      _options: { maximumAge?: number },
    ) => ({ latitude: 31, longitude: 121 }),
    locateTimeZone: (_location: unknown, instant: number) => {
      assert.equal(
        instant,
        context.time,
        'location offset belongs to the simulated instant',
      );
      return _location;
    },
    updateObserverLocation: () => {},
  };
  const { toggle, locate } = runInNewContext(
    `${compiled}\n({ toggle: enterGround, locate: locateEarth })`,
    context,
  ) as { toggle: () => void; locate: () => void };
  return { context, toggle, locate };
}

for (const paused of [true, false]) {
  void test(`entering and leaving ground sky preserves a historical ${paused ? 'paused' : 'running'} clock and speed`, () => {
    const { context, toggle } = modeContext(paused);
    const before = {
      time: context.time,
      paused: context.paused,
      speed: context.speed,
    };
    toggle();
    assert.equal(context.ground, true);
    toggle();
    assert.equal(context.ground, false);
    assert.deepEqual(
      { time: context.time, paused: context.paused, speed: context.speed },
      before,
    );
  });
}

void test('device location uses the eclipse instant without changing playback', async () => {
  const { context, toggle } = modeContext(true, 'device');
  let updates = 0;
  context.updateObserverLocation = () => {
    updates++;
  };
  toggle();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(context.ground, true);
  assert.equal(updates, 1);
  assert.equal(context.paused, true);
});

void test('locate action refreshes a manual site and selects Earth without entering ground sky', async () => {
  const { context, locate } = modeContext(true);
  let requests = 0;
  let updates = 0;
  context.currentLocation = async (_geo, secure, options) => {
    assert.equal(secure, true);
    assert.equal(options.maximumAge, 0, 'always bypass a cached device fix');
    requests++;
    return { latitude: 31, longitude: 121 };
  };
  context.updateObserverLocation = () => {
    updates++;
  };
  locate();
  await new Promise<void>((resolve) => setImmediate(resolve));
  locate();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(context.selected, 'earth');
  assert.equal(context.observerView?.latitude, 31);
  assert.equal(context.observerView?.longitude, 121);
  assert.equal(requests, 2);
  assert.equal(updates, 2);
  assert.equal(context.ground, false);
  assert.equal(context.paused, true);
});

void test('a location failure preserves the observing site and reports the reason', async () => {
  const { context, locate } = modeContext(true);
  const before = context.observerLocation;
  context.currentLocation = async () => {
    throw new Error('定位超时，请重试或手动填写经纬度。');
  };
  context.updateObserverLocation = () =>
    assert.fail('failed fix must not change the site');
  locate();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(context.observerLocation, before);
  assert.equal(context.notice, '定位超时，请重试或手动填写经纬度。');
  assert.equal(context.ground, false);
});

void test('selecting another body ignores an outstanding location reply', async () => {
  const { context, locate } = modeContext(true);
  let reply!: (fix: { latitude: number; longitude: number }) => void;
  context.currentLocation = () =>
    new Promise((resolve) => {
      reply = resolve;
    });
  context.updateObserverLocation = () => assert.fail('stale location reply');
  locate();
  context.select('mars');
  reply({ latitude: 31, longitude: 121 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(context.ground, false);
});

void test('locate action cannot enter a sandbox with no Earth', () => {
  const { context, locate } = modeContext(true);
  context.sandboxEarthAvailable = false;
  context.currentLocation = async () =>
    assert.fail('no location request without Earth');
  locate();
  assert.equal(context.ground, false);
});

void test('locate action exits ground sky without asking for device orientation', async () => {
  const { context, locate } = modeContext(false);
  context.ground = true;
  context.window.matchMedia = () => ({ matches: true });
  locate();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(context.ground, false);
  assert.equal(context.selected, 'earth');
  assert.equal(context.paused, false);
  assert.equal(context.speed, 4);
});
