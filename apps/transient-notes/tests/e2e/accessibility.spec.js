// Accessibility of every screen: axe with the WCAG 2.0 A/AA, 2.1 AA and 2.2 AA rules on the
// selections of the shell, the preferences and the workspaces dialogs (with and without a
// question inside), the read-only banner and the error screen, in the light and the dark theme,
// at 1280 and 390 px. Dialogs are analysed once they have settled (motion is reduced, so they are
// in place when they open).
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { createNote, goToSelection, openApp, openWorkspaces } from './support.js';

const THEMES = ['light', 'dark'];
const VIEWPORTS = /** @type {const} */ ([
  [1280, 800],
  [390, 844],
]);

for (const theme of THEMES) {
  for (const [width, height] of VIEWPORTS) {
    test.describe(`axe, WCAG 2.2 AA: ${theme}, ${width} px`, () => {
      test.use({ reducedMotion: 'reduce', viewport: { width, height } });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript(
          (value) => localStorage.setItem('transient-notes-theme', value),
          theme,
        );
        await openApp(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      });

      test('the selections, empty and with notes', async ({ page }) => {
        await expectNoA11yViolations(page);
        await createNote(page);
        await createNote(page);
        await expect(
          page.getByRole('main').getByRole('button', { name: 'Sans titre' }),
        ).toHaveCount(2);
        await expectNoA11yViolations(page);

        for (const name of ['Projets', 'Domaines', 'Ressources', 'Archives']) {
          await goToSelection(page, name);
          await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
          await expectNoA11yViolations(page);
        }
      });

      test('the drawer of the narrow layout', async ({ page }) => {
        test.skip(width >= 1024, 'the sidebar is not a drawer from 1024 px');
        await page.getByRole('button', { name: 'Menu' }).click();
        await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
        // axe must not look while the drawer is still moving in.
        await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
        await expect(page.getByRole('button', { name: /^Espace de travail/ })).toBeInViewport({
          ratio: 1,
        });
        await expectNoA11yViolations(page);
      });

      test('the preferences and the workspaces dialogs', async ({ page }) => {
        await page.getByRole('button', { name: 'Préférences' }).click();
        await expect(page.getByRole('dialog', { name: 'Préférences' })).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);

        const dialog = await openWorkspaces(page);
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });

        // A second workspace: the list with an active and an inactive row, then the question.
        await dialog.getByLabel('Nom du nouvel espace').fill('Perso');
        await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Basculer sur cet espace ?' })).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.getByRole('button', { name: 'Annuler' }).click();
        await expect(dialog.getByText('perso', { exact: true })).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await dialog.getByRole('button', { name: 'Renommer' }).last().click();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the read-only banner', async ({ context }) => {
        // A second tab of the same context: the first one is the writer.
        const reader = await context.newPage();
        await reader.addInitScript(
          (value) => localStorage.setItem('transient-notes-theme', value),
          theme,
        );
        await reader.setViewportSize({ width, height });
        await openApp(reader);
        await expect(reader.getByTestId('read-only-banner')).toBeVisible();
        await expectNoA11yViolations(reader);
      });
    });
  }
}

test.describe('the storage error screen', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const theme of THEMES) {
    test(`axe, ${theme}`, async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('transient-notes-theme', value);
        indexedDB.open = () => {
          throw new DOMException('denied', 'SecurityError');
        };
      }, theme);
      await page.goto('/');
      await expect(page.getByTestId('storage-error')).toBeVisible();

      await expectNoA11yViolations(page);
    });
  }
});
