// Helpers shared by the journeys. Black box: everything goes through the UI.
import { expect } from '@playwright/test';

/** The name of the main navigation, in the language of the interface (the suites run in French). */
const NAV_NAME = /^(Navigation principale|Main navigation)$/;

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
 * Waits until the shell is up: the page title is the h1 of the current selection. Below 1024 px
 * the sidebar is a closed drawer, so it is only expected to be visible from there.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForShell(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
    await expect(page.getByRole('navigation', { name: NAV_NAME })).toBeVisible();
  }
}

/**
 * Opens a selection from the sidebar. Below 1024 px the sidebar is a drawer: the menu button
 * opens it first, and choosing a selection closes it again.
 * @param {import('@playwright/test').Page} page
 * @param {string} label `Toutes les notes`, `Projets`, `Domaines`, `Ressources` or `Archives`
 */
export async function goToSelection(page, label) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation', { name: NAV_NAME })
    .getByRole('button', { name: label })
    .click();
}

/**
 * Creates a note with the "New note" button of the top bar.
 * @param {import('@playwright/test').Page} page
 */
export async function createNote(page) {
  await page.getByRole('button', { name: /^(Nouvelle note|New note)$/ }).click();
}

/**
 * Opens the workspaces dialog from the sidebar (below 1024 px the drawer opens first).
 * @param {import('@playwright/test').Page} page
 */
export async function openWorkspaces(page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: /^(Espace de travail|Workspace)/ }).click();
  const dialog = page.getByRole('dialog', { name: /^(Espaces de travail|Workspaces)$/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Waits until a workspace's IndexedDB holds a record of `collection` with `field === value`,
 * i.e. until the write has reached the disk.
 * @param {import('@playwright/test').Page} page
 * @param {string} collection store name (`notes`, `folders`...)
 * @param {string} fieldName field to look for
 * @param {string | null} value expected value of the field
 * @param {string} [workspaceId]
 */
export async function waitForWrite(page, collection, fieldName, value, workspaceId = 'default') {
  await expect
    .poll(() =>
      page.evaluate(
        ([w, c, f, v]) =>
          new Promise((resolve) => {
            const req = indexedDB.open(`transient-notes__${w}`);
            req.onerror = () => resolve(false);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction(c, 'readonly');
              const all = tx.objectStore(c).getAll();
              all.onsuccess = () => {
                db.close();
                resolve(all.result.some((r) => r[f] === v));
              };
            };
          }),
        [workspaceId, collection, fieldName, value],
      ),
    )
    .toBe(true);
}
