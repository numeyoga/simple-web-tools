// The browser side of the offline shell: registers the app's service worker and tells the app
// when an update is installed and waiting. Production builds only: in development there is no
// worker to register. Everything it touches (`navigator.serviceWorker`, `document`, reload) can
// be replaced by an argument, which is how the tests run it.

/**
 * Watch Service Worker lifecycle for updates that are installed and ready offline.
 * Never skips waiting automatically when an active Service Worker already controls the page.
 *
 * @param {{
 *   serviceWorker?: ServiceWorkerContainer;
 *   register?: () => Promise<ServiceWorkerRegistration>;
 *   onUpdateReady: (applyUpdate: () => void) => void;
 *   reload?: () => void;
 *   onVisible?: (handler: () => void) => () => void;
 * }} opts
 * @returns {Promise<() => void>}
 */
export async function setupServiceWorkerUpdates({
  serviceWorker = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  register,
  onUpdateReady,
  reload = () => window.location.reload(),
  onVisible,
}) {
  if (!serviceWorker || typeof register !== 'function') {
    return () => {};
  }

  let reloadRequested = false;
  let reloading = false;
  /** @type {ServiceWorker | null} */
  let lastNotifiedWorker = null;

  const handleControllerChange = () => {
    if (!reloadRequested || reloading) return;
    reloading = true;
    reload();
  };

  serviceWorker.addEventListener('controllerchange', handleControllerChange);

  /** @param {ServiceWorker | null} worker */
  const notifyIfWaiting = (worker) => {
    if (!worker || !serviceWorker.controller || worker === lastNotifiedWorker) return;
    lastNotifiedWorker = worker;
    onUpdateReady(() => {
      reloadRequested = true;
      if (worker.state === 'activated') {
        if (!reloading) {
          reloading = true;
          reload();
        }
        return;
      }
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  };

  /** @param {ServiceWorkerRegistration} registration */
  const watchInstalling = (registration) => {
    const worker = registration.installing;
    if (!worker) return;
    const onStateChange = () => {
      if (worker.state === 'installed' && serviceWorker.controller) {
        notifyIfWaiting(registration.waiting ?? worker);
      }
    };
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  };

  /** @type {ServiceWorkerRegistration | null} */
  let registration = null;
  try {
    registration = await register();
  } catch {
    serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    return () => {};
  }

  if (registration.waiting && serviceWorker.controller) {
    notifyIfWaiting(registration.waiting);
  }

  const handleUpdateFound = () => {
    if (registration) watchInstalling(registration);
  };
  registration.addEventListener('updatefound', handleUpdateFound);

  const triggerUpdateCheck = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    void registration?.update().catch(() => {});
  };

  /** @type {() => void} */
  let removeVisibleListener = () => {};
  if (typeof onVisible === 'function') {
    removeVisibleListener = onVisible(triggerUpdateCheck);
  } else if (typeof document !== 'undefined') {
    const onVisChange = () => {
      if (document.visibilityState === 'visible') triggerUpdateCheck();
    };
    document.addEventListener('visibilitychange', onVisChange);
    removeVisibleListener = () => document.removeEventListener('visibilitychange', onVisChange);
  }

  return () => {
    serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    registration?.removeEventListener('updatefound', handleUpdateFound);
    removeVisibleListener();
  };
}

/**
 * Registers `./sw.js` and reports updates, once the page has loaded. The worker lives at the root
 * of the app and its scope is the app's own path: `./` resolves against the page, so the same
 * build works under a sub-path on Pages and at `/` under `vite preview` (decision 0005).
 *
 * @param {{
 *   enabled: boolean;
 *   onUpdateReady: (applyUpdate: () => void) => void;
 *   scriptUrl?: string;
 *   scope?: string;
 * }} options
 *   `enabled` is `import.meta.env.PROD` in an app (the package does not read Vite's env).
 *   `onUpdateReady` runs when a new version is installed and waiting; calling `applyUpdate`
 *   activates it and reloads the page.
 * @returns {Promise<() => void>} resolves, once the page has loaded and the worker is registered,
 *   to a function that stops watching for updates (a no-op when nothing was registered)
 */
export function registerServiceWorker({
  enabled,
  onUpdateReady,
  scriptUrl = './sw.js',
  scope = './',
}) {
  if (!enabled || !('serviceWorker' in navigator)) return Promise.resolve(() => {});
  const start = () =>
    setupServiceWorkerUpdates({
      register: () => navigator.serviceWorker.register(scriptUrl, { scope }),
      onUpdateReady,
    });
  if (document.readyState === 'complete') return start();
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(start()), { once: true });
  });
}
