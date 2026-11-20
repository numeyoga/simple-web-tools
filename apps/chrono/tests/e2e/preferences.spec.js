// The preferences (step 3, lot B): theme, text size, single-key shortcuts and the migration of
// the totals preference of the version 1 key.
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

test.describe('theme', () => {
  test('Sombre applies at once, persists across a reload, and Système removes the key', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const { errors } = await openApp(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    const dialog = await openPreferences(page);
    await dialog.getByRole('radio', { name: 'Sombre' }).check();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await stored(page, 'chrono-theme')).toBe('dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const again = await openPreferences(page);
    await expect(again.getByRole('radio', { name: 'Sombre' })).toBeChecked();

    await again.getByRole('radio', { name: 'Système' }).check();
    expect(await stored(page, 'chrono-theme')).toBeNull();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await again.getByRole('radio', { name: 'Clair' }).check();
    expect(await stored(page, 'chrono-theme')).toBe('light');

    // The system theme is followed again, live, once it is the chosen one.
    await again.getByRole('radio', { name: 'Système' }).check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
  });
});

test.describe('text size', () => {
  test('the choice changes the root size, is stored, and automatic removes the key', async ({
    page,
  }) => {
    await openApp(page);
    const rootSize = () =>
      page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(await rootSize()).toBe(16);

    const dialog = await openPreferences(page);
    await dialog.getByRole('radio', { name: 'Grande' }).check();
    expect(await rootSize()).toBe(20);
    expect(await stored(page, 'chrono-text-size')).toBe('large');

    await dialog.getByRole('radio', { name: 'Confortable' }).check();
    expect(await rootSize()).toBe(18);
    expect(await stored(page, 'chrono-text-size')).toBe('comfortable');

    await page.reload();
    expect(await rootSize()).toBe(18);
    const again = await openPreferences(page);
    await expect(again.getByRole('radio', { name: 'Confortable' })).toBeChecked();

    await again.getByRole('radio', { name: 'Automatique' }).check();
    expect(await stored(page, 'chrono-text-size')).toBeNull();
    expect(await rootSize()).toBe(16);
  });
});

test.describe('single-key shortcuts', () => {
  test('they are on by default and listed with their keys', async ({ page }) => {
    await openApp(page);
    const dialog = await openPreferences(page);

    const toggle = dialog.getByRole('switch', { name: 'Raccourcis à une touche' });
    await expect(toggle).toBeChecked();
    for (const key of ['Espace', 'N', 'S']) {
      await expect(dialog.locator('kbd.cv-kbd', { hasText: new RegExp(`^${key}$`) })).toBeVisible();
    }
    // A preference that was never touched stores nothing.
    expect(await stored(page, 'chrono-single-key-shortcuts')).toBeNull();

    await page.keyboard.press('Escape');
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Ajouter un chrono' })).toBeVisible();
  });

  test('turning them off makes N do nothing, turning them on brings it back', async ({ page }) => {
    const { errors } = await openApp(page);
    const dialog = await openPreferences(page);
    await dialog.getByRole('switch', { name: 'Raccourcis à une touche' }).uncheck();
    expect(await stored(page, 'chrono-single-key-shortcuts')).toBe('0');
    await dialog.locator('footer').getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // It is still off after a reload.
    await page.reload();
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const again = await openPreferences(page);
    await expect(again.getByRole('switch', { name: 'Raccourcis à une touche' })).not.toBeChecked();
    await again.getByRole('switch', { name: 'Raccourcis à une touche' }).check();
    expect(await stored(page, 'chrono-single-key-shortcuts')).toBe('1');
    await page.keyboard.press('Escape');
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Ajouter un chrono' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('N never opens the quick add from a text field, a select, a dialog or with a modifier', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Todos' }).click();
    const main = page.getByRole('main');

    const field = main.getByRole('textbox', { name: 'Nouvelle tâche' });
    await field.focus();
    await page.keyboard.type('nsn ');
    await expect(field).toHaveValue('nsn ');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await main.getByLabel('Projet', { exact: true }).focus();
    await page.keyboard.press('n');
    await page.keyboard.press('s');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // With a modifier: the key belongs to the browser.
    await main.click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+n');
    await page.keyboard.press('Alt+n');
    await page.keyboard.press('Shift+n');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Behind a dialog: the preferences are open, so N and Space do nothing.
    await openPreferences(page);
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: 'Ajouter un chrono' })).toHaveCount(0);
  });

  test('inside the quick add the typed letters stay in the field', async ({ page }) => {
    await openApp(page);
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
    const dialog = page.getByRole('dialog', { name: 'Ajouter un chrono' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' }).focus();
    await page.keyboard.type('n s');
    await expect(dialog.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' })).toHaveValue(
      'n s',
    );
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });
});

test.describe('totals of the project cards', () => {
  const OLD_KEY = 'chrono.prefs.projetsTotaux';
  const NEW_KEY = 'chrono-show-project-totals';

  /** @param {Page} page @param {Record<string, string>} values */
  async function seed(page, values) {
    await page.goto('/assets/favicon.svg');
    await page.evaluate((entries) => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, values);
  }

  test('the version 1 value is copied once to the new key, and the old key is kept', async ({
    page,
  }) => {
    await seed(page, { [OLD_KEY]: '1' });
    const { errors } = await openApp(page);

    expect(await stored(page, NEW_KEY)).toBe('1');
    expect(await stored(page, OLD_KEY)).toBe('1');
    await page.getByRole('button', { name: 'Projets' }).click();
    await expect(page.getByRole('switch', { name: 'Afficher les totaux' })).toBeChecked();

    // From now on the new key is the one that is written.
    await page.getByRole('switch', { name: 'Afficher les totaux' }).uncheck();
    expect(await stored(page, NEW_KEY)).toBe('0');
    expect(await stored(page, OLD_KEY)).toBe('1');
    await page.reload();
    await page.getByRole('button', { name: 'Projets' }).click();
    await expect(page.getByRole('switch', { name: 'Afficher les totaux' })).not.toBeChecked();
    expect(errors).toEqual([]);
  });

  test('an existing new value is never overwritten by the old one', async ({ page }) => {
    await seed(page, { [OLD_KEY]: '1', [NEW_KEY]: '0' });
    await openApp(page);

    expect(await stored(page, NEW_KEY)).toBe('0');
    expect(await stored(page, OLD_KEY)).toBe('1');
    await page.getByRole('button', { name: 'Projets' }).click();
    await expect(page.getByRole('switch', { name: 'Afficher les totaux' })).not.toBeChecked();
  });

  test('without an old value nothing is stored', async ({ page }) => {
    await openApp(page);

    expect(await stored(page, NEW_KEY)).toBeNull();
    expect(await stored(page, OLD_KEY)).toBeNull();
  });
});
