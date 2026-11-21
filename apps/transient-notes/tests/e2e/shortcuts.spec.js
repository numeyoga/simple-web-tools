// Single-key shortcuts (WCAG 2.1.4): N and 1 to 4 create a note, never while typing, behind a
// dialog or with a modifier, and the preference turns them off.
import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

/** @param {Page} page */
async function openPreferences(page) {
  await page.getByRole('button', { name: 'Préférences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** @param {Page} page */
const notes = (page) => page.getByRole('main').getByRole('button', { name: 'Sans titre' });

test('they are on by default, listed in the preferences, and N creates a note', async ({
  page,
}) => {
  await openApp(page);
  const dialog = await openPreferences(page);
  await expect(dialog.getByRole('switch', { name: 'Raccourcis à une touche' })).toBeChecked();
  for (const key of ['N', '1 – 4']) {
    await expect(dialog.locator('kbd.cv-kbd', { hasText: new RegExp(`^${key}$`) })).toBeVisible();
  }
  await page.keyboard.press('Escape');

  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');

  await expect(notes(page)).toHaveCount(1);
});

test('1 to 4 create a note in Projects, Areas, Resources and Archives', async ({ page }) => {
  await openApp(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });

  for (const key of ['1', '2', '3', '4']) await page.keyboard.press(key);

  for (const name of ['Projets', 'Domaines', 'Ressources', 'Archives']) {
    await expect(nav.getByRole('button', { name: new RegExp(`^${name}`) })).toContainText('1');
  }
  // Each key made its default folder, and the last one selected it.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Archives générales');
});

test('a digit typed with Shift works, as on an AZERTY keyboard', async ({ page }) => {
  await openApp(page);
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });

  await page.keyboard.press('Shift+1');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projets généraux');
});

test('turning them off makes N do nothing, turning them on brings it back', async ({ page }) => {
  await openApp(page);
  const dialog = await openPreferences(page);
  await dialog.getByRole('switch', { name: 'Raccourcis à une touche' }).uncheck();
  expect(
    await page.evaluate(() => localStorage.getItem('transient-notes-single-key-shortcuts')),
  ).toBe('0');
  await dialog.locator('footer').getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await page.keyboard.press('1');
  await expect(notes(page)).toHaveCount(0);

  // It is still off after a reload.
  await page.reload();
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await expect(notes(page)).toHaveCount(0);

  const again = await openPreferences(page);
  await again.getByRole('switch', { name: 'Raccourcis à une touche' }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await expect(notes(page)).toHaveCount(1);
});

test('they never fire in a text field, behind a dialog or with Ctrl, Alt or Shift on a letter', async ({
  page,
}) => {
  await openApp(page);

  // In a text field: the workspace name field.
  await page.getByRole('button', { name: /^Espace de travail/ }).click();
  const workspaces = page.getByRole('dialog', { name: 'Espaces de travail' });
  const field = workspaces.getByLabel('Nom du nouvel espace');
  await field.focus();
  await page.keyboard.type('n1n2');
  await expect(field).toHaveValue('n1n2');
  // Behind the dialog: focus on its close button, a key does nothing.
  await workspaces.locator('footer').getByRole('button', { name: 'Fermer' }).focus();
  await page.keyboard.press('n');
  await page.keyboard.press('Escape');
  await expect(notes(page)).toHaveCount(0);

  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  for (const combination of ['Control+n', 'Alt+n', 'Shift+n', 'Control+1', 'Meta+n']) {
    await page.keyboard.press(combination);
  }
  await expect(notes(page)).toHaveCount(0);
});
