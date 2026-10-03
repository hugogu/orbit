import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackSkyLocation,
  type EclipseList,
  type EclipseQuery,
} from '../lib/sky-events';
import type { PlanetEventList } from '../lib/planet-events';

type Reply = { result?: EclipseList & PlanetEventList; error?: string };

void test('the worker returns planets on opening and only eclipses on follow-up pages', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const replies: Reply[] = [];
  const scope: {
    onmessage?: (event: MessageEvent<EclipseQuery>) => void;
    postMessage: (reply: Reply) => void;
  } = { postMessage: (reply) => replies.push(reply) };
  Object.defineProperty(globalThis, 'self', {
    value: scope,
    configurable: true,
  });
  try {
    await import('../workers/astronomy.worker');
    assert.ok(scope.onmessage);
    const query = {
      ...fallbackSkyLocation,
      start: Date.UTC(2026, 9, 3),
      count: 2,
    };
    scope.onmessage({ data: query } as MessageEvent<EclipseQuery>);
    const initial = replies.pop();
    assert.equal(initial?.error, undefined);
    assert.ok(initial?.result);
    assert.equal(initial.result.opposition.length, 15);
    assert.equal(initial.result.transit.length, 4);
    assert.ok(initial.result.solar.next);

    const start = initial.result.solar.next;
    scope.onmessage({
      data: { ...query, start, page: true },
    } as MessageEvent<EclipseQuery>);
    const page = replies.pop();
    assert.equal(page?.error, undefined);
    assert.ok(page?.result);
    assert.deepEqual(page.result.opposition, []);
    assert.deepEqual(page.result.transit, []);
    for (const kind of ['solar', 'lunar'] as const) {
      assert.equal(page.result[kind].events.length, query.count);
      assert.ok(page.result[kind].events.every((event) => event.peak >= start));
      assert.ok(
        page.result[kind].next! > page.result[kind].events.at(-1)!.peak,
      );
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'self', original);
    else Reflect.deleteProperty(globalThis, 'self');
  }
});
