// Composites the promo from the captured shots, one output frame at a time.
// Usage: node render.mjs <landscape|vertical> <outDir> [frame ...]
// The pages are loaded from PROMO_ASSETS, a server rooted at the repository
// (render.sh starts one), so they can reach the shot frames under PROMO_WORK.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../chrome.mjs';

const SIZES = { landscape: [1920, 1080], vertical: [1080, 1920] };
const [layout, outDir, ...only] = process.argv.slice(2);
if (!SIZES[layout] || !outDir) {
  console.error(
    'usage: node render.mjs <landscape|vertical> <outDir> [frame ...]',
  );
  process.exit(1);
}
const [width, height] = SIZES[layout];
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const work = path.resolve(
  process.env.PROMO_WORK || path.join(root, 'work/promo'),
);
const assets = process.env.PROMO_ASSETS || 'http://127.0.0.1:4318';
/** A path under the repository as the asset server addresses it. */
function served(dir) {
  const relative = path.relative(root, dir);
  if (relative.startsWith('..'))
    throw new Error(`${dir} must be inside the repository to be served`);
  return `/${relative.split(path.sep).join('/')}/`;
}

const timeline = JSON.parse(
  fs.readFileSync(path.join(here, '../timeline.json'), 'utf8'),
);
const shots = path.join(work, 'f30');
const frameCounts = Object.fromEntries(
  timeline.clips.map(({ shot }) => [
    shot,
    fs.readdirSync(path.join(shots, shot)).filter((f) => f.endsWith('.jpg'))
      .length,
  ]),
);

fs.mkdirSync(outDir, { recursive: true });
const browser = await launchChrome();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${assets}${served(here)}${layout}.html`);
await page.evaluate(() => document.fonts.ready);
await page.evaluate((config) => window.setup(config), {
  ...timeline,
  frameCounts,
  framesRoot: served(shots),
});
const total = Math.round(timeline.duration * timeline.fps);
const frames = only.length ? only.map(Number) : [...Array(total).keys()];
const started = Date.now();
for (const frame of frames) {
  await page.evaluate((frame) => window.render(frame), frame);
  await page.screenshot({
    path: path.join(outDir, `c${String(frame).padStart(4, '0')}.jpg`),
    type: 'jpeg',
    quality: 97,
    clip: { x: 0, y: 0, width, height },
  });
}
console.log(
  `${layout}: ${frames.length} frames in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
await browser.close();
