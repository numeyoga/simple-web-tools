// Workspaces: several independent sets of notes, one IndexedDB database each. The dialog creates,
// renames, switches and deletes them, and exports or imports the JSON backup of the active one.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createNote, goToSelection, openApp, openWorkspaces, waitForWrite } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

const SWITCH_TO_NEW = 'Basculer sur cet espace ?';

/**
 * Creates a workspace from the dialog and answers the question that follows. With `stay` the
 * dialog stays open and is returned.
 * @param {Page} page
 * @param {string} name
 * @param {'switch' | 'stay'} then
 */
async function createWorkspace(page, name, then) {
  const dialog = await openWorkspaces(page);
  await dialog.getByLabel('Nom du nouvel espace').fill(name);
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  const question = page.getByRole('dialog', { name: SWITCH_TO_NEW });
  await question.getByRole('button', { name: then === 'switch' ? 'Confirmer' : 'Annuler' }).click();
  return dialog;
}

test('workspaces: create a second one, switch, the notes are separate', async ({ page }) => {
  const { errors } = await openApp(page);
  await createNote(page);
  await waitForWrite(page, 'notes', 'title', '');
  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(1);

  await createWorkspace(page, 'Perso', 'switch');

  // The page reloaded on "Perso", which is empty; its name is in the sidebar.
  await expect(page.getByRole('button', { name: 'Espace de travail Perso' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Aucune note ici pour le moment')).toBeVisible();
  await createNote(page);
  await createNote(page);
  await waitForWrite(page, 'notes', 'title', '', 'perso');
  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(2);

  // Back to the main workspace: one note, not three.
  const dialog = await openWorkspaces(page);
  await dialog.getByRole('button', { name: 'Basculer' }).click();
  await page
    .getByRole('dialog', { name: 'Changer d’espace ?' })
    .getByRole('button', { name: 'Confirmer' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Espace de travail Espace principal' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('workspaces: the choice is kept: a reload opens the workspace that was chosen', async ({
  page,
}) => {
  await openApp(page);
  await createWorkspace(page, 'Travail', 'switch');
  await expect(page.getByRole('button', { name: 'Espace de travail Travail' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Espace de travail Travail' })).toBeVisible();
  const keys = await page.evaluate(() => ({
    list: localStorage.getItem('transient-notes-workspaces'),
    active: localStorage.getItem('transient-notes-workspace-active'),
  }));
  expect(keys.active).toBe('travail');
  expect(JSON.parse(keys.list ?? '[]').map((/** @type {{ id: string }} */ w) => w.id)).toEqual([
    'default',
    'travail',
  ]);
});

test('workspaces: rename, delete after a confirmation, and never the active or the last one', async ({
  page,
}) => {
  const { errors } = await openApp(page);

  // With one workspace, nothing can be deleted.
  let dialog = await openWorkspaces(page);
  await expect(
    dialog.getByRole('button', { name: /^Impossible : actif ou dernier/ }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');

  dialog = await createWorkspace(page, 'Archive 2025', 'stay');
  await expect(dialog.getByText('archive-2025')).toBeVisible();
  // The active workspace cannot be deleted, the other one can.
  await expect(
    dialog.getByRole('button', { name: /^Impossible : actif ou dernier/ }),
  ).toBeDisabled();

  // Rename it: Escape cancels the edit, not the dialog.
  await dialog.getByRole('button', { name: 'Renommer' }).last().click();
  await dialog.getByRole('textbox', { name: 'Nom de l’espace' }).fill('Autre nom');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Archive 2025')).toBeVisible();
  await dialog.getByRole('button', { name: 'Renommer' }).last().click();
  await dialog.getByRole('textbox', { name: 'Nom de l’espace' }).fill('Archives 2025');
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Archives 2025')).toBeVisible();

  // Delete it, after a question that can be refused.
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  const question = page.getByRole('dialog', { name: 'Supprimer cet espace ?' });
  await question.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog.getByText('Archives 2025')).toBeVisible();
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Supprimer cet espace ?' })
    .getByRole('button', { name: 'Supprimer', exact: true })
    .click();
  await expect(dialog.getByText('Archives 2025')).toHaveCount(0);
  await expect(page.getByText('Espace supprimé')).toBeVisible();
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name),
  );
  expect(databases).not.toContain('transient-notes__archive-2025');
  expect(errors).toEqual([]);
});

test('workspaces: the name of a workspace is shown as text, never as HTML', async ({ page }) => {
  const name = '<img src=x onerror="window.__xss=1"><b>bold</b>';
  const { errors } = await openApp(page);

  const dialog = await createWorkspace(page, name, 'stay');
  await expect(dialog.getByText(name)).toBeVisible();
  await expect(dialog.locator('img, b')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Supprimer cet espace ?' });
  await expect(confirmation.getByText(name)).toBeVisible();
  await expect(confirmation.locator('img, b')).toHaveCount(0);
  expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('workspaces: a blank name is refused with a message', async ({ page }) => {
  await openApp(page);
  const dialog = await openWorkspaces(page);

  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();

  await expect(dialog.getByText('Le nom est vide. Saisis le nom du nouvel espace.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: SWITCH_TO_NEW })).toHaveCount(0);
});

test('backup: the JSON export of a workspace restores into another one', async ({ page }) => {
  const { errors } = await openApp(page);
  await goToSelection(page, 'Domaines');
  await createNote(page);
  await waitForWrite(page, 'notes', 'title', '');

  // Export: a download named after the workspace, an envelope with the notes and the folders.
  let dialog = await openWorkspaces(page);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Exporter JSON' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^transient-notes-default-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();
  const backup = JSON.parse((await readFile(path)).toString('utf8'));
  expect(backup).toMatchObject({
    app: 'transient-notes',
    format: 'transient-notes-workspace',
    version: 1,
  });
  expect(backup.data.notes).toHaveLength(1);
  expect(backup.data.folders).toMatchObject([{ name: 'Domaines généraux', category: 'areas' }]);
  await page.keyboard.press('Escape');

  // Import into a new, empty workspace: the notes come back after a confirmation.
  await createWorkspace(page, 'Copie', 'switch');
  await expect(page.getByRole('button', { name: 'Espace de travail Copie' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Aucune note ici pour le moment')).toBeVisible();
  dialog = await openWorkspaces(page);
  await dialog.locator('input[type="file"]').setInputFiles(path);
  const question = page.getByRole('dialog', { name: 'Remplacer les notes ?' });
  await expect(question).toContainText('« Copie »');
  await question.getByRole('button', { name: 'Remplacer les notes' }).click();

  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toBeVisible();
  await goToSelection(page, 'Domaines');
  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('backup: a file that is not a backup is refused before anything is replaced', async ({
  page,
}) => {
  await openApp(page);
  await createNote(page);
  await waitForWrite(page, 'notes', 'title', '');
  const dialog = await openWorkspaces(page);

  for (const [content, message] of [
    ['{nope', 'Le fichier n’est pas du JSON valide.'],
    [
      JSON.stringify({ app: 'chrono', format: 'chrono-workspace', version: 3 }),
      'Ce fichier n’a pas été exporté par Transient Notes.',
    ],
    ['[1, 2]', 'Le fichier n’est pas une sauvegarde Transient Notes.'],
  ]) {
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(content ?? ''),
    });
    await expect(page.getByText(message ?? '')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Remplacer les notes ?' })).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(1);
});
