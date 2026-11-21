// The service worker: it holds the app shell so that Transient Notes starts offline. Built to `sw.js` at
// the root of the app (a classic script with no import left), registered with the scope of the
// app's own path only. `__BUILD_ID__` is replaced at build time by a hash of the build output:
// a new build changes this file, which is what makes the browser look for an update.
import {
  isHandledRequest,
  isTrustedClientMessage,
  precacheUrls,
  shellCacheName,
  staleCaches,
} from '../core/pwa.js';

/**
 * The part of the worker scope that this file uses (the `webworker` library is not loaded: the
 * project is typed against the DOM library).
 * @typedef {object} WorkerScope
 * @property {{ origin: string }} location
 * @property {{ claim: () => Promise<void> }} clients
 * @property {() => Promise<void>} skipWaiting
 * @property {{ active: unknown, scope: string }} registration
 * @property {(type: string, listener: (event: any) => void) => void} addEventListener
 */
const worker = /** @type {WorkerScope} */ (/** @type {unknown} */ (self));

const CACHE_NAME = shellCacheName('__BUILD_ID__');
const MANIFEST_URL = './precache-manifest.json';

worker.addEventListener('install', (/** @type {ExtendableEventLike} */ event) => {
  event.waitUntil(
    (async () => {
      // `reload` goes past the HTTP cache: the shell is made of this build's files only.
      const response = await fetch(MANIFEST_URL, { cache: 'reload' });
      if (!response.ok) throw new Error(`precache manifest: ${response.status}`);
      const urls = precacheUrls(await response.json());
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(urls.map((url) => new Request(url, { cache: 'reload' })));
      // The first worker takes over at once; an update waits until the person agrees to reload.
      if (!worker.registration.active) await worker.skipWaiting();
    })(),
  );
});

worker.addEventListener(
  'message',
  (/** @type {{ origin: string, data: any, source: { url?: string } | null }} */ event) => {
    // The origin is shared by every app: only a page inside this worker's scope may trigger the update.
    const trusted = isTrustedClientMessage(
      {
        origin: event.origin,
        sourceUrl: event.source?.url,
        type: event.data && event.data.type,
      },
      { selfOrigin: worker.location.origin, scope: worker.registration.scope },
    );
    if (trusted) void worker.skipWaiting();
  },
);

worker.addEventListener('activate', (/** @type {ExtendableEventLike} */ event) => {
  event.waitUntil(
    (async () => {
      // Only `transient-notes-` caches, never another app's: the cache storage is shared by the origin.
      const stale = staleCaches(await caches.keys(), CACHE_NAME);
      await Promise.all(stale.map((name) => caches.delete(name)));
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener('fetch', (/** @type {FetchEventLike} */ event) => {
  const { request } = event;
  if (!isHandledRequest(request, worker.location.origin)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, {
        ignoreSearch: request.mode === 'navigate',
        ignoreVary: true,
      });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        // Offline: a page load gets the shell; anything else is simply unavailable.
        if (request.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })(),
  );
});

/**
 * @typedef {object} ExtendableEventLike
 * @property {(promise: Promise<unknown>) => void} waitUntil
 */
/**
 * @typedef {object} FetchEventLike
 * @property {Request} request
 * @property {(response: Promise<Response>) => void} respondWith
 */
