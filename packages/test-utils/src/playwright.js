import { defineConfig, test } from '@playwright/test';

/**
 * @typedef {object} PlaywrightPresetOptions
 * @property {number} [port] port of the preview server (default 4173)
 * @property {string} [host] host of the preview server (default `127.0.0.1`, a secure context)
 * @property {string} [baseURL] overrides `http://<host>:<port>`
 * @property {string} [command] command that starts the server (default `npm run preview`)
 * @property {string} [testDir] default `tests/e2e`
 * @property {number} [serverTimeout] milliseconds to wait for the server (default 30000)
 */

/**
 * Playwright configuration shared by the apps: Chromium only, tests run against the built app
 * served by `vite preview`.
 * @param {PlaywrightPresetOptions} [options]
 * @returns {ReturnType<typeof defineConfig>}
 */
export function createPlaywrightConfig(options = {}) {
  const {
    port = 4173,
    host = '127.0.0.1',
    baseURL = `http://${host}:${port}`,
    command = 'npm run preview',
    testDir = 'tests/e2e',
    serverTimeout = 30_000,
  } = options;
  // No @types/node in this repository: read the environment through a minimal cast.
  const env = /** @type {{ process?: { env: Record<string, string | undefined> } }} */ (
    /** @type {unknown} */ (globalThis)
  ).process?.env;
  const ci = Boolean(env?.CI);
  // A remote browser (a shared `playwright run-server`): its loopback requests are tunnelled back
  // to this machine, so the app is still served from 127.0.0.1, a secure context.
  const wsEndpoint = env?.PLAYWRIGHT_WS_ENDPOINT;
  const connectOptions = wsEndpoint ? { wsEndpoint, exposeNetwork: '<loopback>' } : undefined;
  // The remote browser has its own time zone, while the tests build their dates in the local one
  // (`new Date(2026, 10, 18, 14, 5)`): give it this machine's zone.
  const timezoneId = wsEndpoint ? new Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  return defineConfig({
    testDir,
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 1 : 0,
    workers: ci ? 1 : undefined,
    reporter: 'list',
    use: {
      baseURL,
      trace: 'on-first-retry',
      connectOptions,
      timezoneId,
    },
    projects: [
      {
        name: 'chromium',
        use: { browserName: 'chromium' },
      },
    ],
    webServer: {
      command,
      url: baseURL,
      reuseExistingServer: !ci,
      timeout: serverTimeout,
    },
  });
}

let downloadCount = 0;

/**
 * Saves a download into the output folder of the running test and returns its local path.
 * `download.path()` is not available with a remote browser (`PLAYWRIGHT_WS_ENDPOINT`), while
 * `saveAs()` works both ways. Call it from inside a test.
 * @param {import('@playwright/test').Download} download
 * @returns {Promise<string>} absolute path of the saved file
 */
export async function saveDownload(download) {
  downloadCount += 1;
  const name = `download-${downloadCount}-${download.suggestedFilename()}`;
  const path = test.info().outputPath(name);
  await download.saveAs(path);
  return path;
}
