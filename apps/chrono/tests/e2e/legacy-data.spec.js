// Data of the former release (schema version 1: French fields, `chrono.workspaces` keys) is
// still there after the update, and the export files of the former site still import.
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FROZEN_NOW, openApp, waitForWrite } from './support.js';

const LEGACY_EXPORT = fileURLToPath(
  new URL('../unit/fixtures/chrono-v1-export.json', import.meta.url),
);
const at = (/** @type {number} */ hours, minutes = 0) =>
  new Date(
    FROZEN_NOW.getFullYear(),
    FROZEN_NOW.getMonth(),
    FROZEN_NOW.getDate(),
    hours,
    minutes,
  ).getTime();

/**
 * Writes the storage of the former release with the raw APIs, on the origin of the app but
 * without loading it (a static asset is served by the same server): the database as its
 * `openDB()` created it (version 1) and the `chrono.workspaces` keys.
 * @param {import('@playwright/test').Page} page
 */
async function seedVersion1(page) {
  await page.goto('/assets/favicon.svg');
  await page.evaluate(
    async ({ projets, todos, sessions, pointage, workspaces }) => {
      localStorage.setItem('chrono.workspaces', JSON.stringify(workspaces));
      localStorage.setItem('chrono.workspace.active', 'default');
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('chrono__default', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const name of ['projets', 'todos', 'sessions', 'pointage']) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
          db.createObjectStore('meta', { keyPath: 'key' });
        };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const content = { projets, todos, sessions, pointage };
          const tx = db.transaction(Object.keys(content), 'readwrite');
          for (const [name, items] of Object.entries(content)) {
            for (const item of items) tx.objectStore(name).put(item);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(undefined);
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    {
      workspaces: [
        { id: 'default', label: 'Espace principal', creeLe: 1 },
        { id: 'perso', label: 'Perso', creeLe: 2, seedOnInit: false },
      ],
      projets: [
        {
          id: 'p1',
          nom: 'Chantier historique',
          couleur: '#2563eb',
          client: 'Acme',
          archive: false,
        },
        { id: 'p2', nom: 'Vieux dossier', couleur: '#9333ea', client: '', archive: true },
      ],
      todos: [
        {
          id: 't1',
          titre: 'Relancer le client',
          fait: false,
          projetId: 'p1',
          // A relative label, as the very first releases stored them.
          echeance: 'tomorrow',
          creeLe: at(9),
        },
      ],
      sessions: [
        {
          id: 's1',
          projetId: 'p1',
          description: 'Reprise des maquettes',
          debut: at(8),
          dernierDebut: null,
          fin: at(9, 30),
          duree: 90 * 60_000,
          statut: 'terminee',
        },
      ],
      pointage: [{ id: 'a1', type: 'arrivee', at: at(8) }],
    },
  );
}

test('a version 1 database and workspace list are migrated and their data shows up', async ({
  page,
}) => {
  await seedVersion1(page);
  const { errors } = await openApp(page, { clock: true });
  const main = page.getByRole('main');

  // Timeline: the session and the time worked.
  await expect(main.getByText('Reprise des maquettes').first()).toBeVisible();
  await expect(main.getByText('Temps travaillé').locator('..')).toContainText('01:30');

  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(main.getByText('Chantier historique')).toBeVisible();
  await expect(main.getByText('1 actifs · 1 archivés')).toBeVisible();

  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(main.getByText('Relancer le client')).toBeVisible();
  // The relative due date became a date, and was written back in the new layout.
  await waitForWrite(page, 'todos', 'dueDate', '2026-11-19');

  // The workspace list was imported, and the previous keys are left untouched.
  await page.getByRole('button', { name: /^Espace de sauvegarde Espace principal/ }).click();
  const management = page.getByRole('dialog', { name: 'Espaces de sauvegarde' });
  await expect(management.getByText('Perso', { exact: true })).toBeVisible();

  const storage = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('chrono__default');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const info = { version: db.version, stores: [...db.objectStoreNames].sort() };
          db.close();
          resolve({
            ...info,
            legacyList: localStorage.getItem('chrono.workspaces'),
            legacyActive: localStorage.getItem('chrono.workspace.active'),
            list: JSON.parse(localStorage.getItem('chrono-workspaces') ?? 'null'),
          });
        };
      }),
  );
  expect(storage).toMatchObject({
    version: 2,
    stores: ['attendance', 'meta', 'projects', 'sessions', 'todos'],
    legacyActive: 'default',
    list: [
      { id: 'default', label: 'Espace principal', createdAt: 1 },
      { id: 'perso', label: 'Perso', createdAt: 2 },
    ],
  });
  expect(JSON.parse(/** @type {{ legacyList: string }} */ (storage).legacyList)).toHaveLength(2);

  expect(errors).toEqual([]);
});

test('an export file of the former site (version 1) can be imported', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'chrono-default-2026-11-18.json',
    mimeType: 'application/json',
    buffer: await readFile(LEGACY_EXPORT),
  });
  await page
    .getByRole('dialog', { name: 'Remplacer les données ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();

  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Refonte site')).toBeVisible();
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByRole('main').getByText('Valider la palette')).toBeVisible();

  expect(errors).toEqual([]);
});

test('a file that is not a Chrono export is refused with a message', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'locavern',
        format: 'chrono-workspace',
        version: 2,
        exportedAt: '2026-11-18T10:00:00.000Z',
        data: {},
      }),
    ),
  });

  await expect(page.getByText('Import impossible')).toBeVisible();
  await expect(page.getByText('Ce fichier n’a pas été exporté par Chrono.')).toBeVisible();
  expect(errors).toEqual([]);
});
