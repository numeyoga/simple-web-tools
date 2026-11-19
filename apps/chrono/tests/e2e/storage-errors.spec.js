// IndexedDB that cannot be used shows an error screen instead of the app, and writes nothing.
// A localStorage fallback of the former releases is imported once, and its key is kept.
import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

const FALLBACK_KEY = 'chrono-fallback-default-v2';
const LEGACY_FALLBACK_KEY = 'chrono.fallback.default.v1';

test('without IndexedDB an error screen replaces the app, and nothing is written', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('chrono-fallback-default-v2', '{"projects":[]}');
    indexedDB.open = () => {
      throw new DOMException('denied', 'SecurityError');
    };
  });

  await page.goto('/');

  const screen = page.getByTestId('storage-error');
  await expect(screen).toHaveAttribute('data-code', 'unavailable');
  await expect(screen.getByRole('heading')).toHaveText(
    'Chrono ne peut pas utiliser le stockage du navigateur',
  );
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toHaveCount(0);
  const stored = await page.evaluate(() => ({
    fallback: localStorage.getItem('chrono-fallback-default-v2'),
    keys: Object.keys(localStorage).filter((k) => k.includes('fallback')),
  }));
  expect(stored).toEqual({ fallback: '{"projects":[]}', keys: ['chrono-fallback-default-v2'] });
});

test('an IndexedDB open that fails with an error event ends on the error screen', async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      const request = /** @type {IDBOpenDBRequest} */ ({});
      setTimeout(() => /** @type {() => void} */ (request.onerror)?.(), 0);
      return request;
    };
  });

  await page.goto('/');

  await expect(page.getByTestId('storage-error')).toBeVisible();
});

test('a database held open by an old tab shows the "close the other tabs" message', async ({
  context,
}) => {
  // An older release keeps a connection to version 1 open and ignores `versionchange`.
  const old = await context.newPage();
  await old.goto('/assets/favicon.svg');
  await old.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('chrono__default', 1);
        request.onupgradeneeded = () => {
          for (const name of ['projets', 'todos', 'sessions', 'pointage']) {
            request.result.createObjectStore(name, { keyPath: 'id' });
          }
          request.result.createObjectStore('meta', { keyPath: 'key' });
        };
        request.onsuccess = () => {
          /** @type {{ oldConnection?: IDBDatabase }} */ (
            /** @type {unknown} */ (window)
          ).oldConnection = request.result;
          resolve(undefined);
        };
        request.onerror = () => reject(request.error);
      }),
  );

  const page = await context.newPage();
  await page.goto('/');

  const screen = page.getByTestId('storage-error');
  await expect(screen).toHaveAttribute('data-code', 'blocked');
  await expect(screen).toContainText('Ferme tous les autres onglets Chrono');
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toHaveCount(0);

  // Once the old tab lets go, a reload works.
  await old.evaluate(() =>
    /** @type {{ oldConnection: IDBDatabase }} */ (
      /** @type {unknown} */ (window)
    ).oldConnection.close(),
  );
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
});

test('the localStorage fallback of a former release is imported once, and its key is kept', async ({
  page,
}) => {
  await page.goto('/assets/favicon.svg');
  await page.evaluate(
    ([key]) =>
      localStorage.setItem(
        /** @type {string} */ (key),
        JSON.stringify({
          projects: [
            { id: 'p1', name: 'Archive locale', color: '#2563eb', client: '', archived: false },
          ],
          todos: [],
          sessions: [],
          attendance: [],
        }),
      ),
    [FALLBACK_KEY],
  );

  const { errors } = await openApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Archive locale')).toBeVisible();

  // It is recorded as imported, so that it never comes back, and the key is left in place.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const open = indexedDB.open('chrono__default');
            open.onsuccess = () => {
              const all = open.result
                .transaction('meta', 'readonly')
                .objectStore('meta')
                .getAllKeys();
              all.onsuccess = () => {
                open.result.close();
                resolve(all.result);
              };
            };
          }),
      ),
    )
    .toEqual(['fallbackImported']);
  expect(await page.evaluate((key) => localStorage.getItem(key) !== null, FALLBACK_KEY)).toBe(true);
  expect(errors).toEqual([]);
});

test('a version 1 fallback key is converted and imported, and kept as it is', async ({ page }) => {
  await page.goto('/assets/favicon.svg');
  const legacy = JSON.stringify({
    projets: [{ id: 'p1', nom: 'Ancien projet', couleur: '#2563eb', client: '', archive: false }],
    todos: [],
    sessions: [],
    pointage: [],
  });
  await page.evaluate(
    ([key, value]) =>
      localStorage.setItem(/** @type {string} */ (key), /** @type {string} */ (value)),
    [LEGACY_FALLBACK_KEY, legacy],
  );

  await openApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();

  await expect(page.getByRole('main').getByText('Ancien projet')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_FALLBACK_KEY)).toBe(legacy);
});
