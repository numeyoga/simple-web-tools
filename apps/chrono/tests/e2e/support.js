// Helpers shared by the journeys. Black box: everything goes through the UI.
import { expect } from '@playwright/test';

/** Wednesday 2026-11-18, 10:00 (local time of the browser). */
export const FROZEN_NOW = new Date(2026, 10, 18, 10, 0, 0);

// Keys of the registry of workspaces, and of the list of the workspaces without demo data.
const WORKSPACES_KEY = 'chrono-workspaces';
const NO_DEMO_KEY = 'chrono-workspaces-no-demo';

/**
 * Opens the app with the network blocked: any request that is not for the local preview server
 * is aborted, so the Google Fonts stylesheet never leaves the machine.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {boolean} [options.demo] keep the demo data of a first start (default: empty workspace)
 * @param {boolean} [options.clock] freeze the browser clock at FROZEN_NOW; it then only moves
 *   with `page.clock` (default: real time)
 * @returns {Promise<{ errors: string[], blockedHosts: string[] }>} console errors and blocked URLs
 */
export async function openApp(page, { demo = false, clock = false } = {}) {
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

  if (!demo) {
    // First start of the default workspace without the demo data. Only when nothing is stored
    // yet, so that a reload keeps what the test did.
    await page.addInitScript(
      ([key, noDemoKey]) => {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(
            key,
            JSON.stringify([{ id: 'default', label: 'Espace principal', createdAt: 1 }]),
          );
          localStorage.setItem(noDemoKey, JSON.stringify(['default']));
        }
      },
      [WORKSPACES_KEY, NO_DEMO_KEY],
    );
  }
  if (clock) await page.clock.install({ time: FROZEN_NOW });

  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
  return { errors, blockedHosts };
}

/**
 * Creates a project from the Projets view (French UI), then comes back to the Timeline.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function createProject(page, name) {
  await page.getByRole('button', { name: 'Projets' }).click();
  await page.getByRole('button', { name: 'Nouveau projet' }).click();
  await page.getByRole('textbox', { name: 'Nom du projet' }).fill(name);
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Timeline' }).click();
}

/**
 * Adds a finished session by hand from the Timeline (08:00 to `end` today, project already created).
 * @param {import('@playwright/test').Page} page
 * @param {{ description: string, end: string }} session `end` as `HH:MM`
 */
export async function enterSession(page, { description, end }) {
  await page.getByRole('button', { name: 'Timeline' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Nouvelle' }).click();
  const addDialog = page.getByRole('dialog', { name: 'Ajouter un chrono' });
  await addDialog.getByRole('tab', { name: 'Saisir manuellement' }).click();
  await addDialog.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' }).fill(description);
  await addDialog.getByLabel('Début').fill('2026-11-18T08:00');
  await addDialog.getByLabel('Fin').fill(`2026-11-18T${end}`);
  await addDialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Waits until the active workspace's IndexedDB holds a record with `field === value`, i.e. until the
 * debounced write has reached the disk.
 * @param {import('@playwright/test').Page} page
 * @param {string} collection store name (`projects`, `todos`...)
 * @param {string} fieldName field to look for
 * @param {string} value expected value of the field
 */
export async function waitForWrite(page, collection, fieldName, value) {
  await expect
    .poll(() =>
      page.evaluate(
        ([c, f, v]) =>
          new Promise((resolve) => {
            const req = indexedDB.open('chrono__default');
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
        [collection, fieldName, value],
      ),
    )
    .toBe(true);
}
