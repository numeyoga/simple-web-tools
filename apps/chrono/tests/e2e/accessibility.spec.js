// Accessibility of every screen (step 3, lot C): axe with the WCAG 2.0 A/AA, 2.1 AA and 2.2 AA
// rules on the four views, the quick add (both modes), the project editor, the preferences and
// the workspaces dialogs, in the light and the dark theme, at 1280 and 390 px, with the demo
// data loaded and the Timeline scrolled so that the session blocks are in view. Dialogs are
// analysed once they have settled (motion is reduced, so they are in place when they open).
import AxeBuilder from '@axe-core/playwright';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { enterSession, goToSection, openApp } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

const THEMES = ['light', 'dark'];
const VIEWPORTS = /** @type {const} */ ([
  [1280, 800],
  [390, 844],
]);

/**
 * Scrolls the day chart of the Timeline so that the session blocks are in its visible part: axe
 * does not measure what a scrollable region clips.
 * @param {Page} page
 */
async function showSessionBlocks(page) {
  // The Timeline draws itself again every second (and remembers the scroll of its chart), so the
  // chart is looked up again at each try instead of being held.
  await expect(async () => {
    const inView = await page.evaluate(() => {
      const chart = document.querySelector('[data-role="timeline-scroll"]');
      if (!chart) return false;
      chart.scrollIntoView({ block: 'center' });
      // 84 px per hour from 07:00: the demo sessions run from 09:00 to 13:00.
      chart.scrollLeft = 2 * 84;
      const box = chart.getBoundingClientRect();
      return [...chart.querySelectorAll('.ch-session-block')].some((block) => {
        const rect = block.getBoundingClientRect();
        return (
          rect.right > box.left &&
          rect.left < box.right &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight
        );
      });
    });
    expect(inView).toBe(true);
  }).toPass();
}

for (const theme of THEMES) {
  for (const [width, height] of VIEWPORTS) {
    test.describe(`axe, WCAG 2.2 AA: ${theme}, ${width} px`, () => {
      test.use({ reducedMotion: 'reduce', viewport: { width, height } });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('chrono-theme', value), theme);
        await openApp(page, { demo: true, clock: true });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      });

      test('the four views', async ({ page }) => {
        await showSessionBlocks(page);
        await expectNoA11yViolations(page);
        // The blocks are really measured, not skipped: their white labels pass at 4.5:1.
        const blocks = await new AxeBuilder({ page })
          .include('.ch-session-block')
          .withRules(['color-contrast'])
          .analyze();
        expect(blocks.violations).toEqual([]);
        expect(blocks.incomplete).toEqual([]);
        expect(
          blocks.passes.find((rule) => rule.id === 'color-contrast')?.nodes.length,
        ).toBeGreaterThanOrEqual(4);

        for (const view of ['Todos', 'Projets', 'Rapport']) {
          await goToSection(page, view);
          await expect(page.getByRole('heading', { level: 1, name: view })).toBeVisible();
          await expectNoA11yViolations(page);
        }
        await goToSection(page, 'Timeline');
        await showSessionBlocks(page);
        await expectNoA11yViolations(page);
      });

      test('the quick add, running timer and manual entry', async ({ page }) => {
        await page.getByRole('main').getByRole('button', { name: 'Nouvelle' }).click();
        const dialog = page.getByRole('dialog', { name: 'Ajouter un chrono' });
        await expect(dialog).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });

        await dialog.getByRole('radio', { name: 'Saisir manuellement' }).check();
        await expect(dialog.getByLabel('Début')).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the project editor, with a category and with a free colour', async ({ page }) => {
        await goToSection(page, 'Projets');
        await page.getByRole('button', { name: 'Modifier', exact: true }).first().click();
        const dialog = page.getByRole('dialog', { name: 'Modifier le projet' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('radio', { name: 'Orange' })).toBeChecked();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });

        await dialog.getByLabel('Couleur personnalisée').fill('#ffff00');
        await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the preferences and the workspaces dialogs', async ({ page }) => {
        await page.getByRole('button', { name: 'Préférences' }).click();
        await expect(page.getByRole('dialog', { name: 'Préférences' })).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);

        if (width < 1024) await page.getByRole('button', { name: 'Menu' }).click();
        await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
        await expect(page.getByRole('dialog', { name: 'Espaces de sauvegarde' })).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });
    });
  }

  test.describe(`a free project colour keeps its label readable: ${theme}`, () => {
    test.use({ reducedMotion: 'reduce' });

    test('a light colour (#ffff00) keeps white labels readable on a timeline block', async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem('chrono-theme', value), theme);
      await openApp(page, { clock: true });
      await goToSection(page, 'Projets');
      await page.getByRole('button', { name: 'Nouveau projet' }).click();
      const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
      await dialog.getByRole('textbox', { name: 'Nom du projet' }).fill('Jaune vif');
      await dialog.getByLabel('Couleur personnalisée').fill('#ffff00');
      await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await enterSession(page, { description: 'Maquette', end: '09:30' });
      await showSessionBlocks(page);

      const block = page.locator('.ch-session-block[data-cat="custom"]');
      await expect(block).toHaveCount(1);
      await expect(block).toBeInViewport();
      // The label is the white of `--cv-fg-on-cat` on the fill that Covenant.setCategory derives
      // from the colour: axe must measure 4.5:1 or more, and be able to measure it at all.
      const results = await new AxeBuilder({ page })
        .include('.ch-session-block[data-cat="custom"]')
        .withRules(['color-contrast'])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(results.incomplete).toEqual([]);
      const measured = results.passes.find((rule) => rule.id === 'color-contrast');
      const ratio = /** @type {{ contrastRatio?: number }} */ (measured?.nodes[0]?.any[0]?.data)
        ?.contrastRatio;
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      await expectNoA11yViolations(page);
    });
  });
}
