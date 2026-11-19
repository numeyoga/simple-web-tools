// Single-writer model: one tab writes, the others are read-only until the writer goes away.
// Two pages of the SAME browser context share the origin, the storage and the Web Locks.
import { expect, test } from '@playwright/test';
import { createProject, openApp } from './support.js';

const BANNER = 'Chrono est ouvert dans un autre onglet. Cet onglet est en lecture seule.';

test('a second tab is read-only: banner, disabled actions, no shortcut', async ({ context }) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  const { errors } = await openApp(reader);

  await expect(reader.getByTestId('read-only-banner')).toContainText(BANNER);
  await expect(writer.getByTestId('read-only-banner')).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Pointer arrivée' })).toBeDisabled();
  await expect(reader.getByRole('button', { name: 'Démarrer un chrono' }).first()).toBeDisabled();
  await expect(reader.getByRole('main').getByRole('button', { name: 'Nouvelle' })).toBeDisabled();
  await reader.getByRole('button', { name: 'Projets' }).click();
  await expect(reader.getByRole('button', { name: 'Nouveau projet' })).toBeDisabled();
  // The shortcuts that start or change a timer do nothing.
  await reader.getByRole('main').click();
  await reader.keyboard.press('n');
  await reader.keyboard.press('Space');
  await expect(reader.getByRole('dialog')).toHaveCount(0);
  // The writer is not affected.
  await expect(writer.getByRole('button', { name: 'Pointer arrivée' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('a read-only tab keeps counting: the duration of a running timer moves on', async ({
  context,
}) => {
  const writer = await context.newPage();
  await openApp(writer);
  await createProject(writer, 'Alpha');
  await writer.getByRole('navigation').getByRole('button', { name: 'Démarrer un chrono' }).click();
  await writer
    .getByRole('dialog', { name: 'Ajouter un chrono' })
    .getByRole('button', { name: 'Démarrer', exact: true })
    .click();
  const reader = await context.newPage();
  await openApp(reader);
  const duration = reader
    .getByRole('navigation')
    .getByText(/^\d\d:\d\d:\d\d$/)
    .first();
  await expect(duration).toBeVisible();
  const first = await duration.textContent();

  await expect(duration).not.toHaveText(/** @type {string} */ (first));
});

test('a change in the writer appears in the read-only tab', async ({ context }) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);
  await reader.getByRole('button', { name: 'Projets' }).click();
  await expect(reader.getByText('Aucun projet actif.')).toBeVisible();

  await createProject(writer, 'Alpha');

  await expect(reader.getByRole('main').getByText('Alpha')).toBeVisible();
  await expect(reader.getByTestId('read-only-banner')).toBeVisible();
});

test('closing the writer promotes the read-only tab, which re-reads and can write', async ({
  context,
}) => {
  const writer = await context.newPage();
  await openApp(writer);
  const reader = await context.newPage();
  await openApp(reader);
  await createProject(writer, 'Alpha');
  await reader.getByRole('button', { name: 'Projets' }).click();
  await expect(reader.getByRole('main').getByText('Alpha')).toBeVisible();

  await writer.close();

  await expect(reader.getByTestId('read-only-banner')).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Nouveau projet' })).toBeEnabled();
  await expect(reader.getByText('Édition rétablie')).toBeVisible();
  await createProject(reader, 'Beta');
  await reader.getByRole('button', { name: 'Projets' }).click();
  await expect(reader.getByRole('main').getByText('Alpha')).toBeVisible();
  await expect(reader.getByRole('main').getByText('Beta')).toBeVisible();
});

test('a tab that reloads gets the lock back and stays the writer', async ({ page }) => {
  await openApp(page);

  await page.reload();

  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pointer arrivée' })).toBeEnabled();
  await expect(page.getByTestId('read-only-banner')).toHaveCount(0);
});
