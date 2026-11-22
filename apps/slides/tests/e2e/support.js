// Helpers shared by the journeys. Black box: everything goes through the UI. The suites run in
// French (see playwright.config.js), so the names of the controls are French.
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

/** The name of the main navigation, in the language of the interface. */
const NAV_NAME = /^(Navigation principale|Main navigation)$/;

/** The origin of the preview server: the only one the app may talk to. */
export const ORIGIN = 'http://127.0.0.1:4178';

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {import('@playwright/test').BrowserContext} BrowserContext */

/** The path of a fixture folder. @param {string} name */
export const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/**
 * Opens the app with the network blocked: any request that is not for the local preview server
 * is aborted, so nothing can leave the machine (and `blockedHosts` must stay empty).
 *
 * @param {Page} page
 * @param {string} [path] the address to open, `/` by default
 * @returns {Promise<{ errors: string[], blockedHosts: string[] }>} console errors and blocked URLs
 */
export async function openApp(page, path = '/') {
  const { errors, blockedHosts } = await watchNetwork(page);
  await page.goto(path);
  await waitForHome(page);
  return { errors, blockedHosts };
}

/**
 * Aborts every request that leaves the origin and records it, and records the errors of the page.
 * @param {Page} page
 * @returns {Promise<{ errors: string[], blockedHosts: string[] }>}
 */
export async function watchNetwork(page) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const blockedHosts = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const isExternal = /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1';
    if (!isExternal) return route.continue();
    blockedHosts.push(url.hostname);
    return route.abort();
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The failed load of a blocked external resource is expected, and is not an app error.
    const hostName = m.location().url ? new URL(m.location().url).hostname : '';
    if (hostName && hostName !== '127.0.0.1') return;
    errors.push(`console.error: ${m.text()}`);
  });
  return { errors, blockedHosts };
}

/**
 * Waits until the home screen is up: the page title is the h1. Below 1024 px the sidebar is a
 * closed drawer, so it is only expected to be visible from there.
 * @param {Page} page
 */
export async function waitForHome(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
    await expect(page.getByRole('navigation', { name: NAV_NAME })).toBeVisible();
  }
}

/**
 * Loads the bundled example from the home screen ("Charger l'exemple") and waits for the first
 * slide.
 * @param {Page} page
 */
export async function loadExample(page) {
  await page.getByRole('button', { name: 'Charger l’exemple' }).click();
  await expectSlide(page, 1);
}

/**
 * Chooses a fixture folder through the `<input webkitdirectory>` (the browser gives each file its
 * path in the folder, as for a person who picks a folder).
 * @param {Page} page
 * @param {string} name the folder under tests/fixtures
 */
export async function chooseFolder(page, name) {
  await page.getByTestId('folder-input').setInputFiles(fixture(name));
}

/**
 * Waits until the counter says it is on this slide (numbered from 1).
 * @param {Page} page
 * @param {number} number
 */
export async function expectSlide(page, number) {
  await expect(page.getByTestId('counter')).toHaveText(new RegExp(`^${number} / \\d+$`));
}

/**
 * The slide that is on screen.
 * @param {Page} page
 */
export const slide = (page) => page.getByTestId('slide');

/**
 * Opens a dialog's content scope by its name.
 * @param {Page} page
 * @param {string | RegExp} name
 */
export async function dialogNamed(page, name) {
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Watches the page for what a strict policy is for: Content Security Policy violations (the
 * directive and the blocked address), page errors, console errors, and requests that leave the
 * origin. Call it before `goto`.
 * @param {Page} page
 */
export async function watchPage(page) {
  /** @type {string[]} */
  const violations = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const external = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      // Read back through the exposed function below: it lives outside the page's own scripts.
      /** @type {any} */ (window).__reportCsp(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  await page.exposeFunction('__reportCsp', (/** @type {string} */ text) => violations.push(text));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  page.on('request', (request) => {
    const { protocol, origin } = new URL(request.url());
    if (/^https?:$/.test(protocol) && origin !== ORIGIN) external.push(origin);
  });
  return { violations, errors, external };
}

/**
 * Waits until the service worker has installed and controls the page, and returns the build's
 * manifest: the URLs it precaches and the ones it leaves on demand.
 * @param {Page} page
 * @returns {Promise<{ precache: string[], onDemand: string[] }>}
 */
export async function waitForShell(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(undefined), {
          once: true,
        }),
      );
    }
  });
  const manifest = JSON.parse(
    (await (await page.request.get('/precache-manifest.json')).body()).toString('utf8'),
  );
  // Two shapes, as `@simple-web-tools/pwa` writes them: Slides has files on demand.
  expect(Array.isArray(manifest.precache)).toBe(true);
  expect(Array.isArray(manifest.onDemand)).toBe(true);
  return manifest;
}

/**
 * The paths held by the app's shell cache (`/index.html`).
 * @param {Page} page
 * @returns {Promise<string[]>}
 */
export async function cachedPaths(page) {
  return page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('slides-shell-'));
    const cache = await caches.open(names[0] ?? '');
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
}
