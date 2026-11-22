// Workspaces (the profiles of the earlier version): create, switch, rename, duplicate, delete. Each
// one is its own database, `dashboard__<id>`.
import { expect, test } from '@playwright/test';
import {
  dialogNamed,
  loadSample,
  openApp,
  openWorkspaces,
  readStore,
  waitForWrite,
} from './support.js';

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => {
    throw new Error(`a native ${dialog.type()} dialog opened: ${dialog.message()}`);
  });
});

test('a workspace is created and switched to; the data of two workspaces are separate', async ({
  page,
}) => {
  await openApp(page);
  await loadSample(page);
  await waitForWrite(page, 'apps', 'name', 'SearchIndex');

  const dialog = await openWorkspaces(page);
  await dialog.getByLabel('Nom du nouvel espace de travail').fill('Travail');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await (
    await dialogNamed(page, 'Passer à cet espace de travail ?')
  )
    .getByRole('button', { name: 'Confirmer' })
    .click();

  await expect(page.getByRole('button', { name: 'Espace de travail Travail' })).toBeVisible();
  await expect(page.getByText('Aucune application pour le moment', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SearchIndex' })).toHaveCount(0);
  // The new workspace starts with the default tags, and nothing else.
  await waitForWrite(page, 'settings', 'key', 'settings', 'travail');
  expect(await readStore(page, 'apps', 'travail')).toEqual([]);

  // Each workspace is a database of its own.
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name),
  );
  expect(databases.sort()).toEqual(['dashboard__default', 'dashboard__travail']);
  expect(await readStore(page, 'apps', 'default')).toHaveLength(12);

  const again = await openWorkspaces(page);
  await expect(again.getByText('Actif', { exact: true })).toBeVisible();
  await again.getByRole('button', { name: 'Passer à celui-ci', exact: true }).click();
  await (
    await dialogNamed(page, 'Changer d’espace de travail ?')
  )
    .getByRole('button', { name: 'Confirmer' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
  // The choice survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
});

test('creating a workspace and staying on the current one', async ({ page }) => {
  await openApp(page);
  const dialog = await openWorkspaces(page);

  await dialog.getByLabel('Nom du nouvel espace de travail').fill('Lectures');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await (
    await dialogNamed(page, 'Passer à cet espace de travail ?')
  )
    .getByRole('button', { name: 'Annuler' })
    .click();

  await expect(dialog.getByText('lectures', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Espace de travail Mon dashboard' })).toBeVisible();
});

test('a workspace needs a name', async ({ page }) => {
  await openApp(page);
  const dialog = await openWorkspaces(page);

  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();

  await expect(dialog.getByText('Le nom est vide')).toBeVisible();
});

test('a workspace is renamed', async ({ page }) => {
  await openApp(page);
  const dialog = await openWorkspaces(page);

  await dialog.getByRole('button', { name: 'Renommer' }).click();
  await dialog.getByLabel('Nom de l’espace de travail').fill('Maison');
  await dialog.getByLabel('Nom de l’espace de travail').press('Enter');

  await expect(dialog.getByText('Maison', { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('dashboard-workspaces'));
  expect(JSON.parse(stored ?? '[]')[0]).toMatchObject({ id: 'default', label: 'Maison' });
});

test('a workspace is duplicated, with its templates and applications', async ({ page }) => {
  await openApp(page);
  await loadSample(page);
  await waitForWrite(page, 'apps', 'name', 'SearchIndex');
  const dialog = await openWorkspaces(page);

  await dialog.getByRole('button', { name: 'Dupliquer' }).click();

  await expect(dialog.getByText('Mon dashboard (copie)')).toBeVisible();
  await expect(page.getByText('Espace de travail dupliqué')).toBeVisible();
  await expect
    .poll(async () => (await readStore(page, 'apps', 'mon-dashboard-copie')).length)
    .toBe(12);
  expect(await readStore(page, 'templates', 'mon-dashboard-copie')).toHaveLength(4);
  // The original is untouched, and the copy is not the active workspace.
  expect(await readStore(page, 'apps', 'default')).toHaveLength(12);
  await expect(page.getByRole('button', { name: 'Espace de travail Mon dashboard' })).toBeVisible();
});

test('a workspace is deleted after a confirmation; the active and the last one cannot be', async ({
  page,
}) => {
  await openApp(page);
  const dialog = await openWorkspaces(page);
  // Alone: nothing to delete.
  await expect(
    dialog.getByRole('button', { name: 'Indisponible : espace actif ou dernier espace' }),
  ).toBeDisabled();

  await dialog.getByLabel('Nom du nouvel espace de travail').fill('Jetable');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await (
    await dialogNamed(page, 'Passer à cet espace de travail ?')
  )
    .getByRole('button', { name: 'Annuler' })
    .click();
  // The active one stays protected, the other can go.
  await expect(
    dialog.getByRole('button', { name: 'Indisponible : espace actif ou dernier espace' }),
  ).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await (
    await dialogNamed(page, 'Supprimer cet espace de travail ?')
  )
    .getByRole('button', { name: 'Annuler' })
    .click();
  await expect(dialog.getByText('jetable', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await (
    await dialogNamed(page, 'Supprimer cet espace de travail ?')
  )
    .getByRole('button', { name: 'Supprimer', exact: true })
    .click();

  await expect(dialog.getByText('jetable', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Espace de travail supprimé')).toBeVisible();
});
