// Deterministic frame-by-frame capture of the ORBIT explorer in headless Chrome.
//
// The page runs in real time while it loads. `record` then switches it to a
// virtual clock: requestAnimationFrame callbacks are queued and flushed once
// per output frame with a fixed timestamp step, and performance.now() reports
// the same virtual time, so camera damping, flights and the simulation clock
// advance exactly one frame per capture however long a capture takes.
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome } from '../chrome.mjs';

/** The static export being filmed; render.sh serves `dist/client` here. */
export const ORIGIN = process.env.PROMO_SITE || 'http://127.0.0.1:4317/';

const virtualClock = () => {
  const realNow = performance.now.bind(performance);
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCAF = window.cancelAnimationFrame.bind(window);
  const queue = new Map();
  let nextId = 1;
  const vt = {
    enabled: false,
    now: 0,
    enable() {
      if (this.enabled) return;
      this.now = realNow();
      this.enabled = true;
    },
    step(ms) {
      this.now += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) {
        try {
          cb(this.now);
        } catch (error) {
          console.error('rAF callback failed', error);
        }
      }
      return callbacks.length;
    },
  };
  window.__vt = vt;
  // Synthetic pointers have no real capture target; let capture calls pass.
  for (const name of ['setPointerCapture', 'releasePointerCapture']) {
    const native = Element.prototype[name];
    Element.prototype[name] = function (id) {
      try {
        return native.call(this, id);
      } catch {
        return undefined;
      }
    };
  }
  performance.now = () => (vt.enabled ? vt.now : realNow());
  window.requestAnimationFrame = (cb) => {
    if (!vt.enabled) return nativeRAF(cb);
    const id = 1e9 + nextId++;
    queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (queue.delete(id)) return;
    nativeCAF(id);
  };
};

export async function openStudio({
  width = 1280,
  height = 720,
  dpr = 2,
  prefs = {},
  observer = null,
} = {}) {
  const browser = await launchChrome();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    locale: 'en-US',
    serviceWorkers: 'block',
    timezoneId: 'UTC',
  });
  const stored = {
    textureQuality: 'ultra',
    stars: true,
    constellations: false,
    galaxy: true,
    labels: true,
    orbits: true,
    ...prefs,
  };
  if (observer) {
    stored.observerLocation = observer;
    stored.observerLocationSource = 'manual';
  }
  await context.addInitScript(
    ({ stored }) => {
      localStorage.setItem('orbit-language', 'en-US');
      localStorage.setItem(
        'orbit-observatory-preferences-v1',
        JSON.stringify(stored),
      );
    },
    { stored },
  );
  await context.addInitScript(virtualClock);
  // Only the local build: no ads, analytics or other third-party traffic.
  await context.route(
    (url) => !url.href.startsWith(ORIGIN),
    (route) => route.abort(),
  );
  const page = await context.newPage();
  // A busy machine can take well past Playwright's 30 s defaults.
  page.setDefaultTimeout(120_000);
  page.on('pageerror', (e) =>
    console.log('pageerror:', e.message.slice(0, 300)),
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  return { browser, context, page, cdp, width, height, dpr };
}

/**
 * Navigate, then let the scene settle: wait for the network to go quiet (maps
 * and models arrive well after the load event), then `settleMs` more for
 * camera flights and the high-resolution maps to land.
 */
export async function open(page, url, settleMs) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page
    .waitForLoadState('networkidle', { timeout: 90_000 })
    .catch(() => {});
  await page.waitForTimeout(settleMs);
}

/** Replace the page's injected stylesheet, used to hide interface parts. */
export async function setChrome(page, css) {
  await page.evaluate((css) => {
    let style = document.getElementById('__studio_css');
    if (!style) {
      style = document.createElement('style');
      style.id = '__studio_css';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }, css);
}

export const UI_PARTS = {
  top: '.topbar, .scene-caption',
  rails: '.side-rail',
  navigator: '.side-rail.rail-start',
  actions: '.astronomy-actions',
  info: '.info-panel',
  bottom: '.bottom-area',
  cards: '.moon-phase-card, .eclipse-progress',
  labels: '.scene-labels',
};

/** CSS that hides the named interface parts without moving anything else. */
export function hideUi(...parts) {
  const selectors = parts.map((part) => UI_PARTS[part]).join(', ');
  return `${selectors} { opacity: 0 !important; transition: none !important; pointer-events: none !important; }`;
}

export const HIDE_ALL_UI = hideUi(
  'top',
  'rails',
  'actions',
  'info',
  'bottom',
  'cards',
);

/** Start or stop the clock the way a viewer would, with nothing focused. */
export async function togglePlay(page) {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Space');
}

/**
 * Capture `frames` frames at `fps`. `onFrame(i, t)` runs before each frame is
 * stepped and may drive input. `stepMs` overrides the virtual time a frame
 * advances, which speeds the simulation relative to the video. Frames are
 * written as JPEG to `outDir`; `keep(i)` can skip saving for quick previews.
 */
export async function record(
  studio,
  { frames, fps = 60, outDir, onFrame, stepMs, keep = () => true },
) {
  const { page, cdp } = studio;
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const frameMs = stepMs ?? 1000 / fps;
  await page.evaluate(() => window.__vt.enable());
  let realPerFrame = 150;
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    const before = Date.now();
    // CSS animations run on the real clock; slow them to the capture rate.
    await cdp.send('Animation.setPlaybackRate', {
      playbackRate: Math.min(1, 1000 / fps / realPerFrame),
    });
    if (onFrame) await onFrame(i, t);
    await page.evaluate((ms) => window.__vt.step(ms), frameMs);
    if (!keep(i)) continue;
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 94,
      fromSurface: true,
      // Without an explicit scale CDP returns CSS pixels, not device pixels.
      clip: {
        x: 0,
        y: 0,
        width: studio.width,
        height: studio.height,
        scale: studio.dpr,
      },
    });
    fs.writeFileSync(
      path.join(outDir, `f${String(i).padStart(5, '0')}.jpg`),
      Buffer.from(shot.data, 'base64'),
    );
    realPerFrame = realPerFrame * 0.8 + (Date.now() - before) * 0.2;
  }
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  const seconds = (Date.now() - started) / 1000;
  console.log(`recorded ${frames} frames in ${seconds.toFixed(1)}s`);
}

export const ease = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
};
export const lerp = (a, b, x) => a + (b - a) * x;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** Eased progress of `t` from `t0` to `t1`. */
export const span = (t, t0, t1, curve = ease.inOut) =>
  curve(clamp01((t - t0) / (t1 - t0)));

/** Share-link URL for a moment, body, camera pose or sandbox recipe. */
export function shareUrl({
  time,
  body = '',
  paused = false,
  speed,
  camera,
  view,
  sandbox,
}) {
  const params = new URLSearchParams({
    lang: 'en-US',
    t: new Date(time).toISOString(),
  });
  if (paused) params.set('p', '1');
  if (speed !== undefined) params.set('s', String(speed));
  if (camera) params.set('c', camera.join(','));
  if (view) params.set('v', String(view));
  if (sandbox) params.set('sb', sandbox);
  return `${ORIGIN}?${params}${body ? `#${body}` : ''}`;
}

/** Dolly the camera by `factor` in one step, as a wheel turn would. */
export async function wheel(page, factor) {
  await page.evaluate(
    (deltaY) => {
      document.querySelector('.scene canvas').dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY,
          clientX: 40,
          clientY: 40,
        }),
      );
    },
    (100 * Math.log(factor)) / -Math.log(0.95),
  );
}

/**
 * Drives OrbitControls with synthetic input so the camera follows eased curves.
 * `azimuth(t)` and `polar(t)` return cumulative rotation in radians (positive
 * azimuth swings the camera to the right around the target, positive polar
 * lifts it towards the pole); `zoom(t)` returns the cumulative distance factor.
 *
 * Events are dispatched on the canvas itself. OrbitControls ignores the wheel
 * while a drag is in progress, so each frame's rotation is its own press, move
 * and release, and the release lands far from the press: the scene reads a
 * release within 5 px of its press as a click and would select whatever body
 * lies under it. Rotation goes through OrbitControls' damping, so it trails
 * the curve slightly. Any drag or wheel also aborts a camera flight.
 */
export function cameraDriver(
  studio,
  { azimuth = () => 0, polar = () => 0, zoom = () => 1 },
) {
  const pxPerRad = studio.height / (2 * Math.PI);
  let lastAz = 0,
    lastPolar = 0,
    lastZoom = 1;
  return async function frame(t) {
    const az = azimuth(t),
      po = polar(t),
      z = zoom(t);
    const dx = -(az - lastAz) * pxPerRad,
      dy = (po - lastPolar) * pxPerRad;
    const rotate = Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5;
    const deltaY =
      Math.abs(z / lastZoom - 1) > 1e-7
        ? (100 * Math.log(z / lastZoom)) / -Math.log(0.95)
        : 0;
    lastAz = az;
    lastPolar = po;
    lastZoom = z;
    if (!rotate && !deltaY) return;
    await studio.page.evaluate(
      ({ dx, dy, rotate, deltaY }) => {
        const canvas = document.querySelector('.scene canvas');
        const pointer = (x, y, buttons) => ({
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
        });
        if (rotate) {
          canvas.dispatchEvent(
            new PointerEvent('pointerdown', pointer(40, 40, 1)),
          );
          canvas.dispatchEvent(
            new PointerEvent('pointermove', pointer(40 + dx, 40 + dy, 1)),
          );
          canvas.dispatchEvent(
            new PointerEvent('pointerup', pointer(400, 400, 0)),
          );
        }
        if (deltaY)
          canvas.dispatchEvent(
            new WheelEvent('wheel', {
              bubbles: true,
              cancelable: true,
              deltaY,
              clientX: 40,
              clientY: 40,
            }),
          );
      },
      { dx, dy, rotate, deltaY },
    );
  };
}

/** Centre and box of an element, for trusted clicks while rAF is held. */
export async function box(page, selector, text) {
  return page.evaluate(
    ({ selector, text }) => {
      const el = [...document.querySelectorAll(selector)].find(
        (e) => !text || e.innerText.includes(text),
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        left: r.left,
        width: r.width,
      };
    },
    { selector, text },
  );
}

/**
 * The scene's own camera pose, read through the React ref it publishes, for
 * tuning a shot: `{ azimuth, polar, zoom }` as a share link encodes them.
 */
export async function scenePose(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.scene');
    const key =
      el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    let fiber = key ? el[key] : null;
    while (fiber && !fiber.memoizedProps?.sceneRef) fiber = fiber.return;
    return fiber?.memoizedProps.sceneRef.current?.pose() ?? null;
  });
}
