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
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'enterGround')
    handler = node.getText(source);
  ts.forEachChild(node, findHandler);
}
findHandler(source);
assert.ok(handler, 'exercise the real mode-switch handler');
const compiled = ts.transpileModule(handler, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function modeContext(paused: boolean, observerLocationSource = 'manual') {
  const context = {
    ground: false,
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
    setTop: () => {},
    setEclipseView: () => {},
    setCameraPose: () => {},
    setNotice: () => assert.fail('location failed'),
    seekTime: () =>
      assert.fail('mode changes must not seek or resume playback'),
    setEpoch: () => assert.fail('mode changes must not reset the clock'),
    setTime: () => assert.fail('mode changes must not replace the time'),
    setPaused: () => assert.fail('mode changes must preserve playback'),
    setSpeed: () => assert.fail('mode changes must preserve speed'),
    currentLocation: async () => ({ latitude: 31, longitude: 121 }),
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
  const toggle = runInNewContext(
    `${compiled}\nenterGround`,
    context,
  ) as () => void;
  return { context, toggle };
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
