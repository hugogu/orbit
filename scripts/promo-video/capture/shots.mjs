// The nine shots of the promo, each recorded at 60 fps into its own folder.
// Usage: node shots.mjs <shot> <outDir> [--preview]
// `--preview` saves every twelfth frame only, for quick framing checks.
// Moments, bodies and camera poses are staged through share links; see
// poses.mjs for how the Moon and Jupiter poses were found.
import {
  openStudio,
  open,
  record,
  setChrome,
  HIDE_ALL_UI,
  hideUi,
  shareUrl,
  cameraDriver,
  wheel,
  box,
  span,
  ease,
  lerp,
  togglePlay,
} from './studio.mjs';

const [name, outDir, flag] = process.argv.slice(2);
const keep = flag === '--preview' ? (i) => i % 12 === 0 : undefined;
// A site on the 2024 totality path, so its marker sits under the umbra.
const DALLAS = {
  latitude: 32.78,
  longitude: -96.8,
  height: 140,
  utcOffset: -5,
  timeZone: 'America/Chicago',
};
const frames = (seconds) => Math.round(seconds * 60);

const shots = {
  // Pull back from the Sun's surface to reveal the planets.
  async sun() {
    const s = await openStudio({
      prefs: { solarActivity: true, belts: true, orbitLineWidth: 1.5 },
    });
    await open(
      s.page,
      shareUrl({
        time: '2026-09-26T06:00:00Z',
        body: 'sun',
        speed: 3,
        camera: [0.35, 1.36, 0.17],
      }),
      16000,
    );
    await setChrome(s.page, HIDE_ALL_UI);
    const z0 = 0.17,
      z1 = 1.9,
      T = 2.3;
    const camera = cameraDriver(s, {
      zoom: (t) =>
        Math.exp(
          Math.log(z1 / z0) * span(t, 0.05, T, (x) => 1 - Math.pow(1 - x, 2.4)),
        ),
      azimuth: (t) => 0.4 * span(t, 0, T, ease.out),
      polar: (t) => 0.28 * span(t, 0, T),
    });
    await record(s, {
      frames: frames(T),
      outDir,
      keep,
      onFrame: (i, t) => camera(t),
    });
    return s;
  },

  // Orbit Saturn (2017, rings open and lit), click-to-fly to Jupiter, dolly in.
  async roam() {
    const s = await openStudio({
      prefs: { belts: false, solarActivity: true, orbitLineWidth: 1.5 },
    });
    // Visit Jupiter first so its maps are warm, then start at Saturn.
    await open(
      s.page,
      shareUrl({ time: '2017-10-01T00:00:00Z', body: 'jupiter', speed: 2 }),
      9000,
    );
    await open(
      s.page,
      shareUrl({
        time: '2017-10-01T00:00:00Z',
        body: 'saturn',
        speed: 2,
        camera: [4.0, 0.85, 0.3],
      }),
      15000,
    );
    await setChrome(s.page, HIDE_ALL_UI);
    const fly = 1.25,
      dolly = 2.2,
      T = 3.5;
    // Start with a little speed so the dolly carries on the flight's last
    // glide: any input aborts the flight, and starting from rest would stall.
    const glide = (x) => 0.2 * x + 0.8 * ease.inOut(x);
    const orbit = cameraDriver(s, {
      azimuth: (t) => 0.5 * span(t, 0, fly + 0.3, ease.linear),
      polar: (t) => -0.12 * span(t, 0, fly),
      zoom: (t) => 1 - 0.18 * span(t, 0, fly),
    });
    // The flight arrives facing Jupiter's night side (the Sun is ~121° round),
    // so swing towards the day side while closing in.
    const approach = cameraDriver(s, {
      zoom: (t) => 1 - 0.58 * span(t, dolly, T, glide),
      azimuth: (t) => 1.2 * span(t, dolly, T, glide),
      polar: (t) => -0.2 * span(t, dolly, T, glide),
    });
    let flown = false;
    await record(s, {
      frames: frames(T),
      outDir,
      keep,
      onFrame: async (i, t) => {
        if (t < fly) return orbit(t);
        if (!flown) {
          flown = true;
          return s.page.evaluate(() => {
            location.hash = '#jupiter';
          });
        }
        if (t >= dolly) return approach(t);
      },
    });
    return s;
  },

  // The Moon's shadow crossing North America on 8 April 2024 (UI hidden). The
  // view is centred on greatest eclipse, then the clock goes back to the start
  // of the central track and plays through at 58 simulated minutes a second.
  async eclipse() {
    const s = await openStudio({
      prefs: { belts: false, orbits: false },
      observer: DALLAS,
    });
    const p = s.page;
    await open(
      p,
      shareUrl({
        time: '2024-04-08T18:17:20Z',
        body: 'earth',
        paused: true,
        speed: 2,
      }),
      12000,
    );
    await p.locator('.eclipse-observe').click();
    await p.waitForTimeout(6000);
    await p.evaluate(() =>
      [...document.querySelectorAll('.eclipse-contacts button')]
        .find((b) => b.innerText.includes('Central track begins'))
        ?.click(),
    );
    await p.waitForTimeout(2500);
    await setChrome(p, HIDE_ALL_UI + hideUi('labels'));
    const z0 = 0.6,
      z1 = 0.48,
      T = 2.8;
    await wheel(p, z0);
    await p.waitForTimeout(2000);
    await p.evaluate(() => window.__vt.enable());
    await togglePlay(p);
    const camera = cameraDriver(s, {
      zoom: (t) => 1 + (z1 / z0 - 1) * span(t, 0, T),
      azimuth: (t) => 0.08 * span(t, 0, T),
    });
    // The link's speed is 0.1 day/s; a shorter virtual step slows it to 58 min/s.
    const stepMs = (58 / 8640) * 1000;
    await record(s, {
      frames: frames(T),
      outDir,
      stepMs,
      keep,
      onFrame: (i, t) => camera(t),
    });
    return s;
  },

  // The same eclipse with its live progress card; the chrome a punch-in would
  // crop is hidden.
  async eclipseui() {
    const s = await openStudio({
      prefs: { belts: false, orbits: false },
      observer: DALLAS,
    });
    const p = s.page;
    await open(
      p,
      shareUrl({
        time: '2024-04-08T18:08:00Z',
        body: 'earth',
        paused: true,
        speed: 1,
      }),
      12000,
    );
    await p.locator('.eclipse-observe').click();
    await p.waitForTimeout(6000);
    await p.evaluate(() => {
      for (const el of document.querySelectorAll(
        '.eclipse-progress, .eclipse-progress *',
      ))
        el.scrollTop = 0;
    });
    await setChrome(p, hideUi('top', 'bottom', 'navigator'));
    await p.waitForTimeout(500);
    await p.evaluate(() => window.__vt.enable());
    await togglePlay(p);
    const T = 1.8;
    const camera = cameraDriver(s, {
      zoom: (t) => 1 - 0.1 * span(t, 0, T),
      azimuth: (t) => 0.05 * span(t, 0, T),
    });
    // 80 ms per frame at 1 min/s keeps the card's readouts ticking.
    await record(s, {
      frames: frames(T),
      outDir,
      stepMs: 80,
      keep,
      onFrame: (i, t) => camera(t),
    });
    return s;
  },

  // The Moon seen from Earth's side, so its terminator matches the phase card.
  async moon() {
    const s = await openStudio({
      prefs: { belts: false, orbits: false },
      observer: DALLAS,
    });
    const p = s.page;
    await open(
      p,
      shareUrl({
        time: '2026-10-19T00:00:00Z',
        body: 'moon-moon',
        paused: true,
        speed: 2,
        camera: [-2.72, 1.52, 0.24],
      }),
      16000,
    );
    await setChrome(
      p,
      hideUi('top', 'rails', 'actions', 'info', 'bottom', 'labels'),
    );
    // Pan so the Moon sits right of centre, clear of the lower-left title.
    await p.evaluate(() => document.activeElement?.blur());
    for (const key of ['a', 'a', 'a', 's']) await p.keyboard.press(key);
    await p.waitForTimeout(1500);
    await p.evaluate(() => window.__vt.enable());
    await togglePlay(p);
    const T = 1.8;
    const camera = cameraDriver(s, {
      azimuth: (t) => 0.16 * span(t, 0, T),
      zoom: (t) => 1 - 0.12 * span(t, 0, T),
    });
    await record(s, {
      frames: frames(T),
      outDir,
      keep,
      onFrame: (i, t) => camera(t),
    });
    return s;
  },

  // The phase card opens the lunar panel; switch to the daily calendar.
  async lunar() {
    const s = await openStudio({
      prefs: { belts: false, orbits: false },
      observer: DALLAS,
    });
    const p = s.page;
    await open(
      p,
      shareUrl({
        time: '2026-10-19T00:00:00Z',
        body: 'moon-moon',
        paused: true,
        camera: [-2.72, 1.52, 0.3],
      }),
      16000,
    );
    const card = await box(p, '.moon-phase-card');
    const T = 2.4;
    let tab = null;
    await record(s, {
      frames: frames(T),
      outDir,
      keep,
      onFrame: async (i) => {
        if (i === 6) await p.mouse.click(card.x, card.y);
        if (i === 60)
          tab = await box(p, '[role="dialog"] [role="tab"]', 'Daily calendar');
        if (i === 66 && tab) await p.mouse.click(tab.x, tab.y);
      },
    });
    return s;
  },

  // Raise Jupiter's mass to a red dwarf's (2.95e29 kg) with the editor slider.
  async slider() {
    const s = await openStudio({ prefs: { orbitLineWidth: 1.5 } });
    const p = s.page;
    await open(
      p,
      shareUrl({
        time: '2026-09-26T00:00:00Z',
        sandbox: '-',
        body: 'jupiter',
        camera: [0.9, 1.2, 0.9],
      }),
      14000,
    );
    await setChrome(p, hideUi('top', 'bottom', 'navigator'));
    const field = '.info-panel .sandbox-field';
    const thumb = await box(p, `${field} [data-slot="slider-thumb"]`);
    const track = await box(p, `${field} [data-slot="slider-track"]`);
    // The slider maps the pointer across the track less half a thumb at each
    // end; 0.898 of its logarithmic range is 2.95e29 kg.
    const from = thumb.x;
    const to =
      track.left + thumb.width / 2 + (track.width - thumb.width) * 0.898;
    const T = 1.8,
      t0 = 0.25,
      t1 = 1.05;
    await record(s, {
      frames: frames(T),
      outDir,
      keep,
      onFrame: async (i, t) => {
        if (t < t0) return;
        if (i === frames(t0)) {
          await p.mouse.move(from, thumb.y);
          await p.mouse.down();
        }
        if (t <= t1)
          await p.mouse.move(lerp(from, to, span(t, t0, t1)), thumb.y);
        else if (i === frames(t1) + 3) await p.mouse.up();
      },
    });
    console.log(
      await p.evaluate(
        (field) =>
          document.querySelector(field)?.innerText.replace(/\s+/g, ' '),
        field,
      ),
    );
    return s;
  },

  // The aftermath: at 180 days/s the inner orbits wind into rosettes.
  async chaos() {
    const s = await openStudio({ prefs: { orbitLineWidth: 2 } });
    const p = s.page;
    await open(
      p,
      shareUrl({
        time: '2026-09-26T00:00:00Z',
        sandbox: 's,0,jupiter,mass,2.95e29',
        body: 'sun',
        camera: [0.3, 0.72, 1.5],
      }),
      9000,
    );
    // Rewind to the fork so the run starts at the change, then play at the
    // fastest rate.
    await p.evaluate(() => window.__vt.enable());
    const reset = await box(p, '.timeline .now-button');
    await p.mouse.click(reset.x, reset.y);
    await p.locator('.timeline input[type=range]').evaluate((el) => el.focus());
    await p.keyboard.press('End');
    await p.evaluate(() => document.activeElement.blur());
    await setChrome(p, HIDE_ALL_UI);
    const T = 3.3;
    const camera = cameraDriver(s, {
      azimuth: (t) => 0.45 * span(t, 0, T),
      zoom: (t) => 1 - 0.12 * span(t, 0, T),
      polar: (t) => 0.1 * span(t, 0, T),
    });
    // 80 ms is the scene's per-frame cap: 14.4 simulated days a frame.
    await record(s, {
      frames: frames(T),
      outDir,
      stepMs: 80,
      keep,
      onFrame: (i, t) => camera(t),
    });
    return s;
  },

  // A slow drift over the whole system, behind the end card.
  async plate() {
    const s = await openStudio({
      prefs: { belts: true, orbitLineWidth: 1.5, constellations: false },
    });
    const p = s.page;
    await open(
      p,
      shareUrl({
        time: '2026-09-26T00:00:00Z',
        speed: 5,
        view: 150,
        camera: [0.6, 1.15, 1],
      }),
      14000,
    );
    await setChrome(p, HIDE_ALL_UI + hideUi('labels'));
    const T = 3.3;
    const camera = cameraDriver(s, {
      azimuth: (t) => 0.2 * span(t, 0, T, ease.linear),
      zoom: (t) => 1 - 0.1 * span(t, 0, T, ease.linear),
    });
    await record(s, {
      frames: frames(T),
      outDir,
      keep,
      onFrame: (i, t) => camera(t),
    });
    return s;
  },
};

if (!shots[name] || !outDir) {
  console.error(
    `usage: node shots.mjs <${Object.keys(shots).join('|')}> <outDir> [--preview]`,
  );
  process.exit(1);
}
const studio = await shots[name]();
await studio.browser.close();
