import { comets, type Comet } from './comets';
import { languages, type Locale } from './i18n';
import { orbitingMoons, type OrbitingMoon } from './moon-orbits';
import { bodies, type Body } from './solar';

const fallbackSiteOrigin = 'https://orbit-henna-xi.vercel.app';

export function normalizeSiteOrigin(value: string) {
  const candidate = value.trim();
  if (!candidate) return;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    return url.origin;
  } catch {
    return;
  }
}

/**
 * Override this during a production build so canonical and sitemap URLs use
 * the permanent public hostname instead of the demo deployment. This helper
 * is also imported by the client entry, so it must not assume `process` exists.
 */
function resolveSiteOrigin() {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const configured = runtime.process?.env?.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    const normalized = normalizeSiteOrigin(configured);
    if (normalized) return normalized;
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return fallbackSiteOrigin;
}

export const siteOrigin = resolveSiteOrigin();

export const seoLocales = Object.keys(languages) as Locale[];

export type CatalogEntry =
  | { kind: 'body'; data: Body }
  | { kind: 'moon'; data: OrbitingMoon }
  | { kind: 'comet'; data: Comet };

export function catalogEntries(): CatalogEntry[] {
  return [
    ...bodies.map((data) => ({ kind: 'body' as const, data })),
    ...orbitingMoons.map((data) => ({ kind: 'moon' as const, data })),
    ...comets.map((data) => ({ kind: 'comet' as const, data })),
  ];
}

export function catalogEntry(id: string): CatalogEntry | undefined {
  return catalogEntries().find((entry) => entry.data.id === id);
}

export function bodyDetailsPath(locale: Locale, id: string) {
  return `/${locale}/bodies/${encodeURIComponent(id)}`;
}

export function explorerPath(locale: Locale, id?: string) {
  const hash = id ? `#${encodeURIComponent(id)}` : '';
  return `/?lang=${encodeURIComponent(locale)}${hash}`;
}

export function absoluteSiteUrl(path: string) {
  return new URL(path, `${siteOrigin}/`).toString();
}

export function serializeJsonLd(value: object) {
  const serialized = JSON.stringify(value);
  return serialized.replace(/[<>&]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
