// Single-writer model: one tab writes, the others are read-only until the writer goes away. Two
// pages of the SAME browser context share the origin, the storage and the Web Locks.
import { expect, test } from '@playwright/test';
import { createNote, goToSelection, openApp } from './support.js';

const BANNER = 'Transient Notes est ouvert dans un autre onglet. Cet onglet est en lecture seule.';

test('a second tab is read-only: banner, disabled actions, no shortcut', async ({ context }) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  const { errors } = await openApp(reader);

  await expect(reader.getByTestId('read-only-banner')).toContainText(BANNER);
  await expect(writer.getByTestId('read-only-banner')).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Nouvelle note' })).toBeDisabled();
  // The shortcuts that create a note do nothing.
  await reader.getByRole('main').click({ position: { x: 5, y: 5 } });
  await reader.keyboard.press('n');
  await reader.keyboard.press('1');
  await expect(reader.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(0);
  // Browsing still works.
  await goToSelection(reader, 'Archives');
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('Archives');
  // The writer is not affected.
  await expect(writer.getByRole('button', { name: 'Nouvelle note' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('the workspace dialog of a read-only tab cannot create, rename, delete or import', async ({
  context,
}) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);

  await reader.getByRole('button', { name: /^Espace de travail/ }).click();
  const dialog = reader.getByRole('dialog', { name: 'Espaces de travail' });

  await expect(dialog.getByRole('button', { name: 'Créer', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Renommer' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Importer JSON' })).toBeDisabled();
  // The export only reads: it stays available.
  await expect(dialog.getByRole('button', { name: 'Exporter JSON' })).toBeEnabled();
  // The keyboard path ends at the guard: Enter in the name field creates nothing.
  await dialog.getByLabel('Nom du nouvel espace').fill('Intrus');
  await reader.keyboard.press('Enter');
  await expect(reader.getByText('Lecture seule', { exact: true }).first()).toBeVisible();
  expect(
    await reader.evaluate(() => localStorage.getItem('transient-notes-workspaces')),
  ).not.toContain('intrus');
});

test('a change in the writer appears in the read-only tab', async ({ context }) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);
  await expect(reader.getByText('Aucune note ici pour le moment')).toBeVisible();

  await createNote(writer);

  await expect(reader.getByRole('main').getByRole('button', { name: 'Sans titre' })).toBeVisible();
  await expect(reader.getByTestId('read-only-banner')).toBeVisible();
});

test('closing the writer promotes the read-only tab, which re-reads and can write', async ({
  context,
}) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);
  await createNote(writer);
  await expect(reader.getByRole('main').getByRole('button', { name: 'Sans titre' })).toBeVisible();

  await writer.close();

  await expect(reader.getByTestId('read-only-banner')).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Nouvelle note' })).toBeEnabled();
  await expect(reader.getByText('Édition rétablie')).toBeVisible();
  await createNote(reader);
  await expect(reader.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(2);
});

test('"resume editing" says so while the other tab still writes', async ({ context }) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);

  await reader.getByRole('button', { name: 'Reprendre l’édition' }).click();

  await expect(reader.getByText('Un autre onglet écrit encore')).toBeVisible();
  await expect(reader.getByTestId('read-only-banner')).toBeVisible();
});

test('a tab that reloads gets the lock back and stays the writer', async ({ page }) => {
  await openApp(page);

  await page.reload();

  await expect(page.getByRole('button', { name: 'Nouvelle note' })).toBeEnabled();
  await expect(page.getByTestId('read-only-banner')).toHaveCount(0);
});
