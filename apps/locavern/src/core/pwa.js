// The pure rules of the offline shell: how its cache is named, which files it holds and which
// caches it may delete. No DOM, no Cache API: `src/sw/sw.js` applies them, `vite.config.js` uses
// them at build time. Every cache of the origin is shared by all the apps (decision 0005), so a
// name that does not start with the app's prefix is never touched.

/** Every cache of Locavern starts with this prefix. */
export const CACHE_PREFIX = 'locavern-';

/** Files of the build that never belong to the offline shell. */
const NEVER_PRECACHED = new Set(['sw.js', 'precache-manifest.json']);

/**
 * Font formats that no current browser asks for when a `woff2` is offered: the legacy fallbacks of
 * the stylesheet (`woff`, `ttf`) and Phosphor's SVG font (3 MB each). Leaving them out keeps the
 * shell at about 1.5 MB instead of 9 MB; online, they still load from the network if a very old
 * browser wants them.
 */
const LEGACY_FONT = /(\.(woff|ttf|eot)$)|(^assets\/Phosphor[^/]*\.svg$)/;

/**
 * Name of the shell cache of one build: `locavern-shell-<build id>`. A new build gets a new name,
 * so an update never mixes old and new files.
 * @param {string} buildId
 */
export function shellCacheName(buildId) {
  return `${CACHE_PREFIX}shell-${buildId}`;
}

/** @param {string} name */
export function isAppCache(name) {
  return name.startsWith(CACHE_PREFIX);
}

/**
 * The caches to delete when a build takes over: the app's own, except the current one. Other
 * apps' caches are not in the result, whatever they are named.
 * @param {readonly string[]} names every cache name of the origin
 * @param {string} current
 */
export function staleCaches(names, current) {
  return names.filter((name) => isAppCache(name) && name !== current);
}

/**
 * The URLs to precache, relative to the app (`./assets/index-1a2b.js`), from the files of the
 * build output (`assets/index-1a2b.js`). The worker and the manifest itself are left out, and so
 * are source maps and legacy fonts; `./` is added for the start URL. Sorted, without duplicates.
 * @param {readonly string[]} files paths relative to the output folder, `/` separated
 * @returns {string[]}
 */
export function precacheUrls(files) {
  const urls = new Set(['./']);
  for (const file of files) {
    const path = file.replace(/^\.?\//, '');
    if (!path || NEVER_PRECACHED.has(path) || path.endsWith('.map')) continue;
    if (LEGACY_FONT.test(path)) continue;
    urls.add(`./${path}`);
  }
  return [...urls].sort();
}

/**
 * Whether the worker answers a request itself: a same-origin GET. Anything else (another origin,
 * a POST) goes straight to the network, untouched.
 * @param {{ method: string, url: string }} request
 * @param {string} origin
 */
export function isHandledRequest(request, origin) {
  if (request.method !== 'GET') return false;
  try {
    return new URL(request.url).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Whether a message posted to the worker comes from a page of this app and asks for the one thing
 * it may ask: `SKIP_WAITING`. The origin is shared by every app (decision 0005), so a page of
 * another app could otherwise post to this worker; its url is outside this worker's scope.
 * @param {{ origin?: string, sourceUrl?: string, type?: unknown }} message `sourceUrl` is the url of the sending window client
 * @param {{ selfOrigin: string, scope: string }} worker
 */
export function isTrustedClientMessage({ origin, sourceUrl, type }, { selfOrigin, scope }) {
  return (
    type === 'SKIP_WAITING' &&
    origin === selfOrigin &&
    typeof sourceUrl === 'string' &&
    sourceUrl.startsWith(scope)
  );
}
