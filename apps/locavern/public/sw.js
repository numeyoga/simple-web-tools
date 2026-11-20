const CACHE_NAME = 'locavern-shell-v5';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './theme-init.js',
  './favicon.svg',
  './favicon.ico',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const urls = new Set(CORE_ASSETS);
      try {
        const manifestResp = await fetch('./precache-manifest.json');
        if (manifestResp.ok) {
          const builtAssets = await manifestResp.json();
          if (Array.isArray(builtAssets)) {
            for (const entry of builtAssets) {
              if (typeof entry === 'string') {
                urls.add(entry);
              }
            }
          }
        }
      } catch {
        // Precache manifest is optional in dev mode.
      }
      await cache.addAll([...urls]);
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  // The origin is shared by every app: only a page inside this worker's scope may trigger the update.
  const source = event.source;
  if (
    event.data &&
    event.data.type === 'SKIP_WAITING' &&
    event.origin === self.location.origin &&
    source &&
    typeof source.url === 'string' &&
    source.url.startsWith(self.registration.scope)
  ) {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Only this app's caches: the cache storage is shared by every app of the origin (decision 0005).
      const stale = keys.filter((k) => k.startsWith('locavern-') && k !== CACHE_NAME);
      await Promise.all(stale.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, {
        ignoreSearch: request.mode === 'navigate',
        ignoreVary: true,
      });
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === 'basic') {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        if (request.mode === 'navigate') {
          const fallback = (await cache.match('./index.html')) || (await cache.match('./'));
          if (fallback) return fallback;
        }
        return new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' });
      }
    })(),
  );
});
