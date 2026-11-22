# @simple-web-tools/pwa

The offline shell of the apps: how its cache is named and what it holds, the service worker
that serves it, the registration and update flow in the page, and the Vite plugin that builds
it. Extracted from Chrono, Locavern and Transient Notes, which carried three copies of it.
Private workspace package: it is not published. No runtime dependency.

Every cache of the origin is shared by all the apps ([decision 0005](../../docs/decisions/0005-single-origin-hosting.md)),
so everything here is parameterised by the **app id** (the folder name under `apps/`): the
caches are named `<app id>-shell-<build id>`, and a worker only ever deletes the caches that
start with `<app id>-`. An app id must not start with another app's id followed by a dash.

## Entry points

| Import                         | Contents                                                                                                                                           | Runs in         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `@simple-web-tools/pwa`        | `cachePrefix`, `shellCacheName`, `isAppCache`, `staleCaches`, `precacheUrls`, `isHandledRequest`, `isTrustedClientMessage`, `BUILD_ID_PLACEHOLDER` | anywhere (pure) |
| `@simple-web-tools/pwa/worker` | `registerShellWorker`                                                                                                                              | service worker  |
| `@simple-web-tools/pwa/update` | `registerServiceWorker`, `setupServiceWorkerUpdates`                                                                                               | page            |
| `@simple-web-tools/pwa/vite`   | `pwaPlugin`, `listFiles`, `buildIdOf`                                                                                                              | Node (build)    |

The root entry has no DOM, no Cache API, no Node and no clock: it is safe in an app's
`src/core` ([decision 0004](../../docs/decisions/0004-reference-architecture.md)). `/vite` imports
`node:crypto` and `node:fs`: only `vite.config.js` may import it, never code that ships to the
browser.

## Using it in an app

Add `"@simple-web-tools/pwa": "*"` to the `devDependencies` of the app (everything it ships is
bundled into the app's own files), then three small pieces.

`vite.config.js`: the policy stays in the app, because it differs per app.

```js
import { pwaPlugin } from '@simple-web-tools/pwa/vite';

const PROD_CSP = ["default-src 'none'", "script-src 'self'" /* … */].join('; ');

export default defineConfig({
  base: './',
  plugins: [pwaPlugin({ appId: 'chrono', csp: PROD_CSP })],
  // …
  preview: { headers: { 'Content-Security-Policy': PROD_CSP /* … */ } },
});
```

`src/sw/sw.js`: the whole worker.

```js
import { registerShellWorker } from '@simple-web-tools/pwa/worker';

registerShellWorker({ appId: 'chrono' });
```

The page, once at start-up:

```js
import { registerServiceWorker } from '@simple-web-tools/pwa/update';

registerServiceWorker({
  enabled: import.meta.env.PROD,
  onUpdateReady(applyUpdate) {
    // show a toast or a banner; call applyUpdate() when the person agrees to reload
  },
});
```

## What the plugin does

`pwaPlugin({ appId, csp, worker })` applies to `vite build` only:

- adds the worker (`src/sw/sw.js`, or `worker`) as a second entry next to `index.html`, emitted
  as `sw.js` at the root of the output (not hashed, not in a folder: its URL fixes its scope).
  Nothing else imports its code, so the built file is a classic script with no `import` left;
- injects `csp` as a `<meta http-equiv="Content-Security-Policy">` right after the charset tag
  of `index.html`;
- once the whole output (public files included) is on disk, writes `precache-manifest.json`
  (`precacheUrls` of the output: every file except the worker, the manifest, source maps and
  legacy font formats) and replaces `__BUILD_ID__` in `sw.js` with a hash of those files. A new
  release therefore changes the worker file, which is what makes the browser look for an update,
  and gets a new cache name.

## What the worker does

`registerShellWorker({ appId })`:

- **install**: fetches `./precache-manifest.json` past the HTTP cache and caches every file it
  lists in `<app id>-shell-<build id>`. The first worker takes over at once (`skipWaiting`);
  an update waits.
- **message**: `{ type: 'SKIP_WAITING' }` activates the waiting worker, only when it comes from
  a page of the same origin inside the worker's scope (`isTrustedClientMessage`).
- **activate**: deletes the other `<app id>-` caches (`staleCaches`), then claims the clients.
- **fetch**: same-origin GET requests are served cache first; a navigation that fails offline
  gets `index.html`; anything else that fails offline is a `503 Offline` response.

## Update flow

`registerServiceWorker({ enabled, onUpdateReady, scriptUrl = './sw.js', scope = './' })`
registers the worker once the page has loaded (`./` resolves against the page, so the same build
works under a sub-path on Pages and at `/` under `vite preview`), and returns a promise of a
function that stops watching. `setupServiceWorkerUpdates` is the part that needs no registration
of its own: it calls `onUpdateReady(applyUpdate)` when a new worker is installed and waiting, never
skips waiting by itself when a worker already controls the page, reloads once the new worker has
taken over, and checks for an update when the tab becomes visible again.

## Tests

```bash
npm test -w @simple-web-tools/pwa
```

- `index.test.js`: the cache rules, once per app of the suite, and the precache list.
- `worker.test.js`: the worker against a fake scope, Cache Storage and network.
- `update.test.js`: registration and update detection against a fake service worker container.
- `vite.test.js`: the plugin's hooks against a temporary output folder.

The `offline-csp.spec.js` journey of each app covers the real browser: scope, cache name,
offline reload, update toast and cache cleanup.
