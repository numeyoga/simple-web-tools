// The service worker of an app: it holds the app shell so that the app starts offline. The app's
// own `src/sw/sw.js` is one call to `registerShellWorker`; the Vite plugin (`./vite`) builds it
// to `sw.js` at the root of the app, a classic script with no import left, and replaces the build
// id placeholder with a hash of the build output: a new build changes the file, which is what
// makes the browser look for an update.
import {
  BUILD_ID_PLACEHOLDER,
  carriedOverUrls,
  isHandledRequest,
  isOnDemandUrl,
  isTrustedClientMessage,
  onDemandHrefs,
  parseManifest,
  shellCacheName,
  staleCaches,
} from './index.js';

const MANIFEST_URL = './precache-manifest.json';

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

/**
 * @typedef {object} ExtendableEventLike
 * @property {(promise: Promise<unknown>) => void} waitUntil
 */

/**
 * @typedef {object} FetchEventLike
 * @property {Request} request
 * @property {(response: Promise<Response>) => void} respondWith
 */

/**
 * Wires the install, message, activate and fetch handlers of the offline shell.
 *
 * - install: fetches `precache-manifest.json` and caches every file it lists in
 *   `<app id>-shell-<build id>`. The first worker takes over at once; an update waits until the
 *   person agrees to reload. When the manifest lists on-demand files (the app's `onDemand`
 *   option in the Vite plugin), they are not fetched, but the manifest is kept in the cache so
 *   that the worker knows them again after it was stopped, offline.
 * - message: `SKIP_WAITING` from a page inside this worker's scope activates the waiting worker.
 * - activate: copies the on-demand entries of the previous builds that are still on demand into
 *   the new cache, then deletes the other caches that start with `<app id>-`, never another app's.
 * - fetch: same-origin GET requests are served cache first; an on-demand file that is not cached
 *   yet is fetched and stored in the current cache; a navigation that fails offline gets
 *   `index.html`.
 *
 * @param {{ appId: string, buildId?: string, scope?: WorkerScope }} options
 *   `buildId` defaults to the placeholder the build replaces. `scope` defaults to `self`; tests
 *   pass a fake one.
 */
export function registerShellWorker({
  appId,
  buildId = BUILD_ID_PLACEHOLDER,
  scope = /** @type {WorkerScope} */ (/** @type {unknown} */ (self)),
}) {
  const cacheName = shellCacheName(appId, buildId);
  /** @type {Promise<Set<string>> | undefined} */
  let onDemandList;

  /**
   * The on-demand files of this build, read once from the manifest kept in the cache. Empty for an
   * app that has none (its manifest is not kept).
   */
  function onDemandFiles() {
    onDemandList ??= (async () => {
      const cache = await caches.open(cacheName);
      const kept = await cache.match(MANIFEST_URL);
      if (!kept) return new Set();
      try {
        const { onDemand } = parseManifest(await kept.json());
        return onDemandHrefs(onDemand, scope.registration.scope);
      } catch {
        return new Set();
      }
    })();
    return onDemandList;
  }

  /** Stores a copy of a response, without failing the request when the storage refuses it. */
  async function remember(
    /** @type {Cache} */ cache,
    /** @type {Request} */ request,
    /** @type {Response} */ response,
  ) {
    try {
      await cache.put(request, response);
    } catch {
      // Quota or a closed cache: the response is still good for this page.
    }
  }

  scope.addEventListener('install', (/** @type {ExtendableEventLike} */ event) => {
    event.waitUntil(
      (async () => {
        // `reload` goes past the HTTP cache: the shell is made of this build's files only.
        const response = await fetch(MANIFEST_URL, { cache: 'reload' });
        if (!response.ok) throw new Error(`precache manifest: ${response.status}`);
        const kept = response.clone();
        const { precache, onDemand } = parseManifest(await response.json());
        const cache = await caches.open(cacheName);
        await cache.addAll(precache.map((url) => new Request(url, { cache: 'reload' })));
        if (onDemand.length > 0) await cache.put(MANIFEST_URL, kept);
        // The first worker takes over at once; an update waits until the person agrees to reload.
        if (!scope.registration.active) await scope.skipWaiting();
      })(),
    );
  });

  /**
   * Copies the on-demand entries of the caches about to be deleted into this build's cache, when
   * the same file is still on demand: the person who used a diagram does not download it again
   * after an update. A failure only costs that download.
   */
  async function carryOver(/** @type {string[]} */ stale) {
    const hrefs = await onDemandFiles();
    if (hrefs.size === 0) return;
    const cache = await caches.open(cacheName);
    for (const name of stale) {
      try {
        const old = await caches.open(name);
        const requests = await old.keys();
        const wanted = new Set(
          carriedOverUrls(
            requests.map((request) => request.url),
            hrefs,
          ),
        );
        for (const request of requests) {
          if (!wanted.has(request.url) || (await cache.match(request, { ignoreVary: true })))
            continue;
          const response = await old.match(request, { ignoreVary: true });
          if (response) await cache.put(request, response);
        }
      } catch {
        // Not copied: fetched again on next use.
      }
    }
  }

  scope.addEventListener(
    'message',
    (/** @type {{ origin: string, data: any, source: { url?: string } | null }} */ event) => {
      // The origin is shared by every app: only a page inside this worker's scope may trigger the update.
      const trusted = isTrustedClientMessage(
        {
          origin: event.origin,
          sourceUrl: event.source?.url,
          type: event.data && event.data.type,
        },
        { selfOrigin: scope.location.origin, scope: scope.registration.scope },
      );
      if (trusted) void scope.skipWaiting();
    },
  );

  scope.addEventListener('activate', (/** @type {ExtendableEventLike} */ event) => {
    event.waitUntil(
      (async () => {
        // Only this app's caches, never another app's: the cache storage is shared by the origin.
        const stale = staleCaches(appId, await caches.keys(), cacheName);
        await carryOver(stale);
        await Promise.all(stale.map((name) => caches.delete(name)));
        await scope.clients.claim();
      })(),
    );
  });

  scope.addEventListener('fetch', (/** @type {FetchEventLike} */ event) => {
    const { request } = event;
    if (!isHandledRequest(request, scope.location.origin)) return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request, {
          ignoreSearch: request.mode === 'navigate',
          ignoreVary: true,
        });
        if (cached) return cached;
        try {
          const response = await fetch(request);
          // An on-demand file is kept the first time it is used, so that it works offline next time.
          if (response.status === 200 && isOnDemandUrl(request.url, await onDemandFiles())) {
            await remember(cache, request, response.clone());
          }
          return response;
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
}
