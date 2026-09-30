// Shared by both layouts of the compositor: the edit timeline, easing, cut
// transitions and impacts, the replayed cursor, title blocks and the end card.
// A page supplies only its own framing, text and placement.

export const ease = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  outBack: (x) => 1 + 2.5 * Math.pow(x - 1, 3) + 1.5 * Math.pow(x - 1, 2),
};
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, x) => a + (b - a) * x;
/** Eased progress of `t` from `a` to `b`. */
export const span = (t, a, b, curve = ease.linear) =>
  curve(clamp01((t - a) / (b - a)));
/** Fade in over `rise`, hold, fade out over `fall`. */
export const envelope = (t, [start, end], rise = 0.3, fall = 0.2) =>
  Math.min(
    span(t, start, start + rise, ease.out),
    1 - span(t, end - fall, end, ease.in),
  );

/** Values at `t` along `[time, ...values]` keyframes, eased between them. */
export function keyframes(list, t) {
  if (t <= list[0][0]) return list[0].slice(1);
  for (let i = 1; i < list.length; i++) {
    if (t <= list[i][0]) {
      const x = ease.inOut(
        (t - list[i - 1][0]) / (list[i][0] - list[i - 1][0]),
      );
      return list[i].slice(1).map((v, k) => lerp(list[i - 1][k + 1], v, x));
    }
  }
  return list[list.length - 1].slice(1);
}

let timeline;
/** Takes timeline.json plus the render's frame counts and frame folder URL. */
export function setup(config) {
  timeline = config;
}
export const plan = () => timeline;

/** The clip on screen at an output frame, and the source frame it shows. */
export function frameAt(frame) {
  const { fps, clips, frameCounts, framesRoot } = timeline;
  const t = frame / fps;
  const clip =
    clips.find((c) => t >= c.start - 1e-6 && t < c.end - 1e-6) ?? clips.at(-1);
  const local = t - clip.start;
  const index = Math.min(
    frameCounts[clip.shot] - 1,
    Math.round((clip.in + local) * fps),
  );
  const src = `${framesRoot}${clip.shot}/f${String(index).padStart(4, '0')}.jpg`;
  return { t, clip, local, src };
}

const cutAt = (time) => timeline.cuts[String(Number(time.toFixed(3)))];

/**
 * Camera treatment at a moment: a zoom-through on either side of a cut, a
 * punch-in after a hard cut, and a flash with a short shake on each impact —
 * the opening frame and the end card. `shake` scales the shake to the layout.
 */
export function effects(clip, t, local, shake = 1) {
  let scale = 1,
    blur = 0,
    bright = 1,
    flash = 0,
    dx = 0,
    dy = 0;
  const outCut = cutAt(clip.end),
    inCut = cutAt(clip.start);
  const toEnd = clip.end - t;
  if ((outCut === 'zoom' || outCut === 'flashzoom') && toEnd < 0.17) {
    const x = ease.in(1 - toEnd / 0.17);
    scale *= 1 + 0.2 * x;
    blur = 10 * x;
    bright = 1 + 0.35 * x;
  }
  if ((inCut === 'zoom' || inCut === 'flashzoom') && local < 0.2) {
    const x = 1 - ease.out(local / 0.2);
    scale *= 1 + 0.16 * x;
    blur = Math.max(blur, 10 * x);
    bright = Math.max(bright, 1 + 0.35 * x);
    const peak = inCut === 'flashzoom' ? 0.55 : 0.22;
    flash = Math.max(flash, peak * (1 - ease.out(Math.min(1, local / 0.15))));
  }
  if (inCut === 'punch' && local < 0.17)
    scale *= 1 + 0.07 * (1 - ease.out(local / 0.17));
  for (const hit of [0, timeline.endCard]) {
    const since = t - hit;
    if (since < 0 || since >= 0.45) continue;
    const decay = Math.pow(1 - since / 0.45, 2);
    // The opening flash ramps in so the first frame, often the cover, shows the Sun.
    const ramp = hit ? 1 : Math.min(1, since / 0.07);
    flash = Math.max(flash, (hit ? 0.95 : 0.7) * ramp * decay);
    const k = (hit ? 16 : 10) * shake * decay;
    dx += k * Math.sin(since * 97);
    dy += k * Math.cos(since * 83);
  }
  return { scale, blur, bright, flash, dx, dy };
}

/**
 * The pointer replaying the capture's real clicks and drag, in coordinates
 * normalized to the captured frame, or null while none is on screen.
 * `ripple` is the progress of a click's ring, or null between clicks.
 */
export function cursorAt(t) {
  const path = timeline.cursor.find((p) => t >= p.from && t <= p.to);
  if (!path) return null;
  const [x, y] = keyframes(path.points, t);
  const alpha = Math.min(
    span(t, path.from, path.from + 0.12),
    1 - span(t, path.to - 0.2, path.to),
  );
  let press = 1,
    ripple = null;
  for (const click of path.clicks) {
    const since = t - click;
    if (since >= -0.06 && since < 0.12) press = 0.86;
    if (since >= 0 && since < 0.45) ripple = span(since, 0, 0.45, ease.out);
  }
  if (path.held && t >= path.held[0] && t < path.held[1]) press = 0.86;
  return { x, y, alpha, press, ripple };
}

/**
 * A numbered feature title: the index and its rule slide in, the name wipes
 * on, the line beneath rises, and the block slides away at the end.
 */
export function animateTitle(el, t, [start, end]) {
  const inX = span(t, start, start + 0.35, ease.out);
  const nameX = span(t, start + 0.06, start + 0.46, ease.out);
  const subX = span(t, start + 0.22, start + 0.6, ease.out);
  const out = span(t, end - 0.22, end, ease.in);
  el.style.opacity = t >= start - 0.01 && t <= end + 0.01 ? 1 - out : 0;
  el.style.transform = `translateX(${-60 * out}px)`;
  const index = el.querySelector('.index');
  index.style.opacity = inX;
  index.style.transform = `translateX(${lerp(-30, 0, inX)}px)`;
  index.querySelector('i').style.transform = `scaleX(${inX})`;
  const name = el.querySelector('.name');
  name.style.clipPath = `inset(-20% ${100 - 100 * nameX}% -20% 0)`;
  name.style.transform = `translateX(${lerp(-40, 0, nameX)}px)`;
  const sub = el.querySelector('.sub');
  sub.style.opacity = subX;
  sub.style.transform = `translateY(${lerp(16, 0, subX)}px)`;
}

/** A pill that pops in and out; `base` keeps a layout's own positioning. */
export function animateCallout(el, t, [start, end], base = '') {
  const grow = span(t, start, start + 0.2, ease.outBack);
  const out = span(t, end - 0.13, end - 0.01, ease.in);
  el.style.opacity =
    t >= start && t <= end ? Math.min(1, grow * 1.4) * (1 - out) : 0;
  el.style.transform = `${base} scale(${lerp(0.7, 1, grow)})`;
}

/** Everything on screen fades to black over the last half second. */
export const fadeToBlack = (t) =>
  1 - span(t, timeline.duration - 0.45, timeline.duration - 0.03);

/** The end card's logo, wordmark and lines, timed from the final impact. */
export function animateEndCard(t) {
  const $ = (id) => document.getElementById(id);
  const e0 = timeline.endCard;
  const markIn = span(t, e0, e0 + 0.45, ease.outBack);
  const turn = lerp(-60, 0, span(t, e0, e0 + 0.6, ease.out));
  $('mark').style.transform =
    `scale(${lerp(0.4, 1, markIn)}) rotate(${turn}deg)`;
  $('ring').setAttribute(
    'stroke-dashoffset',
    String(100 - 100 * span(t, e0 + 0.05, e0 + 0.7, ease.inOut)),
  );
  // The planet rides the logo's tilted ellipse (rx 24, ry 15, turned -40°).
  const orbit = span(t, e0 + 0.35, timeline.duration) * Math.PI * 1.1 + 1.02;
  const tilt = (-40 * Math.PI) / 180;
  const ex = 24 * Math.cos(-orbit),
    ey = 15 * Math.sin(-orbit);
  const planet = $('planet');
  planet.setAttribute(
    'cx',
    String(32 + ex * Math.cos(tilt) - ey * Math.sin(tilt)),
  );
  planet.setAttribute(
    'cy',
    String(32 + ex * Math.sin(tilt) + ey * Math.cos(tilt)),
  );
  planet.style.opacity = span(t, e0 + 0.35, e0 + 0.55);
  const w = span(t, e0 + 0.08, e0 + 0.55, ease.out);
  const tracking = lerp(0.62, 0.3, w);
  Object.assign($('word').style, {
    opacity: w,
    letterSpacing: `${tracking}em`,
    filter: `blur(${lerp(14, 0, w)}px)`,
  });
  // Tracking also trails the last letter; take it back so the word stays centred.
  $('word').querySelector('span').style.marginRight = `${-tracking}em`;
  const tg = span(t, e0 + 0.45, e0 + 0.85, ease.out);
  Object.assign($('tagline').style, {
    opacity: tg,
    transform: `translateY(${lerp(18, 0, tg)}px)`,
  });
  const u = span(t, e0 + 0.95, e0 + 1.35, ease.outBack);
  Object.assign($('url').style, {
    opacity: Math.min(1, u * 1.3),
    transform: `translateX(-50%) scale(${lerp(0.8, 1, u)})`,
  });
  const pk = span(t, e0 + 1.3, e0 + 1.7, ease.out);
  Object.assign($('perks').style, {
    opacity: pk,
    transform: `translateY(${lerp(14, 0, pk)}px)`,
  });
}
