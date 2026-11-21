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
  expect(await stored(page, 'transient-notes-theme')).toBe('dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const again = await openPreferences(page);
  await expect(again.getByRole('radio', { name: 'Sombre' })).toBeChecked();

  await again.getByRole('radio', { name: 'Système' }).check();
  expect(await stored(page, 'transient-notes-theme')).toBeNull();
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
  expect(await stored(page, 'transient-notes-text-size')).toBe('large');

  await page.reload();
  expect(await rootSize()).toBe(20);
  const again = await openPreferences(page);
  await expect(again.getByRole('radio', { name: 'Grande' })).toBeChecked();

  await again.getByRole('radio', { name: 'Automatique' }).check();
  expect(await stored(page, 'transient-notes-text-size')).toBeNull();
  expect(await rootSize()).toBe(16);
});

test('language: the choice is stored, reloads the page and survives a reload', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  const dialog = await openPreferences(page);

  await dialog.getByLabel('Langue / Language').selectOption('en');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All notes');
  // No English among the languages of the browser: the language alone, no region.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await stored(page, 'transient-notes-locale')).toBe('en');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All notes');
  await expect(page).toHaveTitle('Transient Notes · notes sorted with PARA');
});
