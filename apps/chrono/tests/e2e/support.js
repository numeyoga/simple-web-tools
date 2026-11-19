// Helpers shared by the journeys. Black box: everything goes through the UI.
import { expect } from '@playwright/test';

/** Wednesday 2026-11-18, 10:00 (local time of the browser). */
export const MAINTENANT = new Date(2026, 10, 18, 10, 0, 0);

const CLE_ESPACES = 'chrono.workspaces';

/**
 * Opens the app with the network blocked: any request that is not for the local preview server
 * is aborted, so the Google Fonts stylesheet never leaves the machine.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {boolean} [options.demo] keep the demo data of a first start (default: empty workspace)
 * @param {boolean} [options.horloge] freeze the browser clock at MAINTENANT; it then only moves
 *   with `page.clock` (default: real time)
 * @returns {Promise<{ erreurs: string[], bloquees: string[] }>} console errors and blocked URLs
 */
export async function ouvrirApp(page, { demo = false, horloge = false } = {}) {
  /** @type {string[]} */
  const erreurs = [];
  /** @type {string[]} */
  const bloquees = [];

  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const externe = /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1';
    if (!externe) return route.continue();
    bloquees.push(url.hostname);
    return route.abort();
  });
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The failed load of a blocked external resource is expected, and is not an app error.
    const hote = m.location().url ? new URL(m.location().url).hostname : '';
    if (hote && hote !== '127.0.0.1') return;
    erreurs.push(`console.error: ${m.text()}`);
  });

  if (!demo) {
    // First start of the default workspace without the demo data. Only when nothing is stored
    // yet, so that a reload keeps what the test did.
    await page.addInitScript(
      ([cle]) => {
        if (!localStorage.getItem(cle)) {
          localStorage.setItem(
            cle,
            JSON.stringify([
              { id: 'default', label: 'Espace principal', creeLe: 1, seedOnInit: false },
            ]),
          );
        }
      },
      [CLE_ESPACES],
    );
  }
  if (horloge) await page.clock.install({ time: MAINTENANT });

  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
  return { erreurs, bloquees };
}

/**
 * Creates a project from the Projets view, then comes back to the Timeline.
 * @param {import('@playwright/test').Page} page
 * @param {string} nom
 */
export async function creerProjet(page, nom) {
  await page.getByRole('button', { name: 'Projets' }).click();
  await page.getByRole('button', { name: 'Nouveau projet' }).click();
  await page.getByRole('textbox', { name: 'Nom du projet' }).fill(nom);
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Timeline' }).click();
}

/**
 * Adds a finished session by hand from the Timeline (08:00 to `fin` today, project already created).
 * @param {import('@playwright/test').Page} page
 * @param {{ description: string, fin: string }} session `fin` as `HH:MM`
 */
export async function saisirSession(page, { description, fin }) {
  await page.getByRole('button', { name: 'Timeline' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Nouvelle' }).click();
  const ajout = page.getByRole('dialog', { name: 'Ajouter un chrono' });
  await ajout.getByRole('tab', { name: 'Saisir manuellement' }).click();
  await ajout.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' }).fill(description);
  await ajout.getByLabel('Début').fill('2026-11-18T08:00');
  await ajout.getByLabel('Fin').fill(`2026-11-18T${fin}`);
  await ajout.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Waits until the active workspace's IndexedDB holds a record matching `predicat`, i.e. until the
 * debounced write has reached the disk.
 * @param {import('@playwright/test').Page} page
 * @param {string} collection store name (`projets`, `todos`...)
 * @param {string} champ field to look for
 * @param {string} valeur expected value of the field
 */
export async function attendreEcriture(page, collection, champ, valeur) {
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
        [collection, champ, valeur],
      ),
    )
    .toBe(true);
}
