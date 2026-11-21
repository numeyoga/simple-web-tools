// English and French interface: the language follows the browser, can be chosen in the
// preferences, and every text of the shell reads in the language of the page. The other suites
// run in French (playwright.config.js sets the browser locale to fr-FR).
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { createNote, openApp, treeRowName } from './support.js';

test.describe('browser in English (en-US)', () => {
  test.use({ locale: 'en-US', reducedMotion: 'reduce' });

  test('the shell, the dialogs and the notes read in English', async ({ page }) => {
    const { errors } = await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page).toHaveTitle('Transient Notes · notes sorted with PARA');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['All notes', 'Projects', 'Areas', 'Resources', 'Archives']) {
      await expect(nav.getByRole('button', { name: treeRowName(name) })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Workspace Main workspace' })).toBeVisible();
    await expect(page.getByText('No notes here yet')).toBeVisible();

    await createNote(page);
    await expect(page.getByRole('main').getByRole('button', { name: 'Untitled' })).toBeVisible();
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('3');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('General resources');

    await page.getByRole('button', { name: 'Preferences' }).click();
    const prefs = page.getByRole('dialog', { name: 'Preferences' });
    await expect(prefs.getByText('Single-key shortcuts')).toBeVisible();
    await expect(
      prefs.getByText('New note in Projects, Areas, Resources or Archives'),
    ).toBeVisible();
    await expectNoA11yViolations(page, { include: ['dialog[open]'] });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Workspace/ }).click();
    const workspaces = page.getByRole('dialog', { name: 'Workspaces' });
    await expect(workspaces.getByText('Active', { exact: true })).toBeVisible();
    await expect(workspaces.getByRole('button', { name: 'Export JSON' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the language of the preferences can be switched to French, and back to automatic', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Preferences' }).click();

    await page.getByRole('dialog').getByLabel('Language / Langue').selectOption('fr');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toutes les notes');
    await page.getByRole('button', { name: 'Préférences' }).click();
    await page.getByRole('dialog').getByLabel('Langue / Language').selectOption('auto');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All notes');
    expect(await page.evaluate(() => localStorage.getItem('transient-notes-locale'))).toBeNull();
  });
});

test.describe('browser in a language the app does not speak', () => {
  test.use({ locale: 'de-DE' });

  test('falls back to English', async ({ page }) => {
    await openApp(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All notes');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('browser in French with a region (fr-CA)', () => {
  test.use({ locale: 'fr-CA' });

  test('reads in French and keeps the region for the dates', async ({ page }) => {
    await openApp(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toutes les notes');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
  });
});
