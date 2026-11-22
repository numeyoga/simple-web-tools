// The interface follows the language of the browser, English and French; every text comes from the
// catalog (the unit tests check the catalogs, this checks what a person reads). The example is
// the one of the interface language.
import { expect, test } from '@playwright/test';
import { chooseFolder, expectSlide, openApp, slide } from './support.js';

test.describe('English browser', () => {
  test.use({ locale: 'en-GB' });

  test('the home screen, the presentation, the overview and the presenter window are in English', async ({
    context,
    page,
  }) => {
    await openApp(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open a presentation');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose a folder' })).toBeVisible();

    await page.getByRole('button', { name: 'Load the example' }).click();
    await expectSlide(page, 1);
    await expect(page).toHaveTitle('Workshop - Hexagonal architecture in Java · Slides');
    await expect(slide(page).getByRole('heading', { level: 1 })).toHaveText(
      'Hexagonal architecture',
    );
    await expect(page.getByRole('button', { name: 'Next slide' })).toBeVisible();

    await page.getByRole('button', { name: 'Overview' }).click();
    const overview = page.getByRole('dialog', { name: 'Overview' });
    await expect(overview.getByRole('button', { name: /^2/ })).toContainText('The layers');
    await page.keyboard.press('Escape');

    const presenter = await context.newPage();
    await presenter.goto('/?view=presenter');
    await expect(presenter.locator('h1.sl-presenter__heading')).toHaveText('Presenter view');
    await expect(presenter.getByTestId('notes-presenter')).toContainText('Opening slide.');
    await expect(presenter.getByRole('region', { name: 'Next slide' })).toContainText('The layers');
    await expect(presenter.getByRole('button', { name: 'Start the timer' })).toBeVisible();
  });

  test('the placeholder of a blocked image and the errors are in English', async ({ page }) => {
    await openApp(page);
    await chooseFolder(page, 'no-main');
    await expect(page.getByRole('alert')).toContainText('This folder has no presentation');

    await chooseFolder(page, 'sanitizer');
    await expectSlide(page, 1);
    await expect(slide(page).locator('.sl-blocked[data-reason="remote"]')).toContainText(
      'Image from the web not loaded',
    );
    await expect(slide(page).locator('.sl-blocked[data-reason="missing"]').first()).toContainText(
      'Image not found in the folder',
    );
  });
});

test.describe('French browser', () => {
  test.use({ locale: 'fr-FR' });

  test('the example is the French one, its diagram too', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Charger l’exemple' }).click();
    await expect(slide(page).getByRole('heading', { level: 1 })).toHaveText(
      'Architecture hexagonale',
    );
    await page.keyboard.press('4');
    await page.keyboard.press('Enter');
    await expect(slide(page).locator('pre.mermaid[data-drawn]')).toContainText('Adaptateur JPA');
  });
});

test.describe('another language of the browser', () => {
  test.use({ locale: 'de-DE' });

  test('falls back to English', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open a presentation');
    await page.getByRole('button', { name: 'Load the example' }).click();
    await expect(page.getByTestId('counter')).toHaveText('1 / 6');
  });
});
