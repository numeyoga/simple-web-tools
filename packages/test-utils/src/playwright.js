import { defineConfig } from '@playwright/test';

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
