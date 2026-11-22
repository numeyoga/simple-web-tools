// The preferences: theme and text size apply at once and are stored; the language follows the
// browser and can be chosen (the page then reloads).
import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

/** @param {Page} page @param {string} key */
const stored = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);

/** @param {Page} page */
async function openPreferences(page) {
  await page.getByRole('button', { name: 'Préférences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('theme: Sombre applies at once, persists across a reload, and Système removes the key', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const { errors } = await openApp(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  const dialog = await openPreferences(page);
  await dialog.getByRole('radio', { name: 'Sombre' }).check();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await stored(page, 'dashboard-theme')).toBe('dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const again = await openPreferences(page);
  await expect(again.getByRole('radio', { name: 'Sombre' })).toBeChecked();

  await again.getByRole('radio', { name: 'Système' }).check();
  expect(await stored(page, 'dashboard-theme')).toBeNull();
  await expect(html).toHaveAttribute('data-theme', 'light');

  // The system theme is followed again, live, once it is the chosen one.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('text size: the choice changes the root size, is stored, and automatic removes the key', async ({
  page,
}) => {
  await openApp(page);
  const rootSize = () =>
    page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(await rootSize()).toBe(16);

  const dialog = await openPreferences(page);
  await dialog.getByRole('radio', { name: 'Grande' }).check();
  expect(await rootSize()).toBe(20);
  expect(await stored(page, 'dashboard-text-size')).toBe('large');

  await page.reload();
  expect(await rootSize()).toBe(20);
  const again = await openPreferences(page);
  await expect(again.getByRole('radio', { name: 'Grande' })).toBeChecked();

  await again.getByRole('radio', { name: 'Automatique' }).check();
  expect(await stored(page, 'dashboard-text-size')).toBeNull();
  expect(await rootSize()).toBe(16);
});

test('language: the choice is stored, reloads the page and survives a reload', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  const dialog = await openPreferences(page);

  await dialog.getByLabel('Language / Langue').selectOption('en');

  await expect(page.getByText('No application yet', { exact: true })).toBeVisible();
  // No English among the languages of the browser: the language alone, no region.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await stored(page, 'dashboard-locale')).toBe('en');
  await page.reload();
  await expect(page.getByText('No application yet', { exact: true })).toBeVisible();
  // The workspace was named in the language of the first start, and keeps its name.
  await expect(page.getByRole('button', { name: 'Workspace Mon dashboard' })).toBeVisible();
  await expect(page).toHaveTitle('Applications · Dashboard');
});

test('density: compact applies at once, is stored and survives a reload', async ({ page }) => {
  await openApp(page);
  await loadSampleQuietly(page);
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-density', /.*/);
  const rowHeight = () =>
    page
      .locator('[role="tabpanel"]:not([hidden]) .dsh-link')
      .first()
      .evaluate((row) => row.getBoundingClientRect().height);
  const comfortable = await rowHeight();

  const dialog = await openPreferences(page);
  await dialog
    .getByRole('group', { name: 'Densité' })
    .getByRole('radio', { name: 'Compacte' })
    .check();

  await expect(html).toHaveAttribute('data-density', 'compact');
  expect(await stored(page, 'dashboard-density')).toBe('compact');
  expect(await rowHeight()).toBeLessThan(comfortable);
  await page.reload();
  await expect(html).toHaveAttribute('data-density', 'compact');
  const again = await openPreferences(page);
  await expect(again.getByRole('radio', { name: 'Compacte' })).toBeChecked();
  await again
    .getByRole('group', { name: 'Densité' })
    .getByRole('radio', { name: 'Confortable' })
    .check();
  expect(await stored(page, 'dashboard-density')).toBeNull();
});

test('the dialog lists the shortcuts, and has no request to a third party to turn on', async ({
  page,
}) => {
  await openApp(page);

  const dialog = await openPreferences(page);

  await expect(dialog.getByRole('switch', { name: /^Raccourcis à une touche/ })).toBeChecked();
  await expect(dialog.getByText('Nouvelle application')).toBeVisible();
  await expect(dialog.getByText('Ctrl+K')).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(1);
});

/** Loads the sample from the empty state. @param {Page} page */
async function loadSampleQuietly(page) {
  await page.getByRole('button', { name: 'Charger l’exemple' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
}
