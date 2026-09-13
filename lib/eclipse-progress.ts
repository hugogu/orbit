import { SearchGlobalSolarEclipse, SearchLunarEclipse } from 'astronomy-engine';
import { Vector3 } from 'three';
import { bodyOrientation } from './ephemeris';
import {
  shadowFrame,
  shadowAxisHit,
  shadowBoundary,
  obscuration,
  SUN_RADIUS_KM,
} from './eclipse-shadows';
import { DAY_MS, J2000_MS, validTime } from './simulation-time';

export type SurfacePoint = [number, number, number];
export type EclipsePhase = { key: string; time: number };
export type EclipseCircumstance = {
  time: number;
  point: SurfacePoint;
  latitude: number;
  longitude: number;
  obscuration: number;
  kind: 'total' | 'annular';
};
export type EclipsePath = {
  coverage: 'central' | 'partial';
  triangles: Float32Array;
  centers: EclipseCircumstance[];
};
export type EclipseProgressEvent = {
  id: string;
  type: 'solar' | 'lunar';
  kind: string;
  start: number;
  peak: number;
  end: number;
  phases: EclipsePhase[];
  central?: { start: number; end: number };
  path?: EclipsePath;
};

const HOUR = 3600000;
const daysAt = (time: number) => (time - J2000_MS) / DAY_MS;
function solarFrame(time: number) {
  const frame = shadowFrame(daysAt(time), ['earth', 'moon-moon']);
  return {
    earth: frame.get('earth')!,
    moon: frame.get('moon-moon')!,
    sun: frame.get('sun')!.position,
  };
}

// Signed distance from Earth's centre to the penumbral cone (or its axis).
// Cone/sphere tangency gives global contacts, independently of observer location.
export function solarContactMargin(time: number, central: boolean) {
  const { earth, moon, sun } = solarFrame(time);
  const direction = moon.position.clone().sub(sun);
  const distance = direction.length();
  direction.divideScalar(distance);
  const target = earth.position.clone().sub(moon.position);
  const z = target.dot(direction);
  const r = target.clone().cross(direction).length();
  if (central) return r - earth.radius;
  const sine = (SUN_RADIUS_KM + moon.radius) / distance;
  return r * Math.sqrt(1 - sine * sine) - z * sine - moon.radius - earth.radius;
}

function contact(peak: number, direction: -1 | 1, central: boolean) {
  let inside = peak,
    outside = peak + direction * 6 * HOUR;
  if (
    solarContactMargin(inside, central) >= 0 ||
    solarContactMargin(outside, central) <= 0
  )
    return;
  while (Math.abs(outside - inside) > 250) {
    const mid = (inside + outside) / 2;
    if (solarContactMargin(mid, central) <= 0) inside = mid;
    else outside = mid;
  }
  return (inside + outside) / 2;
}

export function solarCircumstance(time: number): EclipseCircumstance | null {
  const { earth, moon, sun } = solarFrame(time);
  const hit = shadowAxisHit(earth, sun, moon);
  if (!hit) return null;
  const world = hit.clone().add(earth.position);
  const coverage = obscuration(world, sun, moon.position, moon.radius);
  const local = hit
    .divideScalar(earth.radius)
    .applyQuaternion(bodyOrientation('earth', daysAt(time)).invert());
  return {
    time,
    point: local.toArray() as SurfacePoint,
    latitude: (Math.asin(Math.max(-1, Math.min(1, local.y))) * 180) / Math.PI,
    longitude: (Math.atan2(-local.z, local.x) * 180) / Math.PI,
    obscuration: coverage,
    kind: coverage >= 1 - 1e-8 ? 'total' : 'annular',
  };
}

export function solarPathWidth(time: number): number | null {
  const current = solarCircumstance(time);
  const before = solarCircumstance(time - 1000),
    after = solarCircumstance(time + 1000);
  if (!current || !before || !after) return null;
  const center = new Vector3(...current.point);
  const tangent = new Vector3(...after.point).sub(new Vector3(...before.point));
  const across = center.clone().cross(tangent).normalize();
  const { earth, moon, sun } = solarFrame(time);
  const rotation = bodyOrientation('earth', daysAt(time)).invert();
  const boundary = shadowBoundary(
    earth,
    sun,
    moon,
    current.kind === 'total' ? 'umbra' : 'antumbra',
  );
  // Near sunrise/sunset, a clipped footprint has no reliable full cross-section.
  if (boundary.some((p) => p === null)) return null;
  const angles = boundary.map((p) => {
    const local = p!.clone().normalize().applyQuaternion(rotation);
    return Math.atan2(local.dot(across), local.dot(center));
  });
  return (Math.max(...angles) - Math.min(...angles)) * earth.radius;
}

// Subdivide on the sphere so long triangles at sunrise/sunset do not sink into
// the globe. Input and output stay in Earth-fixed unit-radius coordinates.
function triangle(
  out: number[],
  a: Vector3,
  b: Vector3,
  c: Vector3,
  depth = 0,
) {
  const edges = [
    a.distanceToSquared(b),
    b.distanceToSquared(c),
    c.distanceToSquared(a),
  ];
  const max = Math.max(...edges);
  if (max > 0.0012 && depth < 12) {
    const i = edges.indexOf(max);
    const [p, q, r] = i === 0 ? [a, b, c] : i === 1 ? [b, c, a] : [c, a, b];
    const mid = p.clone().add(q).normalize();
    triangle(out, p, mid, r, depth + 1);
    triangle(out, mid, q, r, depth + 1);
  } else out.push(...a.toArray(), ...b.toArray(), ...c.toArray());
}

export function calculateSolarPath(event: EclipseProgressEvent): EclipsePath {
  const coverage = event.central ? 'central' : 'partial';
  const kinds =
    coverage === 'central'
      ? (['umbra', 'antumbra'] as const)
      : (['penumbra'] as const);
  const triangles: number[] = [],
    centers: EclipseCircumstance[] = [];
  const previous = new Map<string, (Vector3 | null)[]>();
  // Sample the whole event, including the limb caps outside the axis contacts.
  // Sweep consecutive footprints as well, so a narrow/hybrid path cannot acquire
  // gaps simply because the shadow travels farther than its width in one step.
  const count = Math.ceil((event.end - event.start) / 60000);
  const samples = new Set(
    Array.from(
      { length: count + 1 },
      (_, i) => event.start + ((event.end - event.start) * i) / count,
    ),
  );
  // The shadow moves rapidly across the limb. Resolve the entry/exit caps more
  // densely and include the axis contacts rather than truncating the end points.
  for (const edge of event.central
    ? [event.central.start, event.central.end]
    : [event.start, event.end]) {
    for (let offset = -300000; offset <= 300000; offset += 10000) {
      if (edge + offset >= event.start && edge + offset <= event.end)
        samples.add(edge + offset);
    }
    for (const offset of [-1000, 1000])
      if (edge + offset > event.start && edge + offset < event.end)
        samples.add(edge + offset);
  }
  for (const time of [...samples].sort((a, b) => a - b)) {
    const { earth, moon, sun } = solarFrame(time);
    const rotation = bodyOrientation('earth', daysAt(time)).invert();
    const circumstance = solarCircumstance(time);
    if (circumstance) centers.push(circumstance);
    for (const kind of kinds) {
      const ring = shadowBoundary(earth, sun, moon, kind, 96).map(
        (p) => p?.divideScalar(earth.radius).applyQuaternion(rotation) ?? null,
      );
      const valid = ring.filter((p): p is Vector3 => p !== null);
      // The first footprint plus swept boundary strips describes the union.
      // Refill only limb-clipped footprints, whose boundary can gain/lose points.
      const before = previous.get(kind);
      if (
        valid.length >= 3 &&
        (!before ||
          valid.length !== ring.length ||
          before.some((p) => p === null))
      ) {
        const center = valid
          .reduce((sum, p) => sum.add(p), new Vector3())
          .normalize();
        for (let j = 0; j < valid.length; j++)
          triangle(triangles, center, valid[j], valid[(j + 1) % valid.length]);
      }
      if (before)
        for (let j = 1; j < ring.length; j++) {
          const a = before[j - 1],
            b = before[j],
            c = ring[j - 1],
            d = ring[j];
          if (a && b && c && d) {
            triangle(triangles, a, b, c);
            triangle(triangles, b, d, c);
          }
        }
      previous.set(kind, ring);
    }
  }
  return { coverage, triangles: new Float32Array(triangles), centers };
}

export function calculateEclipsesForDay(day: number): EclipseProgressEvent[] {
  if (!validTime(day)) throw new Error('请选择 1700—2200 年内的有效日期。');
  const startOfDay = Math.floor(day / DAY_MS) * DAY_MS;
  const search = new Date(startOfDay - DAY_MS);
  const solar = SearchGlobalSolarEclipse(search),
    lunar = SearchLunarEclipse(search);
  const events: EclipseProgressEvent[] = [];
  const overlaps = (start: number, end: number) =>
    start < startOfDay + DAY_MS && end >= startOfDay;
  const peak = solar.peak.date.getTime();
  if (overlaps(peak - 6 * HOUR, peak + 6 * HOUR)) {
    const start = contact(peak, -1, false),
      end = contact(peak, 1, false);
    if (start !== undefined && end !== undefined && overlaps(start, end)) {
      const centralStart = contact(peak, -1, true),
        centralEnd = contact(peak, 1, true);
      const central =
        centralStart !== undefined && centralEnd !== undefined
          ? { start: centralStart, end: centralEnd }
          : undefined;
      const event: EclipseProgressEvent = {
        id: `solar-${peak}`,
        type: 'solar',
        kind: solar.kind,
        start,
        peak,
        end,
        central,
        phases: [
          { key: '全球偏食开始', time: start },
          ...(central ? [{ key: '中心线进入地球', time: central.start }] : []),
          { key: '食甚', time: peak },
          ...(central ? [{ key: '中心线离开地球', time: central.end }] : []),
          { key: '全球偏食结束', time: end },
        ],
      };
      event.path = calculateSolarPath(event);
      const types = new Set(event.path.centers.map((p) => p.kind));
      if (types.size > 1) event.kind = 'hybrid';
      events.push(event);
    }
  }
  const lunarPeak = lunar.peak.date.getTime();
  const start = lunarPeak - lunar.sd_penum * 60000,
    end = lunarPeak + lunar.sd_penum * 60000;
  if (overlaps(start, end)) {
    const phases = [{ key: '半影食始', time: start }];
    if (lunar.sd_partial)
      phases.push({ key: '初亏', time: lunarPeak - lunar.sd_partial * 60000 });
    if (lunar.sd_total)
      phases.push({ key: '食既', time: lunarPeak - lunar.sd_total * 60000 });
    phases.push({ key: '食甚', time: lunarPeak });
    if (lunar.sd_total)
      phases.push({ key: '生光', time: lunarPeak + lunar.sd_total * 60000 });
    if (lunar.sd_partial)
      phases.push({ key: '复圆', time: lunarPeak + lunar.sd_partial * 60000 });
    phases.push({ key: '半影食终', time: end });
    events.push({
      id: `lunar-${lunarPeak}`,
      type: 'lunar',
      kind: lunar.kind,
      start,
      peak: lunarPeak,
      end,
      phases,
    });
  }
  return events;
}

export function eventAtTime(events: EclipseProgressEvent[], time: number) {
  return (
    events.find((event) => time >= event.start && time <= event.end) ?? null
  );
}

export function eclipseProgress(event: EclipseProgressEvent, time: number) {
  const fraction = Math.max(
    0,
    Math.min(1, (time - event.start) / (event.end - event.start)),
  );
  const phase = event.phases.findLast((p) => p.time <= time) ?? event.phases[0];
  const next = event.phases.find((p) => p.time > time);
  let stage = '全球偏食阶段';
  if (event.type === 'solar') {
    if (
      event.central &&
      time >= event.central.start &&
      time <= event.central.end
    )
      stage = '中心食阶段';
  } else {
    const between = (a: string, b: string) => {
      const start = event.phases.find((p) => p.key === a)?.time;
      const end = event.phases.find((p) => p.key === b)?.time;
      return (
        start !== undefined && end !== undefined && time >= start && time <= end
      );
    };
    stage = between('食既', '生光')
      ? '全食阶段'
      : between('初亏', '复圆')
        ? '偏食阶段'
        : '半影阶段';
  }
  return { fraction, phase, next, stage };
}
