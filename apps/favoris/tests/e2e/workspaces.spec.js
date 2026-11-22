// Workspaces (the spaces of the previous version): create, switch, rename, duplicate, delete. Each
// one is its own database, `favoris__<id>`.
import { expect, test } from '@playwright/test';
import {
  addGroup,
  addLink,
  dialogNamed,
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

test('a workspace is created and switched to; the links of two workspaces are separate', async ({
  page,
}) => {
  await openApp(page);
  await addLink(page, { name: 'Perso', url: 'perso.example' });
  await waitForWrite(page, 'links', 'name', 'Perso');

  const dialog = await openWorkspaces(page);
  await dialog.getByLabel('Nom du nouvel espace de travail').fill('Travail');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await (
    await dialogNamed(page, 'Basculer sur cet espace ?')
  )
    .getByRole('button', { name: 'Confirmer' })
    .click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Travail');
  await expect(page.getByText('Aucun favori pour le moment')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Perso/ })).toHaveCount(0);
  await addLink(page, { name: 'Intranet', url: 'intranet.example' });
  await waitForWrite(page, 'links', 'name', 'Intranet', 'travail');

  // Each workspace is a database of its own.
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name),
  );
  expect(databases.sort()).toEqual(['favoris__default', 'favoris__travail']);
  expect((await readStore(page, 'links', 'default')).map((l) => l.name)).toEqual(['Perso']);
  expect((await readStore(page, 'links', 'travail')).map((l) => l.name)).toEqual(['Intranet']);

  const again = await openWorkspaces(page);
  await expect(again.getByText('Actif', { exact: true })).toBeVisible();
  await again.getByRole('button', { name: 'Basculer', exact: true }).click();
  await (
    await dialogNamed(page, 'Changer d’espace de travail ?')
  )
    .getByRole('button', { name: 'Confirmer' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes favoris');
  await expect(page.getByRole('link', { name: /^Perso/ })).toBeVisible();
  // The choice survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes favoris');
});

test('creating a workspace and staying on the current one', async ({ page }) => {
  await openApp(page);
  const dialog = await openWorkspaces(page);

  await dialog.getByLabel('Nom du nouvel espace de travail').fill('Lectures');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
  await (
    await dialogNamed(page, 'Basculer sur cet espace ?')
  )
    .getByRole('button', { name: 'Annuler' })
    .click();

  await expect(dialog.getByText('lectures', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes favoris');
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
  const stored = await page.evaluate(() => localStorage.getItem('favoris-workspaces'));
  expect(JSON.parse(stored ?? '[]')[0]).toMatchObject({ id: 'default', label: 'Maison' });
});

test('a workspace is duplicated, with its groups and links', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Docs');
  await addLink(page, { name: 'MDN', url: 'mdn.example', group: 'Docs' });
  await waitForWrite(page, 'links', 'name', 'MDN');
  const dialog = await openWorkspaces(page);

  await dialog.getByRole('button', { name: 'Dupliquer' }).click();

  await expect(dialog.getByText('Mes favoris (copie)')).toBeVisible();
  await expect(page.getByText('Espace de travail dupliqué')).toBeVisible();
  await expect
    .poll(async () => (await readStore(page, 'links', 'mes-favoris-copie')).length)
    .toBe(1);
  expect((await readStore(page, 'groups', 'mes-favoris-copie'))[0]).toMatchObject({
    label: 'Docs',
  });
  // The original is untouched, and the copy is not the active workspace.
  expect((await readStore(page, 'links', 'default')).map((l) => l.name)).toEqual(['MDN']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes favoris');
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
    await dialogNamed(page, 'Basculer sur cet espace ?')
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
