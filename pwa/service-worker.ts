/// <reference lib="webworker" />

import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  getCacheKeyForURL,
  matchPrecache,
  precache,
} from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import {
  isExplorerPath,
  isProfilePath,
  isPwaAssetPath,
  isPwaRequest,
  offlinePagePath,
} from '../lib/pwa';

declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE_MANIFEST__: Array<{
  url: string;
  revision: string | null;
}>;
declare const __PWA_VERSION__: string;

setCacheNameDetails({ prefix: 'orbit' });
precache(__PRECACHE_MANIFEST__);
cleanupOutdatedCaches();
clientsClaim();

// Keep the document paired with its build's chunks. A waiting worker activates
// only after all old clients close; never reload an active simulation to update.
registerRoute(
  ({ request, url }) =>
    isPwaRequest(request, url, self.location.origin) &&
    request.mode === 'navigate' &&
    isExplorerPath(url.pathname),
  createHandlerBoundToURL('/'),
);

// Do not let a precached HTML document answer a Vinext RSC request. Texture
// version query strings are already covered by build-generated content hashes.
registerRoute(
  ({ request, url }) =>
    isPwaRequest(request, url, self.location.origin) &&
    !isExplorerPath(url.pathname) &&
    !!getCacheKeyForURL(url.pathname),
  (options) => createHandlerBoundToURL(options.url.pathname)(options),
);

const pageCache = `orbit-pages-${__PWA_VERSION__}`;
const assetCache = `orbit-assets-${__PWA_VERSION__}`;

registerRoute(
  ({ request, url }) =>
    isPwaRequest(request, url, self.location.origin) &&
    request.mode === 'navigate' &&
    isProfilePath(url.pathname),
  new NetworkFirst({
    cacheName: pageCache,
    networkTimeoutSeconds: 3,
    plugins: [
      {
        fetchDidSucceed: async ({ response }) => {
          if (response.status >= 500) throw new Error('Page unavailable');
          return response;
        },
        cacheWillUpdate: async ({ response }) =>
          response.status === 200 &&
          response.headers.get('Content-Type')?.includes('text/html')
            ? response
            : null,
      },
      new ExpirationPlugin({ maxEntries: 48, purgeOnQuotaError: true }),
    ],
  }),
);

registerRoute(
  ({ request, url }) =>
    isPwaRequest(request, url, self.location.origin) &&
    isPwaAssetPath(url.pathname),
  new CacheFirst({
    cacheName: assetCache,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const fallback = await matchPrecache(
      offlinePagePath(new URL(request.url).pathname),
    );
    if (fallback) return fallback;
  }
  return Response.error();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith('orbit-pages-') ||
                  key.startsWith('orbit-assets-')) &&
                key !== pageCache &&
                key !== assetCache,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
