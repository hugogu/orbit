import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import { getManifest } from 'workbox-build';

export async function buildPwa(clientDir = resolve('dist/client')) {
  const { manifestEntries, warnings, size } = await getManifest({
    globDirectory: clientDir,
    globPatterns: [
      '{assets,_next/static}/**/*.{js,css,woff,woff2}',
      'icons/*.png',
      'offline/*.html',
      'manifest.webmanifest',
      'favicon.svg',
      'textures/2k_*.{jpg,png}',
      'sky/*.{bin,json}',
      'textures/satellites/2k_asteroid.jpg',
    ],
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    modifyURLPrefix: { '': '/' },
  });
  if (warnings.length) throw new Error(warnings.join('\n'));
  if (!manifestEntries.some(({ url }) => url.endsWith('.js')))
    throw new Error('PWA build requires the compiled client application.');

  // Include server-only document changes in the Worker target's revision too.
  const hash = createHash('sha256').update(JSON.stringify(manifestEntries));
  try {
    hash.update(await readFile(resolve(clientDir, 'index.html')));
  } catch {
    const serverDir = resolve(clientDir, '../server');
    const files = (await readdir(serverDir, { recursive: true })).sort();
    for (const file of files) {
      if (file.endsWith('.js'))
        hash.update(await readFile(resolve(serverDir, file)));
    }
  }
  const version = hash.digest('hex').slice(0, 16);
  manifestEntries.push({ url: '/', revision: version });

  await build({
    configFile: false,
    publicDir: false,
    define: {
      __PRECACHE_MANIFEST__: JSON.stringify(manifestEntries),
      __PWA_VERSION__: JSON.stringify(version),
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: clientDir,
      emptyOutDir: false,
      sourcemap: false,
      lib: {
        entry: resolve('pwa/service-worker.ts'),
        formats: ['iife'],
        name: 'OrbitServiceWorker',
        fileName: () => 'sw.js',
      },
    },
  });
  console.log(
    `PWA: ${manifestEntries.length} precached URLs, ${(size / 1024 / 1024).toFixed(1)} MiB + explorer HTML (${version}).`,
  );
  return { manifestEntries, version, size };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
)
  await buildPwa();
