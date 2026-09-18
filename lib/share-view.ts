import { comets } from './comets';
import { languages, localePath, type Locale, type Translate } from './i18n';
import { MAX_TIME, MIN_TIME, utcLabel } from './simulation-time';
import { catalogEntries } from './seo';
import { regions, speeds } from './solar';

/** Where the camera actually sits around the followed body. */
export type CameraPose = {
  /** Horizontal angle, in radians. */
  azimuth: number;
  /** Angle away from north, in radians. */
  polar: number;
  /**
   * Distance as a multiple of the framing distance the scene picks for that
   * body. A ratio rather than scene units, so the recipient sees the same
   * apparent size under their own size and distance settings.
   */
  zoom: number;
};

/**
 * The observation the share link reproduces: the moment, the subject and the
 * framing around it. Visual options and the observer's own coordinates stay out
 * of the link so a shared view never overwrites private preferences.
 */
export type ShareView = {
  time: number;
  paused: boolean;
  speedIndex: number;
  /** Catalog id of the followed body, comet, moon or asteroid. */
  selected: string | null;
  /** Overview camera distance, used only while no body is followed. */
  view: number;
  top: boolean;
  /** Comets are framed either close up or against their whole orbit. */
  cometClose: boolean;
  /** Set only for the structure tour, which has no followed body. */
  region: string | null;
  /** Absent when the scene could not be read, which falls back to auto framing. */
  camera: CameraPose | null;
};

export const defaultShareView: ShareView = {
  time: MIN_TIME,
  paused: false,
  speedIndex: 0,
  selected: null,
  view: 205,
  top: false,
  cometClose: false,
  region: null,
  camera: null,
};

/** Overview distances stay inside the range the structure tour and reset use. */
const minView = 1;
const maxView = 2000;
/** A pose further outside this than any control allows is treated as corrupt. */
const minZoom = 0.02;
const maxZoom = 500;

/** Four decimals hold the pose to well under a tenth of a degree. */
function compact(value: number) {
  return String(Number(value.toFixed(4)));
}

function readCamera(value: string | null): CameraPose | null {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part)))
    return null;
  const [azimuth, polar, zoom] = parts;
  if (Math.abs(azimuth) > Math.PI * 2) return null;
  if (polar < 0 || polar > Math.PI) return null;
  if (zoom < minZoom || zoom > maxZoom) return null;
  return { azimuth, polar, zoom };
}

const shareKeys = ['t', 'p', 's', 'v', 'top', 'cc', 'r', 'c'] as const;

let cachedIds: Set<string> | undefined;
function catalogIds() {
  cachedIds ??= new Set(catalogEntries().map((entry) => entry.data.id));
  return cachedIds;
}

export function isShareableBody(id: unknown): id is string {
  return typeof id === 'string' && catalogIds().has(id);
}

function isShareableRegion(id: unknown): id is string {
  return typeof id === 'string' && regions.some((region) => region.id === id);
}

function readBoolean(value: string | null) {
  return value === '1';
}

/** Serialize a view, omitting everything that already matches the default. */
export function encodeShareView(view: ShareView) {
  const params = new URLSearchParams();
  params.set('t', new Date(view.time).toISOString());
  if (view.paused) params.set('p', '1');
  if (view.speedIndex !== defaultShareView.speedIndex)
    params.set('s', String(view.speedIndex));
  if (view.top) params.set('top', '1');
  if (view.camera)
    params.set(
      'c',
      [view.camera.azimuth, view.camera.polar, view.camera.zoom]
        .map(compact)
        .join(','),
    );
  if (view.selected) {
    if (comets.some((comet) => comet.id === view.selected))
      params.set('cc', view.cometClose ? '1' : '0');
  } else {
    if (view.region) params.set('r', view.region);
    if (view.view !== defaultShareView.view)
      params.set('v', String(Math.round(view.view)));
  }
  return params;
}

/**
 * Read a share link back into a view. Every field is validated, so a hand-edited
 * or truncated link degrades to the defaults instead of breaking the scene.
 */
export function decodeShareView(
  params: URLSearchParams,
  selected: string | null = null,
): ShareView {
  const time = Date.parse(params.get('t') ?? '');
  const speedIndex = Number(params.get('s'));
  const view = Number(params.get('v'));
  const region = params.get('r');
  const cometClose = params.get('cc');
  const body = isShareableBody(selected) ? selected : null;
  return {
    time:
      Number.isFinite(time) && time >= MIN_TIME && time <= MAX_TIME
        ? time
        : defaultShareView.time,
    paused: readBoolean(params.get('p')),
    speedIndex:
      Number.isInteger(speedIndex) &&
      speedIndex >= 0 &&
      speedIndex < speeds.length
        ? speedIndex
        : defaultShareView.speedIndex,
    selected: body,
    view:
      Number.isFinite(view) && view >= minView && view <= maxView
        ? view
        : defaultShareView.view,
    top: readBoolean(params.get('top')),
    camera: readCamera(params.get('c')),
    cometClose:
      cometClose === null ? defaultShareView.cometClose : cometClose === '1',
    region: !body && isShareableRegion(region) ? region : null,
  };
}

/** Whether a link carried any observation state at all. */
export function hasShareView(params: URLSearchParams) {
  return shareKeys.some((key) => params.has(key));
}

/**
 * Drop a consumed observation from a URL. The explorer keeps a share link
 * intact so it can be reloaded or passed on, but once the visitor follows a
 * different body the link no longer describes what is on screen.
 */
export function withoutShareView(search: string) {
  const params = new URLSearchParams(search);
  for (const key of shareKeys) params.delete(key);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Crawlable landing page whose social card matches the followed body. */
export function sharePath(locale: Locale, selected: string | null) {
  const base = `/${localePath(locale)}/share`;
  return isShareableBody(selected)
    ? `${base}/${encodeURIComponent(selected)}`
    : base;
}

/** The explorer URL a share landing page forwards to, rebuilt from sanitized state. */
export function explorerHref(
  locale: Locale,
  selected: string | null,
  search: string,
) {
  const view = decodeShareView(new URLSearchParams(search), selected);
  const params = encodeShareView(view);
  params.set('lang', locale);
  const hash = view.selected ? `#${encodeURIComponent(view.selected)}` : '';
  return `/?${params.toString()}${hash}`;
}

/** Calendar day of the observation, in UTC, for short social titles. */
export function shareDateLabel(time: number, locale: Locale) {
  return new Intl.DateTimeFormat(languages[locale].intl, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(time));
}

/** What the shared frame is pointed at: a catalog body, a structure layer, or the whole system. */
export function shareSubjectName(view: ShareView, t: Translate) {
  if (view.selected) {
    const entry = catalogEntries().find(
      (item) => item.data.id === view.selected,
    );
    if (entry) return t(entry.data.name);
  }
  const region = regions.find((item) => item.id === view.region);
  return region ? t(region.name) : t('太阳系');
}

/** Language-neutral stamp burned into the shared screenshot. */
export function shareMomentLabel(time: number) {
  return `${utcLabel(time).slice(0, 16)} UTC`;
}
