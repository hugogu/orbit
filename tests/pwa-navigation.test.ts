import assert from 'node:assert/strict';
import test from 'node:test';
import { explorerDocument } from '../lib/pwa-navigation';

const html = (version: string) =>
  new Response(`<html>${version}</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

function fixture() {
  const saved = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  let online = true;
  let version = 'new release';
  let storageAvailable = true;
  const store = {
    fetch: (async (_request, init) => {
      assert.equal(
        init?.cache,
        'no-cache',
        'revalidate the browser HTTP cache too',
      );
      if (!online) throw new TypeError('Offline');
      return html(version);
    }) as typeof fetch,
    match: async (path: string) => saved.get(path)?.clone(),
    save: async (path: string, response: Response) => {
      if (!storageAvailable) throw new Error('Quota exceeded');
      saved.set(path, response);
    },
    fallback: async (): Promise<Response | undefined> =>
      html('installed release'),
    waitUntil: (work: Promise<unknown>) => {
      pending.push(work);
    },
  };
  return {
    saved,
    pending,
    store,
    offline: () => {
      online = false;
    },
    release: (next: string) => {
      version = next;
    },
    full: () => {
      storageAvailable = false;
    },
  };
}

void test('new navigations see new deployments even while an old worker is active', async () => {
  const f = fixture();
  const request = new Request('https://orbit.example/?t=2026-11-03#moon-moon');
  f.saved.set('/', html('cached release'));
  assert.equal(
    await (await explorerDocument(request, f.store)).text(),
    '<html>new release</html>',
  );
  f.release('next deployment');
  assert.equal(
    await (await explorerDocument(request, f.store)).text(),
    '<html>next deployment</html>',
  );
  await Promise.all(f.pending);
  f.offline();
  assert.equal(
    await (await explorerDocument(request, f.store)).text(),
    '<html>next deployment</html>',
  );
  assert.deepEqual(
    [...f.saved.keys()],
    ['/'],
    'shared times do not create separate HTML caches',
  );
});

void test('offline navigation retains each visited locale and falls back to the installed explorer', async () => {
  const f = fixture();
  const request = new Request('https://orbit.example/ja-JP?t=2026-11-03');
  f.release('Japanese document');
  await explorerDocument(request, f.store);
  await Promise.all(f.pending);
  f.offline();
  assert.equal(
    await (await explorerDocument(request, f.store)).text(),
    '<html>Japanese document</html>',
  );
  assert.equal(
    await (
      await explorerDocument(new Request('https://orbit.example/'), f.store)
    ).text(),
    '<html>installed release</html>',
  );
});

void test('bad network responses never replace a working offline document', async () => {
  const f = fixture();
  const request = new Request('https://orbit.example/');
  f.saved.set('/', html('working release'));
  for (const response of [
    new Response('Unavailable', { status: 503 }),
    new Response('not HTML'),
  ]) {
    f.store.fetch = (async () => response) as typeof fetch;
    assert.equal(
      await (await explorerDocument(request, f.store)).text(),
      '<html>working release</html>',
    );
    assert.equal(f.pending.length, 0);
  }
  f.saved.clear();
  f.store.fallback = async () => undefined;
  assert.equal((await explorerDocument(request, f.store)).type, 'error');
});

void test('an exhausted storage quota does not hide a successful online update', async () => {
  const f = fixture();
  f.full();
  assert.equal(
    await (
      await explorerDocument(new Request('https://orbit.example/'), f.store)
    ).text(),
    '<html>new release</html>',
  );
  await Promise.all(f.pending);
});
