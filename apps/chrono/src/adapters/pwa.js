// Registers the service worker (offline start of the app shell) and reports updates. The worker
// lives at the root of the app, and its scope is the app's own path: `./` resolves against the
// page, so the same build works at `/chrono/` on Pages and at `/` under `vite preview`
// (decision 0005). Production builds only: in development there is no worker to register.
import { setupServiceWorkerUpdates } from './sw-update.js';

/**
 * @param {{ onUpdateReady: (applyUpdate: () => void) => void }} options
 *   `onUpdateReady` runs when a new version is installed and waiting; calling `applyUpdate`
 *   activates it and reloads the page.
 */
export function registerServiceWorker({ onUpdateReady }) {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const start = () => {
    void setupServiceWorkerUpdates({
      register: () => navigator.serviceWorker.register('./sw.js', { scope: './' }),
      onUpdateReady,
    });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
