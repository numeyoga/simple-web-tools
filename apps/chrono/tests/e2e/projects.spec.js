import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

test('project: creation then archiving', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();
  const main = page.getByRole('main');

  await main.getByRole('button', { name: 'Nouveau projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialog.getByRole('textbox', { name: 'Nom du projet' }).fill('Projet Alpha');
  await dialog.getByRole('textbox', { name: 'Client' }).fill('Acme');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();

  await expect(main.getByText('Projet Alpha')).toBeVisible();
  await expect(main.getByText('1 actifs · 0 archivés')).toBeVisible();

  await main.getByRole('button', { name: 'Archiver' }).click();

  await expect(main.getByText('Aucun projet actif.')).toBeVisible();
  await expect(main.getByText('0 actifs · 1 archivés')).toBeVisible();
  await main.getByRole('radio', { name: 'Archivés' }).check(); // switches to the list of the archived ones
  await expect(main.getByText('Projet Alpha')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Désarchiver' })).toBeVisible();

  expect(errors).toEqual([]);
});

/**
 * Creates a project from the Projets view, picking a colour on the way.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {(dialog: import('@playwright/test').Locator) => Promise<void>} [choose]
 */
async function addProject(page, name, choose = async () => {}) {
  await page.getByRole('main').getByRole('button', { name: 'Nouveau projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialog.getByRole('textbox', { name: 'Nom du projet' }).fill(name);
  await choose(dialog);
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** The colour of the card of a project: its category, or `custom`. */
const colorOf = (/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ name) =>
  page.getByRole('article').filter({ hasText: name }).getAttribute('data-cat');

test('project colours: new projects take the default order, and the picker offers the 16 hues', async ({
  page,
}) => {
  const { errors } = await openApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();

  await page.getByRole('main').getByRole('button', { name: 'Nouveau projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  // The first project is blue (9), and the choice is a radio group of 16 named hues.
  await expect(dialog.getByRole('radio')).toHaveCount(16);
  await expect(dialog.getByRole('radio', { name: 'Bleu', exact: true })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: 'Ardoise' })).not.toBeChecked();
  await page.keyboard.press('Escape');

  await addProject(page, 'Un');
  await addProject(page, 'Deux');
  await addProject(page, 'Trois');
  expect(await colorOf(page, 'Un')).toBe('9'); // blue
  expect(await colorOf(page, 'Deux')).toBe('4'); // lime
  expect(await colorOf(page, 'Trois')).toBe('14'); // pink
  // The name is always next to the colour.
  await expect(page.getByRole('article').filter({ hasText: 'Un' }).getByRole('heading')).toHaveText(
    'Un',
  );
  expect(errors).toEqual([]);
});

test('project colours: a swatch and the free colour replace each other, and both are kept', async ({
  page,
}) => {
  const { errors } = await openApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();
  await addProject(page, 'Libre', async (dialog) => {
    await dialog.getByRole('radio', { name: 'Sarcelle' }).check();
    await dialog.getByLabel('Couleur personnalisée').fill('#ffff00');
    // Choosing the free colour clears the swatch.
    await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
  });
  await addProject(page, 'Palette', async (dialog) => {
    await dialog.getByLabel('Couleur personnalisée').fill('#ffff00');
    await dialog.getByRole('radio', { name: 'Rose', exact: true }).check();
    // ... and choosing a swatch clears the free colour.
  });
  expect(await colorOf(page, 'Libre')).toBe('custom');
  expect(await colorOf(page, 'Palette')).toBe('14');

  // The editor shows what is stored, and a change of kind is saved.
  const main = page.getByRole('main');
  await main
    .getByRole('article')
    .filter({ hasText: 'Libre' })
    .getByRole('button', { name: 'Modifier' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Modifier le projet' });
  await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Couleur personnalisée')).toHaveValue('#ffff00');
  await dialog.getByRole('radio', { name: 'Orange' }).check();
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  expect(await colorOf(page, 'Libre')).toBe('1');

  // Both fields reach IndexedDB: exactly one of the two is set.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const req = indexedDB.open('chrono__default');
            req.onsuccess = () => {
              const all = req.result.transaction('projects').objectStore('projects').getAll();
              all.onsuccess = () => {
                req.result.close();
                resolve(
                  all.result
                    .map((p) => [p.name, p.category, p.customColor, 'color' in p])
                    .sort((x, y) => x[0].localeCompare(y[0])),
                );
              };
            };
          }),
      ),
    )
    .toEqual([
      ['Libre', 1, null, false],
      ['Palette', 14, null, false],
    ]);
  expect(errors).toEqual([]);
});

test('project colours: the radios move with the arrow keys', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Nouveau projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });

  await dialog.getByRole('radio', { name: 'Bleu', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Indigo' })).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('radio', { name: 'Bleu ciel' })).toBeChecked();
  expect(errors).toEqual([]);
});
