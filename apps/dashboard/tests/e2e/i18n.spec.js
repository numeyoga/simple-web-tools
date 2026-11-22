// The interface follows the language of the browser, English and French; every text comes from the
// catalog (the unit tests check the catalogs, this checks what a person reads).
import { expect, test } from '@playwright/test';
import { createApp, loadSample, openApp } from './support.js';

test.describe('English browser', () => {
  test.use({ locale: 'en-GB' });

  test('the shell, the dialogs and the messages are in English', async ({ page }) => {
    await openApp(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Applications');
    await expect(page.getByText('No application yet', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

    await page.getByRole('button', { name: 'Load the sample' }).click();
    await expect(page.getByText('Sample loaded')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
    await expect(page.getByText('Customer account space, Account team.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Links of the environment PROD' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'New application' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New application' });
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Account');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByText('The slug “account” is already used')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Account');
  });

  test('the administration screens are in English', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Load the sample' }).click();
    await expect(page.getByText('Sample loaded')).toBeVisible();

    await page.getByRole('link', { name: 'Metadata fields', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Metadata fields');
    await expect(page.getByText('How it works')).toBeVisible();
    await page.getByRole('link', { name: 'Import and export', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Download the JSON file' })).toBeVisible();
  });
});

test.describe('French browser', () => {
  test.use({ locale: 'fr-FR' });

  test('the counts follow the language', async ({ page }) => {
    await openApp(page);
    await loadSample(page);

    await expect(page.getByText('9 liens', { exact: true }).last()).toBeVisible();
    await createApp(page, { name: 'Vide', template: 'batch-java' });
    await expect(page.getByRole('tab', { name: /^DEV/ })).toContainText('1 lien à compléter');
  });
});
