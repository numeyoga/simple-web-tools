// Helpers for the shell of the app: the preferences (gear in the top bar), the theme control
// they hold and the backup entry of the sidebar.
import { expect } from '@playwright/test';

/**
 * Opens the preferences with the gear of the top bar.
 * @param {import('@playwright/test').Page} page
 */
export async function openPreferences(page) {
  await page.locator('#topbar-preferences-btn').click();
  await expect(page.locator('#modal-preferences')).toBeVisible();
}

/**
 * Chooses a theme in the preferences, then closes them.
 * @param {import('@playwright/test').Page} page
 * @param {'system' | 'light' | 'dark'} theme
 */
export async function setTheme(page, theme) {
  await openPreferences(page);
  const modal = page.locator('#modal-preferences');
  await modal.locator(`input[name="theme"][value="${theme}"]`).check();
  await modal.locator('[data-cv-close]').first().click();
  await expect(modal).toBeHidden();
}

/**
 * Opens the backup dialog from the "Data" group of the sidebar. Below 1024 px the sidebar is a
 * drawer: it is opened with the menu button first.
 * @param {import('@playwright/test').Page} page
 */
export async function openBackup(page) {
  const menu = page.locator('.cv-shell__menu');
  if (await menu.isVisible()) await menu.click();
  await page.locator('#nav-backup-btn').click();
  await expect(page.locator('#modal-backup')).toBeVisible();
}
