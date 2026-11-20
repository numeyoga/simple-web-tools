// English and French interface (lot A of step 4): the language follows the browser, can be
// chosen in the preferences, and every view reads in English. The other suites run in French
// (playwright.config.js sets the browser locale to fr-FR).
import AxeBuilder from '@axe-core/playwright';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { goToSection, openApp } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

/** @param {Page} page */
async function openPreferences(page) {
  await page.getByRole('button', { name: /^(Preferences|Préférences)$/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('browser in English (en-US)', () => {
  test.use({ locale: 'en-US', reducedMotion: 'reduce' });

  test('the four views, the quick add and the preferences read in English', async ({ page }) => {
    const { errors } = await openApp(page, { demo: true, clock: true });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page).toHaveTitle('Chrono · time tracking');

    // Timeline
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(main.getByText('Wednesday, November 18')).toBeVisible();
    // The hour axis follows the clock of the language: 12 hours in en-US.
    await expect(main.getByText('1:00 PM', { exact: true })).toBeVisible();
    // Times of day follow the same convention: no leading zero on a 12-hour clock (session rows,
    // attendance, the label of the current time), as on the axis.
    await expect(main.getByText('9:05 AM → 10:30 AM', { exact: true })).toBeVisible();
    await expect(main.getByText('10:00 AM', { exact: true }).first()).toBeVisible();
    await expect(main.getByText(/(^|\D)0\d:\d\d (AM|PM)/)).toHaveCount(0);
    await expect(main.getByRole('heading', { name: 'Sessions of the day' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Attendance of the day' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Breakdown by project' })).toBeVisible();
    await expect(main.getByText('Time worked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();
    await expect(main.getByText('Website redesign — Orion SAS').first()).toBeVisible();
    await expect(main.getByText('2 timers in parallel')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();

    // To-dos
    await goToSection(page, 'To-dos');
    await expect(main.getByRole('heading', { level: 2, name: 'Overdue' })).toBeVisible();
    await expect(main.getByText(/^\d+ in progress · \d+ done$/)).toBeVisible();
    await expect(main.getByLabel('New task')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Add' })).toBeVisible();

    // Projects
    await goToSection(page, 'Projects');
    await expect(main.getByText('5 active · 1 archived')).toBeVisible();
    await expect(main.getByRole('button', { name: 'New project' })).toBeVisible();
    await expect(main.getByText('Show totals')).toBeVisible();

    // Report
    await goToSection(page, 'Report');
    await expect(main.getByRole('heading', { name: 'This week' })).toBeVisible();
    await expect(main.getByText('Nov 16 → Nov 22')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(main.getByText('Week total')).toBeVisible();
    await expect(main.getByRole('table', { name: 'By project' })).toBeVisible();
    await expect(main.getByRole('columnheader', { name: 'Share' })).toBeVisible();

    // Quick add, both modes
    await goToSection(page, 'Timeline');
    await page.getByRole('button', { name: 'Start another timer' }).click();
    const quickAdd = page.getByRole('dialog', { name: 'Add a timer' });
    await expect(quickAdd.getByRole('radio', { name: 'Start now' })).toBeChecked();
    await expect(quickAdd.getByLabel('What did you work on?')).toBeVisible();
    await expect(quickAdd.getByText('The timer starts now.')).toBeVisible();
    await expect(quickAdd.getByText('to start')).toBeVisible();
    await quickAdd.getByRole('radio', { name: 'Enter manually' }).check();
    await expect(quickAdd.getByText('to save')).toBeVisible();
    await expect(quickAdd.getByLabel('Start', { exact: true })).toBeVisible();
    await expect(quickAdd.getByRole('button', { name: 'Save' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Preferences
    const prefs = await openPreferences(page);
    await expect(prefs.getByLabel('Language / Langue')).toHaveValue('auto');
    await expect(prefs.getByRole('radio', { name: 'Comfortable' })).toBeAttached();
    await expect(prefs.getByRole('switch', { name: 'Single-key shortcuts' })).toBeChecked();
    await expect(prefs.getByText('Start, pause or resume')).toBeVisible();
    await expect(prefs.getByRole('radio', { name: 'Dark' })).toBeAttached();
    expect(errors).toEqual([]);
  });

  test('the toasts and their notification region are named in English', async ({ page }) => {
    await openApp(page, { demo: true, clock: true });
    await page.keyboard.press('s');
    await expect(page.getByText('Timers stopped')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss notification' })).toBeVisible();
  });

  test('the CSV export is English: comma, decimal point, English headers', async ({ page }) => {
    await openApp(page, { demo: true, clock: true });
    await goToSection(page, 'Report');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('report-2026-11-16.csv');
    const path = await file.path();
    const text = (await (await import('node:fs/promises')).readFile(path, 'utf8')) ?? '';
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.split('\r\n')[0]).toBe(
      '﻿"Date","Project","Client","Description","Start","End","Duration (h)"',
    );
    expect(text).toMatch(/"\d+\.\d\d"\r?\n?/);
  });

  for (const theme of ['light', 'dark']) {
    test(`axe, WCAG 2.2 AA: English interface, ${theme}, 1280 px`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.addInitScript((value) => localStorage.setItem('chrono-theme', value), theme);
      await openApp(page, { demo: true, clock: true });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const section of ['Timeline', 'To-dos', 'Projects', 'Report']) {
        await goToSection(page, section);
        await expect(page.getByRole('heading', { level: 1, name: section })).toBeVisible();
        await expectNoA11yViolations(page);
      }
      await goToSection(page, 'Timeline');
      await page.getByRole('button', { name: 'Start another timer' }).click();
      await expect(page.getByRole('dialog', { name: 'Add a timer' })).toBeVisible();
      await expectNoA11yViolations(page);
      await page.keyboard.press('Escape');
      await openPreferences(page);
      await expectNoA11yViolations(page);
      expect(await new AxeBuilder({ page }).include('html').analyze()).toBeTruthy();
    });
  }
});

test.describe('browser in British English (en-GB)', () => {
  test.use({ locale: 'en-GB' });

  test('English text, British dates, and <html lang> keeps the region', async ({ page }) => {
    await openApp(page, { clock: true });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expect(page.getByRole('button', { name: 'Preferences' })).toBeVisible();
    // Wednesday 18 November 2026: day before month, 24-hour clock.
    await expect(page.getByRole('main').getByText('Wednesday 18 November')).toBeVisible();
    // The hour axis follows the clock of the region: 24 hours here.
    await expect(page.getByRole('main').getByText('13:00', { exact: true })).toBeVisible();
    await goToSection(page, 'Report');
    await expect(page.getByRole('main').getByText('16 Nov → 22 Nov')).toBeVisible();
  });
});

test.describe('which language the browser gets', () => {
  test.describe('fr-CA', () => {
    test.use({ locale: 'fr-CA' });
    test('is French', async ({ page }) => {
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
      await expect(page.getByRole('button', { name: 'Préférences' })).toBeVisible();
    });
  });

  test.describe('de-DE', () => {
    test.use({ locale: 'de-DE' });
    test('is English, the fallback', async ({ page }) => {
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('button', { name: 'Preferences' })).toBeVisible();
    });
  });
});

test.describe('choosing the language in the preferences', () => {
  test.use({ locale: 'en-US' });

  test('French is saved as chrono-locale, survives a reload, and automatic removes it', async ({
    page,
  }) => {
    await openApp(page);
    const stored = () => page.evaluate(() => localStorage.getItem('chrono-locale'));
    expect(await stored()).toBeNull();

    const prefs = await openPreferences(page);
    await prefs.getByLabel('Language / Langue').selectOption('fr');
    await expect(page.getByRole('button', { name: 'Préférences' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    expect(await stored()).toBe('fr');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('button', { name: 'Préférences' })).toBeVisible();
    const again = await openPreferences(page);
    await expect(again.getByLabel('Langue / Language')).toHaveValue('fr');

    await again.getByLabel('Langue / Language').selectOption('auto');
    await expect(page.getByRole('button', { name: 'Preferences' })).toBeVisible();
    expect(await stored()).toBeNull();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('a saved choice wins over the browser language', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chrono-locale', 'fr'));
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('button', { name: 'Préférences' })).toBeVisible();
  });

  test('an unknown saved value is ignored', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chrono-locale', 'de'));
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});
