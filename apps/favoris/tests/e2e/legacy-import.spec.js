// The first start after the previous version of Favoris, which was served from the same origin:
// its `localStorage` is seeded before the app starts, as it was left, and the app imports it.
// The old keys are never touched, and the import runs once.
import { expect, test } from '@playwright/test';
import { multiSpaceStorage, singleKeyStorage } from '../unit/support/legacy-fixtures.js';
import {
  addLink,
  card,
  dialogNamed,
  foldButton,
  linkNames,
  openApp,
  openWorkspaces,
  seedLegacyStorage,
  waitForWrite,
} from './support.js';

/** The keys of the previous version, as they are in the page's `localStorage`. @param {import('@playwright/test').Page} page */
const oldKeys = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith('favoris.'))
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );

/** @param {Record<string, string>} keys */
const sorted = (keys) =>
  Object.fromEntries(Object.entries(keys).sort(([a], [b]) => a.localeCompare(b)));

test.describe('a browser with several spaces', () => {
  test.beforeEach(async ({ page }) => {
    await seedLegacyStorage(page, multiSpaceStorage());
  });

  test('one workspace per space, the open one first, its groups and links in place', async ({
    page,
  }) => {
    const { errors } = await openApp(page);

    // The space that was open ("Travail") is the active workspace.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Travail');
    await expect(card(page, 'Clients')).toHaveAttribute('data-cat', '14'); // #db2777, pink
    expect(await linkNames(page, 'Clients')).toEqual(['Intranet']);
    await expect(page.getByRole('link', { name: /^Intranet/ })).toHaveAttribute(
      'href',
      'https://intranet.example/',
    );
    // The theme of the previous version is kept.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // The import says what it did.
    await expect(page.getByText('Tes favoris ont été importés')).toBeVisible();
    await expect(page.getByText(/avait 3 espaces/)).toBeVisible();
    expect(errors).toEqual([]);

    const dialog = await openWorkspaces(page);
    await expect(dialog.getByText('Mon espace', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Travail', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Lectures', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Basculer', exact: true }).first().click();
    await (
      await dialogNamed(page, 'Changer d’espace de travail ?')
    )
      .getByRole('button', { name: 'Confirmer' })
      .click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mon espace');
    // Groups keep their order, colour, star and fold; the featured group is shown first.
    await expect(card(page, 'Documentation')).toHaveAttribute('data-cat', '10'); // #6366f1, indigo
    await expect(card(page, 'Outils')).toHaveAttribute('data-cat', '6'); // #0d9488, teal
    await expect(card(page, 'Lecture')).toHaveAttribute('data-cat', '2'); // #d97706, amber
    await expect(card(page, 'Documentation').getByText('Mis en avant')).toBeAttached();
    await expect(foldButton(page, 'Outils')).toHaveAttribute('aria-expanded', 'false');
    expect(await linkNames(page, 'Documentation')).toEqual(['MDN Web Docs', 'Can I Use']);
    // A link of a tag that no longer existed has a group made from the tag; an empty tag has none.
    expect(await linkNames(page, 'ancien-tag')).toEqual(['Tag disparu']);
    expect(await linkNames(page, 'Sans groupe')).toEqual(['Vieux lien']);
    // An address without a scheme gets https://.
    await expect(page.getByRole('link', { name: /^Sans schéma/ })).toHaveAttribute(
      'href',
      'https://exemple.org',
    );
  });

  test('a javascript: link of the old data is not imported, and the warning says so', async ({
    page,
  }) => {
    await openApp(page);

    await expect(page.getByText('Certains enregistrements n’ont pas été importés')).toBeVisible();
    await expect(
      page.getByText('1 enregistrement était inutilisable et a été ignoré.'),
    ).toBeVisible();
    // Neither in the active workspace nor in the one that held it.
    expect(await page.locator('a[href^="javascript:" i]').count()).toBe(0);
    const stored = await page.evaluate(async () => {
      const read = (/** @type {string} */ name) =>
        new Promise((resolve) => {
          const open = indexedDB.open(name);
          open.onsuccess = () => {
            const all = open.result.transaction('links').objectStore('links').getAll();
            all.onsuccess = () => {
              open.result.close();
              resolve(all.result);
            };
          };
        });
      return JSON.stringify(await read('favoris__default'));
    });
    expect(stored).not.toContain('javascript');
    expect(stored).toContain('MDN Web Docs');
  });

  test('the old keys are never changed or deleted, and a reload does not import again', async ({
    page,
  }) => {
    const before = sorted(multiSpaceStorage());
    await openApp(page);
    expect(await oldKeys(page)).toEqual(before);

    await addLink(page, { name: 'Nouveau', url: 'nouveau.example' });
    await waitForWrite(page, 'links', 'name', 'Nouveau', 'travail');
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Travail');
    await expect(page.getByRole('link', { name: /^Nouveau/ })).toBeVisible();
    await expect(page.getByText('Tes favoris ont été importés')).toHaveCount(0);
    expect(await oldKeys(page)).toEqual(before);
    // The import is recorded in the preferences of the app, with the app prefix.
    expect(await page.evaluate(() => localStorage.getItem('favoris-legacy-import'))).toBe('1');
    const workspaces = JSON.parse(
      (await page.evaluate(() => localStorage.getItem('favoris-workspaces'))) ?? '[]',
    );
    expect(workspaces.map((/** @type {{ id: string }} */ w) => w.id)).toEqual([
      'default',
      'travail',
      'lectures-2',
    ]);
  });
});

test('a browser with the single key of the versions before spaces gets one workspace', async ({
  page,
}) => {
  await seedLegacyStorage(page, singleKeyStorage());

  await openApp(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes favoris');
  await expect(card(page, 'Documentation')).toHaveAttribute('data-cat', '9'); // #2563eb, blue
  expect(await linkNames(page, 'Documentation')).toEqual(['MDN']);
  expect(await linkNames(page, 'Sans groupe')).toEqual(['Sans tag']);
  await expect(page.getByText(/avait 1 espace/)).toBeVisible();
  expect(await oldKeys(page)).toEqual(sorted(singleKeyStorage()));
});

test('a space whose stored data is damaged is imported empty, and the others are not lost', async ({
  page,
}) => {
  const keys = multiSpaceStorage();
  keys['favoris.v1:default'] = '{"tags": [{"id": ';
  await seedLegacyStorage(page, keys);

  await openApp(page);

  await expect(page.getByText(/1 espace contenait des données illisibles/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Travail');
  expect(await linkNames(page, 'Clients')).toEqual(['Intranet']);
  // The damaged data is still there, for whoever wants to recover it.
  expect((await oldKeys(page))['favoris.v1:default']).toBe('{"tags": [{"id": ');
});

test('a browser that never ran the previous version starts clean, and records that it looked', async ({
  page,
}) => {
  await openApp(page);

  await expect(page.getByText('Aucun favori pour le moment')).toBeVisible();
  await expect(page.getByText('Tes favoris ont été importés')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('favoris-legacy-import'))).toBe('1');
});

test('old data that shows up after the app started is not imported over the new data', async ({
  page,
}) => {
  await openApp(page);
  await addLink(page, { name: 'Le mien', url: 'mien.example' });
  await waitForWrite(page, 'links', 'name', 'Le mien');
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, multiSpaceStorage());

  await page.reload();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes favoris');
  await expect(page.getByRole('link', { name: /^Le mien/ })).toBeVisible();
  await expect(page.getByText('Tes favoris ont été importés')).toHaveCount(0);
});
