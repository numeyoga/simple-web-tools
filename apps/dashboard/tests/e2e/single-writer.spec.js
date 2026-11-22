// Single-writer model: one tab writes, the others are read-only until the writer goes away. Two
// pages of the SAME browser context share the origin, the storage and the Web Locks.
import { expect, test } from '@playwright/test';
import { createApp, loadSample, openApp, openWorkspaces, waitForWrite } from './support.js';

const BANNER = 'Dashboard est ouvert dans un autre onglet. Cet onglet est en lecture seule.';

test('a second tab is read-only: banner, disabled actions, no shortcut', async ({ context }) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  const { errors } = await openApp(reader);

  await expect(reader.getByTestId('read-only-banner')).toContainText(BANNER);
  await expect(writer.getByTestId('read-only-banner')).toHaveCount(0);
  await expect(
    reader.getByRole('button', { name: 'Nouvelle application', exact: true }).first(),
  ).toBeDisabled();
  // The shortcut that adds an application does nothing.
  await reader.getByRole('heading', { level: 1 }).click();
  await reader.keyboard.press('n');
  await expect(reader.getByRole('dialog')).toHaveCount(0);
  // Browsing still works: the filter is a view, not data.
  await reader.getByRole('searchbox', { name: 'Filtrer les applications et les liens' }).fill('x');
  // The writer is not affected.
  await expect(
    writer.getByRole('button', { name: 'Nouvelle application', exact: true }).first(),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test('the workspace dialog of a read-only tab cannot create, rename, duplicate or delete', async ({
  context,
}) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);

  const dialog = await openWorkspaces(reader);

  await expect(dialog.getByRole('button', { name: 'Créer', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Renommer' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Dupliquer' })).toBeDisabled();
  // The keyboard path ends at the guard: Enter in the name field creates nothing.
  await dialog.getByLabel('Nom du nouvel espace de travail').fill('Intrus');
  await reader.keyboard.press('Enter');
  await expect(reader.getByText('Lecture seule', { exact: true }).first()).toBeVisible();
  expect(await reader.evaluate(() => localStorage.getItem('dashboard-workspaces'))).not.toContain(
    'intrus',
  );
});

test('a change in the writer appears in the read-only tab', async ({ context }) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);
  await expect(
    reader.getByText('Aucune application pour le moment', { exact: true }),
  ).toBeVisible();

  await loadSample(writer);

  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
  await expect(reader.getByTestId('read-only-banner')).toBeVisible();
});

test('closing the writer promotes the read-only tab, which re-reads and can write', async ({
  context,
}) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);
  await loadSample(writer);
  await waitForWrite(writer, 'apps', 'name', 'SearchIndex');
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');

  await writer.close();

  await expect(reader.getByTestId('read-only-banner')).toHaveCount(0);
  await expect(
    reader.getByRole('button', { name: 'Nouvelle application', exact: true }).first(),
  ).toBeEnabled();
  await createApp(reader, { name: 'Du second' });
  await waitForWrite(reader, 'apps', 'name', 'Du second');
});
