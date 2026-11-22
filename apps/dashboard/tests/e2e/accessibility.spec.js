// Accessibility of every screen: axe with the WCAG 2.0 A/AA, 2.1 AA and 2.2 AA rules on the
// application (empty, filled in, in edit mode, with links that cannot be opened, filtered), on every
// administration screen, in every dialog and menu, the command menu, the read-only banner and the
// error screen, in the light and the dark theme, at 1280 and 390 px. Dialogs are analysed once they
// have settled (motion is reduced, so they are in place when they open).
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import {
  dialogNamed,
  loadSample,
  openAdmin,
  openApp,
  openAppNamed,
  openNav,
  openWorkspaces,
  setEditMode,
} from './support.js';

const THEMES = ['light', 'dark'];
const VIEWPORTS = /** @type {const} */ ([
  [1280, 800],
  [390, 844],
]);
const WRAPPED = fileURLToPath(new URL('../fixtures/legacy-dashboard.json', import.meta.url));

/** Waits for the menus and the dialogs to stop moving. @param {import('@playwright/test').Page} page */
const settled = (page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

/** Dismisses the toasts: on a narrow screen they would cover what is analysed. @param {import('@playwright/test').Page} page */
async function clearToasts(page) {
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
        await page.addInitScript((value) => localStorage.setItem('dashboard-theme', value), theme);
        await openApp(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      });

      test('the application: empty, filled in, a value to fill in, filtered, without a match', async ({
        page,
      }) => {
        await expectNoA11yViolations(page);

        await loadSample(page);
        await clearToasts(page);
        await expectNoA11yViolations(page);

        // Links with a value still to fill in (disabled, with a reason).
        await openAppNamed(page, 'HrBackoffice');
        await page.getByRole('tab', { name: /^UAT/ }).click();
        await expectNoA11yViolations(page);

        await openNav(page);
        const filter = page.getByRole('searchbox', {
          name: 'Filtrer les applications et les liens',
        });
        await filter.fill('grafana');
        await expectNoA11yViolations(page);
        await filter.fill('zzzzz');
        await expect(page.getByText('Aucune application ne correspond au filtre.')).toBeVisible();
        await expectNoA11yViolations(page);
      });

      test('the application in edit mode, and in compact density', async ({ page }) => {
        await loadSample(page);
        await clearToasts(page);
        await setEditMode(page, true);
        await expectNoA11yViolations(page);

        await page.getByRole('button', { name: 'Préférences' }).click();
        await page.getByRole('radio', { name: 'Compacte' }).check();
        await page.keyboard.press('Escape');
        await expectNoA11yViolations(page);
      });

      test('the dialogs of an application: new, with errors, extra link, address, delete', async ({
        page,
      }) => {
        await loadSample(page);
        await clearToasts(page);
        await page.getByRole('button', { name: 'Nouvelle application' }).first().click();
        const dialog = await dialogNamed(page, 'Nouvelle application');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
        await expect(dialog.getByText('Le nom est vide')).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await setEditMode(page, true);
        await page.getByRole('button', { name: 'Ajouter un lien' }).click();
        const extra = await dialogNamed(page, 'Nouveau lien supplémentaire');
        await extra.getByRole('textbox', { name: 'Adresse' }).fill('javascript:alert(1)');
        await extra.getByRole('button', { name: 'Ajouter', exact: true }).click();
        await expect(extra.getByText(/Seules les adresses http et https/)).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await page
          .getByRole('button', { name: 'Modifier l’adresse de « Grafana » pour cet environnement' })
          .click();
        await dialogNamed(page, 'Modifier l’adresse de « Grafana »');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
        await dialogNamed(page, 'Supprimer cette application ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        // No template yet: the information dialog.
        await openAdmin(page, 'Réglages');
        await page.getByRole('button', { name: 'Vider l’espace de travail' }).click();
        await (
          await dialogNamed(page, 'Vider cet espace de travail ?')
        )
          .getByRole('button', { name: 'Vider l’espace de travail' })
          .click();
        await page.getByRole('button', { name: 'Nouvelle application' }).first().click();
        await dialogNamed(page, 'Crée d’abord un template');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the templates screen, its confirmations, and the metadata screen', async ({ page }) => {
        await loadSample(page);
        await clearToasts(page);
        await openAdmin(page, 'Templates');
        await expectNoA11yViolations(page);

        await page.getByRole('button', { name: 'Supprimer le lien « Pipeline »' }).click();
        await dialogNamed(page, 'Supprimer ce lien ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Supprimer l’environnement « DEV »' }).click();
        await dialogNamed(page, 'Supprimer cet environnement ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await page.keyboard.press('Escape');

        // Errors on a field.
        await page.getByLabel('Clé de l’environnement 1').fill('test');
        await page.getByLabel('Clé de l’environnement 1').press('Enter');
        await expect(page.getByText('Cette clé est vide ou déjà utilisée')).toBeVisible();
        await expectNoA11yViolations(page);

        await openAdmin(page, 'Champs de métadonnées');
        await expectNoA11yViolations(page);
        await page.getByRole('button', { name: 'Supprimer le champ « Cluster »' }).click();
        await dialogNamed(page, 'Supprimer ce champ ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the tags screen and its confirmation', async ({ page }) => {
        await loadSample(page);
        await clearToasts(page);
        await openAdmin(page, 'Tags');
        await expectNoA11yViolations(page);
        await page.getByRole('button', { name: 'Supprimer le tag « CI / CD »' }).click();
        await dialogNamed(page, 'Supprimer ce tag ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the import and export screen: empty, a file ready (each way in), an error, the questions', async ({
        page,
      }) => {
        await loadSample(page);
        await clearToasts(page);
        await openAdmin(page, 'Import et export');
        await expectNoA11yViolations(page);

        await page.locator('input[type="file"]').setInputFiles({
          name: 'x.json',
          mimeType: 'application/json',
          buffer: Buffer.from('{oops'),
        });
        await expect(page.getByText('Ce fichier ne peut pas être importé')).toBeVisible();
        await expectNoA11yViolations(page);

        await page.locator('input[type="file"]').setInputFiles(WRAPPED);
        await expect(page.getByText('C’est un fichier de la version précédente.')).toBeVisible();
        await expectNoA11yViolations(page);
        await page.getByRole('radio', { name: 'Nouvel espace de travail' }).check();
        await expectNoA11yViolations(page);
        await page.getByRole('radio', { name: 'Remplacer' }).check();
        await expectNoA11yViolations(page);
        await page.getByRole('button', { name: 'Importer', exact: true }).click();
        await dialogNamed(page, 'Remplacer cet espace de travail ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the settings screen and its questions', async ({ page }) => {
        await loadSample(page);
        await clearToasts(page);
        await openAdmin(page, 'Réglages');
        await expectNoA11yViolations(page);
        await page.getByRole('button', { name: 'Charger l’exemple' }).click();
        await dialogNamed(page, 'Remplacer cet espace de travail par l’exemple ?');
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the command menu', async ({ page }) => {
        await loadSample(page);
        await clearToasts(page);
        await page.keyboard.press('Control+k');
        const menu = page.getByRole('dialog', { name: 'Menu de commandes' });
        await expect(menu).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
        await menu.getByRole('combobox', { name: 'Commande' }).fill('zzzz');
        await expect(menu.getByText('Aucun résultat.')).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });

      test('the toasts and a tooltip', async ({ page }) => {
        await loadSample(page);
        await expect(page.getByText('Exemple chargé')).toBeVisible();
        await settled(page);
        await expectNoA11yViolations(page);
        await clearToasts(page);

        await page.getByRole('button', { name: 'Préférences' }).hover();
        await expect(page.getByRole('tooltip', { name: 'Préférences' })).toBeVisible();
        await expectNoA11yViolations(page);
      });

      test('the drawer of the narrow layout', async ({ page }) => {
        test.skip(width >= 1024, 'the sidebar is not a drawer from 1024 px');
        await loadSample(page);
        await clearToasts(page);
        await page.getByRole('button', { name: 'Menu' }).click();
        await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
        // axe must not look while the drawer is still moving in.
        await settled(page);
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
        await expect(
          page.getByRole('dialog', { name: 'Passer à cet espace de travail ?' }),
        ).toBeVisible();
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
          (value) => localStorage.setItem('dashboard-theme', value),
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
        localStorage.setItem('dashboard-theme', value);
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
