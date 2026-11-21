// The folders journey: create a folder in a chosen category, quick-create a note with a
// category's add button, rename, move to another category, collapse, delete (notes are kept), and
// the folders are still there after a reload.
import { expect, test } from '@playwright/test';
import { createNote, openApp, openFolderMenu, readStore, treeRowName } from './support.js';

/** @param {import('@playwright/test').Page} page */
const nav = (page) => page.getByRole('navigation', { name: 'Navigation principale' });

/**
 * Creates a folder from the tree.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {string} category label of the category in the select
 */
async function createFolder(page, name, category) {
  await nav(page).getByRole('button', { name: 'Nouveau dossier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau dossier' });
  await dialog.getByLabel('Nom du dossier').fill(name);
  await dialog.getByLabel('Catégorie').selectOption({ label: category });
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('a folder is created in the category that was chosen, and is selected', async ({ page }) => {
  await openApp(page);
  await createFolder(page, 'Refonte du site', 'Domaines');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Refonte du site');
  const folder = nav(page).getByRole('button', { name: /^Refonte du site/ });
  await expect(folder).toHaveAttribute('aria-current', 'page');
  // It sits under Domaines, not under Projets (the prototype put every folder in Projets).
  await expect(
    nav(page)
      .getByRole('listitem')
      .filter({ hasText: 'Domaines' })
      .getByRole('button', { name: /^Refonte du site/ }),
  ).toBeVisible();
  await expect(
    nav(page)
      .getByRole('listitem')
      .filter({ hasText: 'Projets' })
      .getByRole('button', { name: /^Refonte du site/ }),
  ).toHaveCount(0);

  await expect
    .poll(async () => (await readStore(page, 'folders')).map((f) => f.category))
    .toEqual(['areas']);
  await page.reload();
  await expect(nav(page).getByRole('button', { name: /^Refonte du site/ })).toBeVisible();
});

test('a folder needs a name, and Enter confirms the dialog', async ({ page }) => {
  await openApp(page);
  await nav(page).getByRole('button', { name: 'Nouveau dossier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau dossier' });
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(dialog.getByText('Le nom est vide')).toBeVisible();
  await dialog.getByLabel('Nom du dossier').fill('Clients');
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(nav(page).getByRole('button', { name: /^Clients/ })).toBeVisible();
});

test('the add button of a category creates a note in its folder, a default one when it has none', async ({
  page,
}) => {
  await openApp(page);
  await nav(page).getByRole('button', { name: 'Nouvelle note dans Ressources' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ressources générales');
  await expect(nav(page).getByRole('button', { name: treeRowName('Ressources') })).toContainText(
    '1',
  );
  await expect(page.getByRole('combobox', { name: 'Dossier' })).toHaveValue(/.+/);
  await expect(page.getByRole('main').getByRole('button', { name: /^Sans titre/ })).toBeVisible();

  // Again: the same folder, no second default folder.
  await nav(page).getByRole('button', { name: 'Nouvelle note dans Ressources' }).click();
  await expect(nav(page).getByRole('button', { name: /^Ressources générales/ })).toHaveCount(1);
  await expect(nav(page).getByRole('button', { name: treeRowName('Ressources') })).toContainText(
    '2',
  );
});

test('a folder is renamed and moved to another category, its notes follow', async ({ page }) => {
  await openApp(page);
  await createFolder(page, 'Idées', 'Projets');
  await createNote(page);
  await expect(page.getByRole('combobox', { name: 'Dossier' })).toHaveValue(/.+/);

  let menu = await openFolderMenu(page, 'Idées');
  await menu.getByRole('menuitem', { name: 'Renommer' }).click();
  const rename = page.getByRole('dialog', { name: 'Renommer le dossier' });
  await expect(rename.getByLabel('Nom du dossier')).toHaveValue('Idées');
  await rename.getByLabel('Nom du dossier').fill('Idées en vrac');
  await rename.getByRole('button', { name: 'Renommer' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Idées en vrac');

  menu = await openFolderMenu(page, 'Idées en vrac');
  await menu.getByRole('menuitem', { name: 'Déplacer vers une autre catégorie' }).click();
  const move = page.getByRole('dialog', { name: 'Déplacer le dossier' });
  await move.getByLabel('Catégorie').selectOption({ label: 'Archives' });
  await move.getByRole('button', { name: 'Déplacer', exact: true }).click();

  await expect(nav(page).getByRole('button', { name: treeRowName('Archives') })).toContainText('1');
  await expect(nav(page).getByRole('button', { name: treeRowName('Projets') })).toContainText('0');
  await expect
    .poll(async () => (await readStore(page, 'folders')).map((f) => f.category))
    .toEqual(['archives']);
});

test('a category is collapsed and expanded, and its folders are hidden with it', async ({
  page,
}) => {
  await openApp(page);
  await createFolder(page, 'Chantier', 'Projets');
  const folder = nav(page).getByRole('button', { name: /^Chantier/ });
  await expect(folder).toBeVisible();

  const toggle = nav(page).getByRole('button', { name: 'Replier Projets' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(folder).toBeHidden();
  const expand = nav(page).getByRole('button', { name: 'Déplier Projets' });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expand.click();
  await expect(folder).toBeVisible();
});

test('a folded category stays folded after a reload, and a damaged value is ignored', async ({
  page,
}) => {
  const { errors } = await openApp(page);
  await createFolder(page, 'Chantier', 'Projets');
  await createFolder(page, 'Veille', 'Ressources');
  await nav(page).getByRole('button', { name: 'Replier Projets' }).click();
  await expect(nav(page).getByRole('button', { name: /^Chantier/ })).toBeHidden();

  await page.reload();

  await expect(nav(page).getByRole('button', { name: 'Déplier Projets' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(nav(page).getByRole('button', { name: /^Chantier/ })).toBeHidden();
  await expect(nav(page).getByRole('button', { name: /^Veille/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('transient-notes-collapsed-default'))).toBe(
    '["projects"]',
  );

  // Unfolding forgets it; a value that is not a list of categories folds nothing.
  await nav(page).getByRole('button', { name: 'Déplier Projets' }).click();
  await page.reload();
  await expect(nav(page).getByRole('button', { name: /^Chantier/ })).toBeVisible();
  for (const bad of ['{"projects":true}', 'projects', '["nope", 7]', '{']) {
    await page.evaluate(
      (value) => localStorage.setItem('transient-notes-collapsed-default', value),
      bad,
    );
    await page.reload();
    await expect(nav(page).getByRole('button', { name: /^Chantier/ })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('deleting a folder asks first and keeps its notes, with no folder', async ({ page }) => {
  await openApp(page);
  await createFolder(page, 'Éphémère', 'Projets');
  await createNote(page);
  await page.getByRole('textbox', { name: 'Titre' }).fill('Reste');

  let menu = await openFolderMenu(page, 'Éphémère');
  await menu.getByRole('menuitem', { name: 'Supprimer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer ce dossier ?' });
  await expect(dialog).toContainText('Sa note est conservée sans dossier');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(nav(page).getByRole('button', { name: /^Éphémère/ })).toBeVisible();

  menu = await openFolderMenu(page, 'Éphémère');
  await menu.getByRole('menuitem', { name: 'Supprimer' }).click();
  await page
    .getByRole('dialog', { name: 'Supprimer ce dossier ?' })
    .getByRole('button', { name: 'Supprimer le dossier' })
    .click();
  await expect(page.getByText('Dossier supprimé')).toBeVisible();
  await expect(nav(page).getByRole('button', { name: /^Éphémère/ })).toHaveCount(0);
  // The selection falls back to the category; the note is in "All notes", with no folder.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projets');
  await nav(page)
    .getByRole('button', { name: treeRowName('Toutes les notes') })
    .click();
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Reste/ })
    .click();
  await expect(page.getByRole('combobox', { name: 'Dossier' })).toHaveValue('');
  expect((await readStore(page, 'notes')).map((n) => n.folderId)).toEqual([null]);
});
