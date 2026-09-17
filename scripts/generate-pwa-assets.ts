import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp/lib/index.js';
import { languages, translator, type Locale } from '../lib/i18n';
import { pwaManifest, pwaThemeColor } from '../lib/pwa';

export function renderOfflinePage(locale: Locale) {
  const t = translator(locale);
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  return `<!doctype html>
<html lang="${languages[locale].intl}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="${pwaThemeColor}">
  <meta name="robots" content="noindex">
  <title>${escape(t('当前页面尚未离线保存'))} | ORBIT</title>
  <link rel="icon" href="/favicon.svg">
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: ${pwaThemeColor}; color: #e6e9ee; }
    body { margin: 0; min-height: 100svh; display: grid; place-items: center; }
    main { max-width: 32rem; padding: 2rem; }
    .brand { color: #dbc499; letter-spacing: .25em; }
    h1 { font-size: clamp(1.5rem, 5vw, 2rem); line-height: 1.35; }
    p { line-height: 1.7; color: #a8b1bf; }
    a { display: inline-block; margin-top: 1rem; padding: .8rem 1.2rem; border: 1px solid #dbc499; border-radius: .6rem; color: #dbc499; text-decoration: none; }
    a:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
  </style>
</head>
<body><main>
  <p class="brand">ORBIT</p>
  <h1>${escape(t('当前页面尚未离线保存'))}</h1>
  <p>${escape(t('连接网络后可查看此页面，也可以返回已保存的太阳系模拟器继续探索。'))}</p>
  <a href="/?lang=${locale}">${escape(t('返回太阳系模拟器'))}</a>
</main></body>
</html>`;
}

export async function generatePwaAssets(publicDir = resolve('public')) {
  const iconsDir = resolve(publicDir, 'icons');
  const offlineDir = resolve(publicDir, 'offline');
  await mkdir(iconsDir, { recursive: true });
  await mkdir(offlineDir, { recursive: true });
  const favicon = await readFile(resolve(publicDir, 'favicon.svg'));
  for (const size of [192, 512, 180]) {
    await sharp(favicon)
      .resize(size, size)
      .flatten({ background: pwaThemeColor })
      .png()
      .toFile(
        resolve(
          iconsDir,
          size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`,
        ),
      );
  }
  await sharp(favicon)
    .resize(384, 384)
    .extend({
      top: 64,
      bottom: 64,
      left: 64,
      right: 64,
      background: pwaThemeColor,
    })
    .flatten({ background: pwaThemeColor })
    .png()
    .toFile(resolve(iconsDir, 'maskable-512.png'));
  await writeFile(
    resolve(publicDir, 'manifest.webmanifest'),
    `${JSON.stringify(pwaManifest, null, 2)}\n`,
  );
  for (const locale of Object.keys(languages) as Locale[]) {
    await writeFile(
      resolve(offlineDir, `${locale}.html`),
      renderOfflinePage(locale),
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
)
  await generatePwaAssets();
