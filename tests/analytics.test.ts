import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

void test('only the page-view provider uses Vercel Analytics', () => {
  const files = ['app', 'components', 'lib'].flatMap(sourceFiles);
  const analyticsUsers = files.filter((file) =>
    readFileSync(file, 'utf8').includes('@vercel/analytics'),
  );

  assert.deepEqual(analyticsUsers, ['app/root-providers.tsx']);
  const provider = readFileSync(analyticsUsers[0], 'utf8');
  assert.match(provider, /import \{ Analytics \} from '@vercel\/analytics\/next'/);
  assert.match(provider, /<Analytics \/>/);
});
