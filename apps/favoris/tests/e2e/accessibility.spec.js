// Accessibility of every screen: axe with the WCAG 2.0 A/AA, 2.1 AA and 2.2 AA rules on the board
// (empty, full, searched, in edit mode), every dialog, the menus, the read-only banner and the
// error screen, in the light and the dark theme, at 1280 and 390 px. Dialogs are analysed once
// they have settled (motion is reduced, so they are in place when they open).
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { addGroup, addLink, dialogNamed, openApp, openWorkspaces, setEditMode } from './support.js';

const THEMES = ['light', 'dark'];
const VIEWPORTS = /** @type {const} */ ([
  [1280, 800],
  [390, 844],
]);

/** Waits for the menus and the dialogs to stop moving. @param {import('@playwright/test').Page} page */
const settled = (page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

/**
 * A board with colours, a featured group, a folded one, links with and without a group.
 * @param {import('@playwright/test').Page} page
 */
async function fillBoard(page) {
  await addGroup(page, 'Documentation');
  await addGroup(page, 'Lectures');
  await addGroup(page, 'Repliée');
  await addLink(page, {
    name: 'MDN Web Docs',
    url: 'developer.mozilla.org',
    group: 'Documentation',
  });
  await addLink(page, { name: 'Hacker News', url: 'news.ycombinator.com', group: 'Lectures' });
  await addLink(page, { name: 'Dans la repliée', url: 'plie.example', group: 'Repliée' });
  await addLink(page, { name: 'Sans groupe', url: 'example.org', group: 'Sans groupe' });
  await page.getByRole('button', { name: 'Mettre « Lectures » en avant' }).click();
  await page.getByRole('button', { name: /^Repliée$/ }).click();
  // The toasts of the steps above would cover the board on a narrow screen.
  const dismiss = page.getByRole('button', { name: 'Fermer la notification' });
  while ((await dismiss.count()) > 0)
    await dismiss
      .first()
      .click({ timeout: 2000 })
      .catch(() => {});
}

for (const theme of THEMES) {
  for (const [width, height] of VIEWPORTS) {
    test.describe(`axe, WCAG 2.2 AA: ${theme}, ${width} px`, () => {
      test.use({ reducedMotion: 'reduce', viewport: { width, height } });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('favoris-theme', value), theme);
        await openApp(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      });

      test('the board: empty, full, searched and without a match', async ({ page }) => {
        await expectNoA11yViolations(page);

        await fillBoard(page);
        await expectNoA11yViolations(page);

        const search = page.getByRole('searchbox', { name: 'Rechercher dans les liens' });
        await search.fill('hacker');
        await expectNoA11yViolations(page);
        await search.fill('zzzzz');
        await expect(page.getByText('Aucun résultat', { exact: true }).first()).toBeVisible();
        await expectNoA11yViolations(page);
      });

      test('the board in edit mode, and its menus', async ({ page }) => {
        await fillBoard(page);
        await setEditMode(page, true);
        await expectNoA11yViolations(page);

        await page.getByRole('button', { name: 'Déplacer « MDN Web Docs »' }).click();
        await expect(page.getByRole('menu', { name: 'Déplacer « MDN Web Docs »' })).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Actions du groupe « Documentation »' }).click();
        await expect(
          page.getByRole('menu', { name: 'Actions du groupe « Documentation »' }),
        ).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Plus d’actions' }).click();
        await expect(page.getByRole('menu', { name: 'Données et groupes' })).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page);
      });

      test('the link dialogs: new, with errors, with a new group, edit, move and delete', async ({
        page,
      }) => {
        await fillBoard(page);
        await page.getByRole('button', { name: 'Nouveau lien' }).first().click();
        const dialog = await dialogNamed(page, 'Nouveau lien');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });

        // The error state of the address, then the fields of a new group with the colour picker.
        await dialog.getByLabel('Adresse').fill('javascript:alert(1)');
        await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
        await expect(dialog.getByText(/Seules les adresses http et https/)).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await dialog
          .getByLabel('Groupe', { exact: true })
          .selectOption({ label: 'Nouveau groupe…' });
        await dialog.getByRole('radio', { name: 'Jaune' }).check();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Modifier « MDN Web Docs »' }).click();
        await dialogNamed(page, 'Modifier le lien');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await setEditMode(page, true);
        await page.getByRole('button', { name: 'Déplacer « MDN Web Docs »' }).click();
        await page.getByRole('menuitem', { name: 'Déplacer vers un groupe…' }).click();
        await dialogNamed(page, 'Déplacer « MDN Web Docs »');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Supprimer « MDN Web Docs »' }).click();
        await dialogNamed(page, 'Supprimer ce lien ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the group dialogs: new (with its error), edit and delete', async ({ page }) => {
        await fillBoard(page);
        await page.getByRole('button', { name: 'Plus d’actions' }).click();
        await page.getByRole('menuitem', { name: 'Nouveau groupe' }).click();
        const dialog = await dialogNamed(page, 'Nouveau groupe');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
        await expect(dialog.getByText('Le nom est vide')).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await setEditMode(page, true);
        await page.getByRole('button', { name: 'Actions du groupe « Documentation »' }).click();
        await page.getByRole('menuitem', { name: 'Modifier le groupe' }).click();
        await dialogNamed(page, 'Modifier le groupe');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');
        // The focus came back to a button whose tooltip is open: it would cover the next target.
        await page.evaluate(() => window.Covenant?.hideTooltips?.());

        await page.getByRole('button', { name: 'Actions du groupe « Documentation »' }).click();
        await page.getByRole('menuitem', { name: 'Supprimer' }).click();
        await dialogNamed(page, 'Supprimer ce groupe ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the import and clear-all questions', async ({ page }) => {
        await fillBoard(page);
        await page.locator('input[type="file"]').setInputFiles({
          name: 'favoris.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify({ tags: [], links: [] })),
        });
        await dialogNamed(page, 'Remplacer les favoris ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Plus d’actions' }).click();
        await page.getByRole('menuitem', { name: 'Tout effacer' }).click();
        await dialogNamed(page, 'Effacer cet espace de travail ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the toasts and a tooltip', async ({ page }) => {
        await addLink(page, { name: 'Site', url: 'site.example' });
        await expect(page.getByText('Lien ajouté')).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page);

        await page.getByRole('button', { name: 'Préférences' }).hover();
        await expect(page.getByRole('tooltip', { name: 'Préférences' })).toBeVisible();
        await expectNoA11yViolations(page);
      });

      test('the drawer of the narrow layout', async ({ page }) => {
        test.skip(width >= 1024, 'the sidebar is not a drawer from 1024 px');
        await fillBoard(page);
        await page.getByRole('button', { name: 'Menu' }).click();
        await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
        // axe must not look while the drawer is still moving in.
        await settled(page);
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
        await dialog.getByLabel('Nom du nouvel espace de travail').fill('Perso');
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
        await reader.addInitScript((value) => localStorage.setItem('favoris-theme', value), theme);
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
        localStorage.setItem('favoris-theme', value);
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
