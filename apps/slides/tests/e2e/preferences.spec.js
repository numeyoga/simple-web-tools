// The preferences: theme and text size apply at once and are stored; the language follows the browser
// and can be chosen (the page then reloads); the letter and digit shortcuts can be turned off.
import { expect, test } from '@playwright/test';
import { expectSlide, loadExample, openApp, slide } from './support.js';

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
  expect(await stored(page, 'slides-theme')).toBe('dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const again = await openPreferences(page);
  await expect(again.getByRole('radio', { name: 'Sombre' })).toBeChecked();

  await again.getByRole('radio', { name: 'Système' }).check();
  expect(await stored(page, 'slides-theme')).toBeNull();
  await expect(html).toHaveAttribute('data-theme', 'light');

  // The system theme is followed again, live, once it is the chosen one.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('the theme of the app does not change the theme of the slides', async ({ page }) => {
  await openApp(page);
  await loadExample(page); // theme: dark
  await page.getByRole('button', { name: 'Préférences' }).click();
  await page.getByRole('radio', { name: 'Clair' }).check();
  await page.keyboard.press('Escape');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.sl-stage')).toHaveAttribute('data-theme', 'dark');
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
  expect(await stored(page, 'slides-text-size')).toBe('large');

  await page.reload();
  expect(await rootSize()).toBe(20);
  const again = await openPreferences(page);
  await expect(again.getByRole('radio', { name: 'Grande' })).toBeChecked();

  await again.getByRole('radio', { name: 'Automatique' }).check();
  expect(await stored(page, 'slides-text-size')).toBeNull();
  expect(await rootSize()).toBe(16);
});

test('language: the choice is stored, reloads the page and survives a reload', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  const dialog = await openPreferences(page);

  await dialog.getByLabel('Language / Langue').selectOption('en');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open a presentation');
  // No English among the languages of the browser: the language alone, no region.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await stored(page, 'slides-locale')).toBe('en');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open a presentation');
  await expect(page).toHaveTitle('Slides · Markdown presentations');
});

test('the letter and digit shortcuts can be turned off, the navigation keys stay', async ({
  page,
}) => {
  await openApp(page);
  await loadExample(page);
  await page.getByRole('button', { name: 'Préférences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Préférences' });
  const toggle = dialog.getByRole('switch', { name: /^Raccourcis lettres et chiffres/ });
  await expect(toggle).toBeChecked();
  await expect(dialog.getByText('Vue d’ensemble', { exact: true })).toBeVisible();
  await toggle.uncheck();
  expect(await stored(page, 'slides-single-key-shortcuts')).toBe('0');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Focus went back to the preferences button, which Enter would press: put it on the slide.
  await slide(page).focus();

  await page.keyboard.press('o');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectSlide(page, 1);
  await page.keyboard.press('ArrowRight');
  await expectSlide(page, 2);
  await page.keyboard.press('End');
  await expectSlide(page, 6);

  await page.reload();
  await loadExample(page);
  await page.keyboard.press('o');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a shortcut does not fire while a dialog is open', async ({ page }) => {
  await openApp(page);
  await loadExample(page);
  const dialog = await openPreferences(page);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('r');
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().click();

  await expectSlide(page, 1);
  await expect(page.locator('.sl-stage')).toHaveAttribute('data-ratio', 'fixed');
});
