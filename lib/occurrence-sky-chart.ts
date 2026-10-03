import {
  AstroTime,
  Body,
  Equator,
  Horizon,
  Observer,
  Refraction,
  RotateVector,
  Rotation_EQJ_HOR,
  Vector,
} from 'astronomy-engine';
import { constellationNames } from './constellations';
import {
  occurrenceImageSize,
  occurrenceReferenceLocation,
  type EventOccurrence,
} from './event-occurrences';
import { translator, type Locale } from './i18n';
import { occurrenceName, occurrenceSkyCaption } from './seo';
import {
  starBrightness,
  starColor,
  starPointSize,
  type ConstellationFigures,
  type StarCatalog,
} from './star-catalog';

const bounds = {
  azimuthMin: 60,
  azimuthMax: 225,
  altitudeMin: 0,
  altitudeMax: 75,
};
const plot = { left: 84, right: 1350, top: 155, bottom: 675 };
export type ChartPosition = {
  azimuth: number;
  altitude: number;
  x: number;
  y: number;
};

/** An azimuth/altitude grid: north-to-east is clockwise, and altitude grows upward. */
export function projectSkyPosition(
  azimuth: number,
  altitude: number,
): ChartPosition | null {
  if (
    !Number.isFinite(azimuth) ||
    !Number.isFinite(altitude) ||
    azimuth < bounds.azimuthMin ||
    azimuth > bounds.azimuthMax ||
    altitude < bounds.altitudeMin ||
    altitude > bounds.altitudeMax
  )
    return null;
  return {
    azimuth,
    altitude,
    x:
      plot.left +
      ((azimuth - bounds.azimuthMin) /
        (bounds.azimuthMax - bounds.azimuthMin)) *
        (plot.right - plot.left),
    y:
      plot.bottom -
      ((altitude - bounds.altitudeMin) /
        (bounds.altitudeMax - bounds.altitudeMin)) *
        (plot.bottom - plot.top),
  };
}

export function chartBodyPosition(body: Body, event: EventOccurrence) {
  const observer = new Observer(
    occurrenceReferenceLocation.latitude,
    occurrenceReferenceLocation.longitude,
    occurrenceReferenceLocation.height,
  );
  const eq = Equator(body, new Date(event.chartTime), observer, true, true);
  const sky = Horizon(
    new Date(event.chartTime),
    observer,
    eq.ra,
    eq.dec,
    'normal',
  );
  return projectSkyPosition(sky.azimuth, sky.altitude);
}

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
}
const n = (value: number) => value.toFixed(2);

/** Same catalogue, proper motion and topocentric ephemeris as the observatory. */
export function renderOccurrenceSkyChart(
  event: EventOccurrence,
  locale: Locale,
  stars: StarCatalog,
  figures: ConstellationFigures,
) {
  const t = translator(locale);
  const time = new AstroTime(new Date(event.chartTime));
  const observer = new Observer(
    occurrenceReferenceLocation.latitude,
    occurrenceReferenceLocation.longitude,
    occurrenceReferenceLocation.height,
  );
  const rotation = Rotation_EQJ_HOR(time, observer);
  const years = time.tt / 365.25;
  const positions = Array.from(stars.magnitudes, (_, index) => {
    const at = index * 3;
    const vec = RotateVector(
      rotation,
      new Vector(
        stars.positions[at] + years * stars.motions[at],
        stars.positions[at + 1] + years * stars.motions[at + 1],
        stars.positions[at + 2] + years * stars.motions[at + 2],
        time,
      ),
    );
    const azimuth = ((Math.atan2(-vec.y, vec.x) * 180) / Math.PI + 360) % 360;
    const geometric =
      (Math.atan2(vec.z, Math.hypot(vec.x, vec.y)) * 180) / Math.PI;
    return projectSkyPosition(
      azimuth,
      geometric + Refraction('normal', geometric),
    );
  });
  const text = (
    x: number,
    y: number,
    value: string,
    size = 18,
    color = '#94a4b8',
    extra = '',
  ) =>
    `<text x="${n(x)}" y="${n(y)}" fill="${color}" font-size="${size}" ${extra}>${escapeXml(value)}</text>`;
  const lines: string[] = [];
  const labels: string[] = [];
  const bodyLabels: { x: number; y: number; width: number; height: number }[] =
    [];
  const bodies: [Body, string][] = [
    [Body.Saturn, '土星'],
    [Body.Neptune, '海王星'],
    [Body.Uranus, '天王星'],
    [Body.Jupiter, '木星'],
    [Body.Mars, '火星'],
    [Body.Venus, '金星'],
    [Body.Mercury, '水星'],
    [Body.Moon, '月球'],
  ];
  for (const [body, name] of bodies) {
    const pos = chartBodyPosition(body, event);
    if (!pos) continue;
    const prominent = body === Body.Saturn;
    const label = t(name);
    const width = Math.max(80, label.length * 15);
    const x = Math.min(pos.x + 18, plot.right - width);
    let y = Math.max(
      plot.top + 25,
      Math.min(plot.bottom - 8, pos.y + (prominent ? -20 : 30)),
    );
    while (
      bodyLabels.some(
        (box) =>
          x < box.x + box.width &&
          x + width > box.x &&
          y - 24 < box.y + box.height &&
          y > box.y,
      )
    )
      y -= 32;
    bodyLabels.push({ x, y: y - 24, width, height: 28 });
    lines.push(
      `<circle data-body="${body}" data-azimuth="${pos.azimuth}" data-altitude="${pos.altitude}" cx="${n(pos.x)}" cy="${n(pos.y)}" r="${prominent ? 9 : 5}" fill="${prominent ? '#efc980' : '#9ec3de'}"/>`,
    );
    if (prominent)
      lines.push(
        `<circle cx="${n(pos.x)}" cy="${n(pos.y)}" r="19" fill="none" stroke="#efc980" stroke-opacity=".55" stroke-width="1.5"/>`,
      );
    labels.push(
      `<line x1="${n(pos.x + 8)}" y1="${n(pos.y)}" x2="${n(x - 3)}" y2="${n(y - 8)}" stroke="${prominent ? '#efc980' : '#9ec3de'}" stroke-opacity=".5"/>` +
        text(
          x,
          y,
          label,
          23,
          prominent ? '#efc980' : '#bfd2e2',
          'font-weight="600"',
        ),
    );
  }
  const constellationLines: string[] = [],
    constellationLabels: string[] = [];
  for (const figure of figures.constellations) {
    const indices = [...new Set(figure.lines)];
    const visible = indices.flatMap((index) =>
      positions[index] ? [positions[index]!] : [],
    );
    for (let index = 0; index < figure.lines.length; index += 2) {
      const a = positions[figure.lines[index]],
        b = positions[figure.lines[index + 1]];
      if (a && b)
        constellationLines.push(
          `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}"/>`,
        );
    }
    if (visible.length < 3 || visible.length < indices.length * 0.45) continue;
    const xs = visible.map((pos) => pos.x),
      ys = visible.map((pos) => pos.y);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    const y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.45;
    if (y > plot.bottom - 40) continue;
    if (
      bodyLabels.some(
        (box) =>
          x > box.x - 80 &&
          x < box.x + box.width + 80 &&
          y > box.y - 20 &&
          y < box.y + box.height + 20,
      )
    )
      continue;
    constellationLabels.push(
      text(
        x,
        y,
        t(constellationNames[figure.id]),
        18,
        '#778ca5',
        'text-anchor="middle"',
      ),
    );
  }
  const points = positions.flatMap((pos, index) => {
    if (!pos || stars.magnitudes[index] > 6.5) return [];
    const rgb = starColor(stars.colorIndices[index]).map((value) =>
      Math.round(value * 255),
    );
    return [
      `<circle cx="${n(pos.x)}" cy="${n(pos.y)}" r="${n(starPointSize(stars.magnitudes[index]) / 2)}" fill="rgb(${rgb.join(',')})" opacity="${n(starBrightness(stars.magnitudes[index]))}"/>`,
    ];
  });
  const grid: string[] = [];
  for (const altitude of [0, 15, 30, 45, 60, 75]) {
    const pos = projectSkyPosition(bounds.azimuthMin, altitude)!;
    grid.push(
      `<line x1="${plot.left}" y1="${n(pos.y)}" x2="${plot.right}" y2="${n(pos.y)}" stroke="${altitude ? '#24364b' : '#69aea6'}" stroke-width="${altitude ? 1 : 2}"/>`,
      text(
        plot.left - 18,
        pos.y + 6,
        `${altitude}°`,
        17,
        '#91a4b7',
        'text-anchor="end"',
      ),
    );
  }
  for (const azimuth of [60, 90, 120, 150, 180, 210]) {
    const pos = projectSkyPosition(azimuth, 0)!;
    grid.push(
      `<line x1="${n(pos.x)}" y1="${plot.top}" x2="${n(pos.x)}" y2="${plot.bottom}" stroke="#24364b"/>`,
      text(
        pos.x,
        plot.bottom + 29,
        `${azimuth}°`,
        17,
        '#91a4b7',
        'text-anchor="middle"',
      ),
    );
  }
  for (const [azimuth, name] of [
    [90, '东'],
    [135, '东南'],
    [180, '南'],
    [225, '西南'],
  ] as const) {
    const pos = projectSkyPosition(azimuth, 0)!;
    grid.push(
      text(
        pos.x,
        plot.bottom + 59,
        t(name),
        19,
        '#adc0bd',
        `text-anchor="${azimuth === 225 ? 'end' : 'middle'}"`,
      ),
    );
  }
  grid.push(
    text(
      plot.right - 12,
      plot.bottom - 12,
      t('地平线'),
      17,
      '#8fc9be',
      'text-anchor="end"',
    ),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${occurrenceImageSize.width}" height="${occurrenceImageSize.height}" viewBox="0 0 ${occurrenceImageSize.width} ${occurrenceImageSize.height}" role="img" aria-labelledby="sky-title sky-desc">
<title id="sky-title">${escapeXml(occurrenceName(event, locale))}</title><desc id="sky-desc">${escapeXml(occurrenceSkyCaption(event, locale))}</desc>
<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#080f1c"/><stop offset="1" stop-color="#102332"/></linearGradient><clipPath id="plot"><rect x="${plot.left}" y="${plot.top}" width="${plot.right - plot.left}" height="${plot.bottom - plot.top}"/></clipPath></defs>
<rect width="100%" height="100%" fill="#080f1c"/><g font-family="Inter, PingFang SC, Hiragino Sans, sans-serif">
${text(48, 52, occurrenceName(event, locale), 32, '#e7d6ac', 'font-weight="600"')}${text(48, 89, occurrenceSkyCaption(event, locale), 18)}
${text(plot.left, 134, t('高度'), 16)}${text(plot.right, 134, t('天体标记已放大'), 16, '#899db0', 'text-anchor="end"')}
<rect x="${plot.left}" y="${plot.top}" width="${plot.right - plot.left}" height="${plot.bottom - plot.top}" fill="url(#sky)"/>
${grid.join('')}<g clip-path="url(#plot)"><g stroke="#657f9c" stroke-opacity=".4" stroke-width="1.2">${constellationLines.join('')}</g>${points.join('')}${constellationLabels.join('')}${lines.join('')}${labels.join('')}</g>
${text(plot.left, 790, t('方位角（从正北顺时针计）'), 17)}${text(plot.right, 790, `${t('星表与历表预测')} · Astronomy Engine / Bright Star Catalogue`, 16, '#6f8499', 'text-anchor="end"')}
</g></svg>`;
}
