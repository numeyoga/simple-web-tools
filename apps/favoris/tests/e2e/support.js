// Helpers shared by the journeys. Black box: everything goes through the UI. The suites run in
// French (see playwright.config.js), so the names of the controls are French.
import { expect } from '@playwright/test';

/** The name of the main navigation, in the language of the interface. */
const NAV_NAME = /^(Navigation principale|Main navigation)$/;

/** The origin of the preview server: the only one the app may talk to by default. */
export const ORIGIN = 'http://127.0.0.1:4176';

/**
 * Opens the app with the network blocked: any request that is not for the local preview server
 * is aborted, so nothing can leave the machine (and `blockedHosts` must stay empty).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ errors: string[], blockedHosts: string[] }>} console errors and blocked URLs
 */
export async function openApp(page) {
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

  await page.goto('/');
  await waitForShell(page);
  return { errors, blockedHosts };
}

/**
 * Waits until the shell is up: the page title is the h1. Below 1024 px the sidebar is a closed
 * drawer, so it is only expected to be visible from there.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForShell(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: /^(Rechercher dans les liens|Search the links)$/ }),
  ).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
    await expect(page.getByRole('navigation', { name: NAV_NAME })).toBeVisible();
  }
}

/**
 * Seeds `localStorage` with the keys of the previous version, before the app starts, and only
 * while this app has not imported them yet (the script runs again on every reload).
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string>} keys
 */
export async function seedLegacyStorage(page, keys) {
  await page.addInitScript((entries) => {
    if (localStorage.getItem('favoris-legacy-import') !== null) return;
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, keys);
}

/**
 * Opens a dialog's content scope by its name.
 * @param {import('@playwright/test').Page} page
 * @param {string | RegExp} name
 */
export async function dialogNamed(page, name) {
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Opens the navigation drawer below 1024 px (no-op above). @param {import('@playwright/test').Page} page */
export async function openNav(page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
}

/**
 * Adds a link with the dialog of the top bar.
 * @param {import('@playwright/test').Page} page
 * @param {{ name?: string, url: string, group?: string }} link `group` is the label of an existing
 *   group, or `null` for none; left out, the dialog's own choice is kept
 */
export async function addLink(page, { name, url, group }) {
  await page.getByRole('button', { name: 'Nouveau lien' }).first().click();
  const dialog = await dialogNamed(page, 'Nouveau lien');
  if (name !== undefined) await dialog.getByLabel('Nom', { exact: true }).fill(name);
  await dialog.getByLabel('Adresse').fill(url);
  if (group !== undefined)
    await dialog.getByLabel('Groupe', { exact: true }).selectOption({ label: group });
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/**
 * Creates a group with the "more actions" menu.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function addGroup(page, name) {
  await page.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('menuitem', { name: 'Nouveau groupe' }).click();
  const dialog = await dialogNamed(page, 'Nouveau groupe');
  await dialog.getByLabel('Nom du groupe').fill(name);
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/** @param {string} text */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The name of a group as the page announces it: its label, then "Mis en avant" for a featured one.
 * @param {string} label
 */
const groupName = (label) => new RegExp(`^${escapeRegExp(label)}( Mis en avant)?$`);

/** The card of a group, by its label. @param {import('@playwright/test').Page} page @param {string} label */
export function card(page, label) {
  return page.getByRole('region', { name: groupName(label) });
}

/** The button that folds a group (its title). @param {import('@playwright/test').Page} page @param {string} label */
export function foldButton(page, label) {
  return card(page, label).getByRole('button', { name: groupName(label) });
}

/** Turns the edit mode on or off. @param {import('@playwright/test').Page} page @param {boolean} on */
export async function setEditMode(page, on) {
  const button = page.getByRole('button', { name: 'Éditer', exact: true });
  if ((await button.getAttribute('aria-pressed')) !== String(on)) await button.click();
  await expect(button).toHaveAttribute('aria-pressed', String(on));
}

/**
 * Every record of a store of a workspace database, read straight from IndexedDB.
 * @param {import('@playwright/test').Page} page
 * @param {string} collection `groups` or `links`
 * @param {string} [workspaceId]
 * @returns {Promise<Record<string, any>[]>}
 */
export function readStore(page, collection, workspaceId = 'default') {
  return page.evaluate(
    ([w, c]) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(`favoris__${w}`);
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
 * @param {import('@playwright/test').Page} page
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
 * @param {import('@playwright/test').Page} page
 */
export async function openWorkspaces(page) {
  await openNav(page);
  await page.getByRole('button', { name: /^(Espace de travail|Workspace)/ }).click();
  return dialogNamed(page, /^(Espaces de travail|Workspaces)$/);
}

/**
 * Collects what the browser reports about the page: CSP violations (the event of the document
 * and the console message), page errors and requests that leave the origin.
 * @param {import('@playwright/test').Page} page
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
 * The names of the links of a card, in the order they are shown.
 * @param {import('@playwright/test').Page} page
 * @param {string} label the label of the group
 * @returns {Promise<string[]>}
 */
export function linkNames(page, label) {
  return card(page, label)
    .locator('.fv-link__name')
    .evaluateAll((nodes) => nodes.map((node) => node.firstChild?.textContent ?? ''));
}

/**
 * The labels of the cards, in the order they are shown.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export function cardLabels(page) {
  return page.locator('.fv-card').evaluateAll((nodes) =>
    nodes.map((node) => {
      const name = node.querySelector('.fv-card__title .cv-cat-name');
      return (name?.textContent ?? '').trim();
    }),
  );
}

/**
 * A board for the reorder tests: two groups, "Alpha" with three links and "Bravo" with one.
 * @param {import('@playwright/test').Page} page
 */
export async function seedBoard(page) {
  await addGroup(page, 'Alpha');
  await addGroup(page, 'Bravo');
  await addLink(page, { name: 'a1', url: 'a1.example', group: 'Alpha' });
  await addLink(page, { name: 'a2', url: 'a2.example', group: 'Alpha' });
  await addLink(page, { name: 'a3', url: 'a3.example', group: 'Alpha' });
  await addLink(page, { name: 'b1', url: 'b1.example', group: 'Bravo' });
}
