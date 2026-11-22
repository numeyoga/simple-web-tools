// The interface follows the language of the browser, English and French; every text comes from the
// catalog (the unit tests check the catalogs, this checks what a person reads).
import { expect, test } from '@playwright/test';
import { addGroup, addLink, openApp } from './support.js';

test.describe('English browser', () => {
  test.use({ locale: 'en-GB' });

  test('the shell, the dialogs and the messages are in English', async ({ page }) => {
    await openApp(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('My bookmarks');
    await expect(page.getByText('No bookmarks yet')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

    await page.getByRole('button', { name: 'New link' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New link' });
    await dialog.getByLabel('Address').fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog.getByText('Only http and https addresses are accepted.')).toBeVisible();
    await dialog.getByLabel('Address').fill('example.org');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Link added')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /^1 link$/ })).toBeVisible();
  });
});

test.describe('French browser', () => {
  test.use({ locale: 'fr-FR' });

  test('the colours are named in French, and the counts follow the language', async ({ page }) => {
    await openApp(page);
    await addGroup(page, 'Un');
    await addLink(page, { url: 'un.example', group: 'Un' });
    await addLink(page, { url: 'deux.example', group: 'Un' });

    await expect(page.getByRole('status').filter({ hasText: /^2 liens$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Plus d’actions' }).click();
    await page.getByRole('menuitem', { name: 'Nouveau groupe' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouveau groupe' });
    await expect(dialog.getByRole('radio', { name: 'Citron vert' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Ardoise' })).toBeVisible();
  });
});
