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

export function isExplorerPath(pathname: string) {
  return pathname === '/' || pathname === '/index.html';
}

export function isProfilePath(pathname: string) {
  return /^\/(zh-CN|en-US|ja-JP)\/bodies\/[a-z0-9-]+\/?$/.test(pathname);
}

export function isPwaAssetPath(pathname: string) {
  return (
    /^\/(assets|_next\/static)\/.+\.(js|css|woff2?)$/.test(pathname) ||
    /^\/(textures|media)\/.+\.(jpg|jpeg|png|webp)$/.test(pathname) ||
    /^\/models\/.+\.bin$/.test(pathname)
  );
}

export function offlinePagePath(pathname: string) {
  const locale = pathname.startsWith('/en-US/')
    ? 'en'
    : pathname.startsWith('/ja-JP/')
      ? 'ja'
      : 'zh-CN';
  return `/offline/${locale}.html`;
}
