// Accessibility of every screen: axe with the WCAG 2.0 A/AA, 2.1 AA and 2.2 AA rules on the home
// screen (empty and with an error), the presentation (every kind of slide, in a dark and a light
// presentation), the overview, the preferences and the presenter window, in the light and the dark
// theme of the app, at 1280 and 390 px. Dialogs are analysed once they have settled.
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { chooseFolder, expectSlide, loadExample, openApp } from './support.js';

const THEMES = ['light', 'dark'];
const VIEWPORTS = /** @type {const} */ ([
  [1280, 800],
  [390, 844],
]);

/** Waits for the dialogs to stop moving. @param {import('@playwright/test').Page} page */
const settled = (page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

for (const theme of THEMES) {
  for (const [width, height] of VIEWPORTS) {
    test.describe(`axe, WCAG 2.2 AA: ${theme}, ${width} px`, () => {
      test.use({ reducedMotion: 'reduce', viewport: { width, height } });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('slides-theme', value), theme);
        await openApp(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      });

      test('the home screen: empty, with an error, with the menu drawer open', async ({ page }) => {
        await expectNoA11yViolations(page);

        await chooseFolder(page, 'no-main');
        await expect(page.getByRole('alert')).toBeVisible();
        await expectNoA11yViolations(page);

        if (width < 1024) {
          await page.getByRole('button', { name: 'Menu' }).click();
          await expect(
            page.getByRole('navigation', { name: 'Navigation principale' }),
          ).toBeVisible();
          await settled(page);
          await expectNoA11yViolations(page);
        }
      });

      test('the presentation: a title slide, an image, code, a table and a diagram (dark slides)', async ({
        page,
      }) => {
        await loadExample(page);
        for (const slideNumber of [1, 2, 3, 4, 5, 6]) {
          await page.keyboard.press(String(slideNumber));
          await page.keyboard.press('Enter');
          await expectSlide(page, slideNumber);
          if (slideNumber === 2) {
            await expect(page.getByTestId('slide').getByRole('img')).toBeVisible();
          }
          if (slideNumber === 4) {
            await expect(page.locator('pre.mermaid[data-drawn]')).toBeVisible();
          }
          await expectNoA11yViolations(page);
        }
      });

      test('a light presentation, and the placeholders of the images that are not shown', async ({
        page,
      }) => {
        await chooseFolder(page, 'sanitizer');
        await expectSlide(page, 1);
        await expect(page.locator('.sl-blocked').first()).toBeVisible();
        await expectNoA11yViolations(page);
        await page.keyboard.press('r');
        await expectNoA11yViolations(page);
      });

      test('the overview and the preferences', async ({ page }) => {
        await loadExample(page);

        await page.keyboard.press('o');
        await expect(page.getByRole('dialog', { name: 'Vue d’ensemble' })).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Préférences' }).click();
        await expect(page.getByRole('dialog', { name: 'Préférences' })).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page);
      });

      test('the presenter window: waiting, then with the presentation', async ({
        context,
        page,
      }) => {
        const presenter = await context.newPage();
        await presenter.setViewportSize({ width, height });
        await presenter.goto('/?view=presenter');
        await expect(presenter.getByTestId('waiting')).toBeVisible();
        await expectNoA11yViolations(presenter);

        await loadExample(page);
        await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');
        await expectNoA11yViolations(presenter);

        await page.keyboard.press('4');
        await page.keyboard.press('Enter');
        await expect(presenter.locator('pre.mermaid[data-drawn]')).toBeVisible();
        await expectNoA11yViolations(presenter);
      });
    });
  }
}
