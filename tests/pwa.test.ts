import test from 'node:test';
import assert from 'node:assert/strict';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp/lib/index.js';
import { languages, translator, type Locale } from '../lib/i18n';
import {
  isExplorerPath,
  isProfilePath,
  isPwaAssetPath,
  isPwaRequest,
  offlinePagePath,
  pwaManifest,
  pwaThemeColor,
} from '../lib/pwa';
import {
  generatePwaAssets,
  renderOfflinePage,
} from '../scripts/generate-pwa-assets';
import { buildPwa } from '../scripts/build-pwa';
import { htmlTagAttributes } from '../scripts/lib/html-tags';

const origin = 'https://orbit.example';

void test('PWA routes exclude APIs, analytics, mutations and RSC responses', () => {
  const request = new Request(`${origin}/`);
  assert.ok(isPwaRequest(request, new URL(request.url), origin));
  for (const blocked of [
    new Request(`${origin}/`, { method: 'POST' }),
    new Request(`${origin}/`, { headers: { RSC: '1' } }),
    new Request(`${origin}/?_rsc=payload`),
    new Request('https://analytics.example/assets/script.js'),
  ]) {
    assert.equal(isPwaRequest(blocked, new URL(blocked.url), origin), false);
  }
  for (const path of [
    '/api/events',
    '/_vercel/insights/script.js',
    '/_rsc',
    '/sw.js',
    '/account',
  ]) {
    assert.equal(isPwaAssetPath(path), false, path);
    assert.equal(isExplorerPath(path), false, path);
    assert.equal(isProfilePath(path), false, path);
  }
  for (const path of [
    '/assets/eclipse-worker-abc.js',
    '/_next/static/app.css',
    '/textures/8k_mars.jpg',
    '/models/asteroids/eros.bin',
  ])
    assert.ok(isPwaAssetPath(path), path);
  assert.ok(isExplorerPath('/'));
  assert.ok(isExplorerPath('/index.html'));
  assert.equal(isExplorerPath('/zh-CN/bodies/earth'), false);
  for (const [prefix, locale] of [
    ['zh-CN', 'zh-CN'],
    ['en-US', 'en'],
    ['ja-JP', 'ja'],
  ]) {
    assert.ok(isProfilePath(`/${prefix}/bodies/earth`));
    assert.equal(
      offlinePagePath(`/${prefix}/bodies/earth`),
      `/offline/${locale}.html`,
    );
  }
});

void test('offline pages use complete translations and link back to the simulator', () => {
  for (const locale of Object.keys(languages) as Locale[]) {
    const html = renderOfflinePage(locale);
    const t = translator(locale);
    assert.equal(
      htmlTagAttributes(html, 'html')[0].get('lang'),
      languages[locale].intl,
    );
    assert.ok(html.includes(t('当前页面尚未离线保存')));
    assert.ok(
      html.includes(
        t('连接网络后可查看此页面，也可以返回已保存的太阳系模拟器继续探索。'),
      ),
    );
    assert.ok(html.includes(`<a href="/?lang=${locale}">`));
    assert.doesNotMatch(html, /<script/i);
  }
});

void test('generated install assets have real PNG dimensions and maskable safe area', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'orbit-pwa-icons-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await copyFile('public/favicon.svg', join(dir, 'favicon.svg'));
  await generatePwaAssets(dir);
  assert.deepEqual(
    JSON.parse(await readFile(join(dir, 'manifest.webmanifest'), 'utf8')),
    pwaManifest,
  );
  assert.equal(pwaManifest.start_url, '/');
  assert.equal(pwaManifest.scope, '/');
  assert.equal(pwaManifest.display, 'standalone');
  assert.equal(pwaManifest.theme_color, pwaThemeColor);
  for (const icon of [
    ...pwaManifest.icons,
    { src: '/icons/apple-touch-icon.png', sizes: '180x180' },
  ]) {
    const metadata = await sharp(join(dir, icon.src)).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
    assert.equal(metadata.hasAlpha, false);
  }
  const { data, info } = await sharp(join(dir, 'icons/maskable-512.png'))
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const at = (y * 512 + x) * info.channels;
      // Every bright part of the mark stays in Android's 80% safe circle.
      if (data[at] > 80) assert.ok(Math.hypot(x - 256, y - 256) < 512 * 0.4);
    }
  }
});

void test('production worker bundles offline dependencies and changes revision with either build target', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'orbit-pwa-build-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const client = join(dir, 'client');
  for (const path of ['assets', 'textures/satellites', 'models', '../server'])
    await mkdir(join(client, path), { recursive: true });
  await copyFile('public/favicon.svg', join(client, 'favicon.svg'));
  await generatePwaAssets(client);
  for (const [path, content] of [
    ['index.html', '<html>first build</html>'],
    ['assets/app.js', 'console.log("app")'],
    ['assets/eclipse-worker.js', 'self.onmessage = () => {}'],
    ['assets/app.css', 'body { color: white }'],
    ['assets/app.js.map', '{}'],
    ['textures/2k_mars.jpg', 'base map'],
    ['textures/8k_mars.jpg', 'optional large map'],
    ['textures/satellites/2k_asteroid.jpg', 'pluto map'],
    ['models/optional.bin', 'large model'],
  ])
    await writeFile(join(client, path), content);
  const first = await buildPwa(client);
  const urls = first.manifestEntries.map(({ url }) => url);
  for (const url of [
    '/',
    '/assets/app.js',
    '/assets/eclipse-worker.js',
    '/assets/app.css',
    '/textures/2k_mars.jpg',
    '/offline/en.html',
  ])
    assert.ok(urls.includes(url), url);
  for (const url of [
    '/sw.js',
    '/assets/app.js.map',
    '/textures/8k_mars.jpg',
    '/models/optional.bin',
  ])
    assert.equal(urls.includes(url), false, url);
  const worker = await readFile(join(client, 'sw.js'), 'utf8');
  assert.doesNotMatch(
    worker,
    /__PRECACHE_MANIFEST__|__PWA_VERSION__|sourceMappingURL|importScripts\(/,
  );
  assert.equal((await buildPwa(client)).version, first.version);
  await writeFile(join(client, 'index.html'), '<html>second build</html>');
  assert.notEqual((await buildPwa(client)).version, first.version);
  await rm(join(client, 'index.html'));
  await writeFile(join(dir, 'server/index.js'), 'const title = "first";');
  const workerTarget = await buildPwa(client);
  await writeFile(join(dir, 'server/index.js'), 'const title = "second";');
  assert.notEqual((await buildPwa(client)).version, workerTarget.version);
});
