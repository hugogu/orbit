export const pwaThemeColor = '#080d16';

export const pwaManifest = {
  id: '/',
  name: 'ORBIT',
  short_name: 'ORBIT',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: pwaThemeColor,
  theme_color: pwaThemeColor,
  categories: ['education', 'science'],
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/icons/maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

type RequestInfo = Pick<Request, 'method' | 'mode' | 'headers'>;

export function isPwaRequest(request: RequestInfo, url: URL, origin: string) {
  return (
    request.method === 'GET' &&
    url.origin === origin &&
    !request.headers.has('RSC') &&
    !url.searchParams.has('_rsc')
  );
}

import { languages, type Locale } from './i18n';

export function isExplorerPath(pathname: string) {
  return pathname === '/' || pathname === '/index.html';
}

const profileRoutePattern = new RegExp(
  `^\\/(${Object.values(languages)
    .map((l) => l.route)
    .join('|')})\\/(bodies|events)(\\/[a-z0-9-]+)?\\/?$`,
);

/** A statically exported content page: a body profile, their index, or the sky-event guide. */
export function isProfilePath(pathname: string) {
  return profileRoutePattern.test(pathname);
}

export function isPwaAssetPath(pathname: string) {
  return (
    /^\/(assets|_next\/static)\/.+\.(js|css|woff2?)$/.test(pathname) ||
    /^\/(textures|media)\/.+\.(jpg|jpeg|png|webp)$/.test(pathname) ||
    /^\/events\/sky\/.+\.(webp|svg)$/.test(pathname) ||
    /^\/models\/.+\.bin$/.test(pathname)
  );
}

export function offlinePagePath(pathname: string) {
  const match = pathname.match(/^\/([a-z0-9-]+)\//i);
  const route = match?.[1]?.toLowerCase();
  const entry = (Object.entries(languages) as [Locale, (typeof languages)[Locale]][]).find(
    ([, lang]) => lang.route.toLowerCase() === route,
  );
  const locale = entry ? entry[0] : 'zh-CN';
  return `/offline/${locale}.html`;
}
