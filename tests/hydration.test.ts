import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { dependencies: Record<string, string> };

// React 19.2 dropped a component's place among its siblings when hydration had
// to wait for that component's module and then replayed it, so every useId
// beneath it disagreed with the server whenever the explorer's own module was
// the last to arrive (facebook/react#35518). 19.3.0 is the first release that
// keeps it; no 19.2 patch release carries the fix.
void test('React stays on a release that keeps useId stable through hydration', () => {
  const versions = ['react', 'react-dom', 'react-server-dom-webpack'].map(
    (name) => manifest.dependencies[name],
  );
  // The server components runtime must match the renderer it streams into.
  assert.equal(new Set(versions).size, 1, versions.join(' / '));
  const [major, minor] = versions[0]
    .replace(/^[\^~]/, '')
    .split('.')
    .map(Number);
  assert.ok(
    major > 19 || (major === 19 && minor >= 3),
    `React ${versions[0]} still drops useId forks on hydration replay`,
  );
});
