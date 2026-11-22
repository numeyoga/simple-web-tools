// Helpers shared by the journeys. Black box: everything goes through the UI. The suites run in
// French (see playwright.config.js), so the names of the controls are French.
import { expect } from '@playwright/test';

/** The name of the main navigation, in the language of the interface. */
const NAV_NAME = /^(Navigation principale|Main navigation)$/;

/** The origin of the preview server: the only one the app may talk to by default. */
export const ORIGIN = 'http://127.0.0.1:4177';

/** @typedef {import('@playwright/test').Page} Page */

/**
 * Opens the app with the network blocked: any request that is not for the local preview server
 * is aborted, so nothing can leave the machine (and `blockedHosts` must stay empty).
 *
 * @param {Page} page
 * @param {string} [path] the address to open, `/` by default
 * @returns {Promise<{ errors: string[], blockedHosts: string[] }>} console errors and blocked URLs
 */
export async function openApp(page, path = '/') {
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

  await page.goto(path);
  await waitForShell(page);
  return { errors, blockedHosts };
}

/**
 * Waits until the shell is up: the page title is the h1. Below 1024 px the sidebar is a closed
 * drawer, so it is only expected to be visible from there.
 * @param {Page} page
 */
export async function waitForShell(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
    await expect(page.getByRole('navigation', { name: NAV_NAME })).toBeVisible();
  }
}

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

/** Opens the navigation drawer below 1024 px (no-op above). @param {Page} page */
export async function openNav(page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) {
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
  }
}

/**
 * Loads the sample from the empty state ("Charger l'exemple"): twelve applications, four
 * templates, and the first application open on its last environment.
 * @param {Page} page
 */
export async function loadSample(page) {
  await page.getByRole('button', { name: 'Charger l’exemple' }).click();
  await expect(page.getByText('Exemple chargé')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
}

/**
 * Goes to an application by its name, in the sidebar.
 * @param {Page} page
 * @param {string} name
 */
export async function openAppNamed(page, name) {
  await openNav(page);
  await page
    .getByRole('navigation', { name: NAV_NAME })
    .getByRole('link', { name, exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

/**
 * Goes to an administration screen from the sidebar.
 * @param {Page} page
 * @param {string} name the name of the screen, in French
 */
export async function openAdmin(page, name) {
  await openNav(page);
  await page
    .getByRole('navigation', { name: NAV_NAME })
    .getByRole('link', { name, exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

/**
 * Turns the edit mode of the open application on or off.
 * @param {Page} page
 * @param {boolean} on
 */
export async function setEditMode(page, on) {
  const button = page.getByRole('button', { name: 'Éditer', exact: true });
  if ((await button.getAttribute('aria-pressed')) !== String(on)) await button.click();
  await expect(button).toHaveAttribute('aria-pressed', String(on));
}

/**
 * Creates an application with the dialog of the top bar.
 * @param {Page} page
 * @param {{ name: string, slug?: string, template?: string | RegExp, jira?: string }} app
 */
export async function createApp(page, { name, slug, template, jira }) {
  await page.getByRole('button', { name: 'Nouvelle application' }).first().click();
  const dialog = await dialogNamed(page, 'Nouvelle application');
  await dialog.getByRole('textbox', { name: 'Nom', exact: true }).fill(name);
  if (slug !== undefined) await dialog.getByLabel(/^Slug/).fill(slug);
  if (template !== undefined) {
    const option = dialog.getByLabel('Template').locator('option').filter({ hasText: template });
    await dialog.getByLabel('Template').selectOption({ label: await option.first().innerText() });
  }
  if (jira !== undefined) await dialog.getByLabel(/^Clé Jira/).fill(jira);
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/**
 * Every record of a store of a workspace database, read straight from IndexedDB.
 * @param {Page} page
 * @param {string} collection `templates`, `apps` or `settings`
 * @param {string} [workspaceId]
 * @returns {Promise<Record<string, any>[]>}
 */
export function readStore(page, collection, workspaceId = 'default') {
  return page.evaluate(
    ([w, c]) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(`dashboard__${w}`);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const all = db.transaction(String(c), 'readonly').objectStore(String(c)).getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result);
          };
        };
      }),
    [workspaceId, collection],
  );
}

/**
 * Waits until a store of a workspace holds a record with `field === value`, i.e. until the
 * write has reached the disk.
 * @param {Page} page
 * @param {string} collection
 * @param {string} field
 * @param {unknown} value
 * @param {string} [workspaceId]
 */
export async function waitForWrite(page, collection, field, value, workspaceId = 'default') {
  await expect
    .poll(async () =>
      (await readStore(page, collection, workspaceId)).some((r) => r[field] === value),
    )
    .toBe(true);
}

/**
 * Opens the workspaces dialog from the sidebar (below 1024 px the drawer opens first).
 * @param {Page} page
 */
export async function openWorkspaces(page) {
  await openNav(page);
  await page.getByRole('button', { name: /^(Espace de travail|Workspace)/ }).click();
  return dialogNamed(page, /^(Espaces de travail|Workspaces)$/);
}

/**
 * Collects what the browser reports about the page: CSP violations (the event of the document
 * and the console message), page errors and requests that leave the origin.
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

/** The local calendar date, `YYYY-MM-DD`, as a person reads it (never the UTC day). */
export function localDate() {
  const now = new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The rows of the links of the environment that is shown: the name, and the address as written.
 * @param {Page} page
 * @returns {Promise<{ name: string, url: string }[]>}
 */
export function shownLinks(page) {
  return page.locator('[role="tabpanel"]:not([hidden]) .dsh-link').evaluateAll((rows) =>
    rows.map((row) => ({
      name: row.querySelector('.dsh-link__name')?.textContent?.trim() ?? '',
      url: row.querySelector('.dsh-link__url')?.textContent?.trim() ?? '',
    })),
  );
}
