// The service worker: it holds the app shell so that Chrono starts offline. Built to `sw.js` at
// the root of the app by `pwaPlugin` (a classic script with no import left), registered with the
// scope of the app's own path only. The rules and the handlers live in @simple-web-tools/pwa.
import { registerShellWorker } from '@simple-web-tools/pwa/worker';

registerShellWorker({ appId: 'chrono' });
