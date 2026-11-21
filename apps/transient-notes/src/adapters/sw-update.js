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
