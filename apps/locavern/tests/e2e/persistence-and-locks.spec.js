import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Persistance IndexedDB, Web Locks multi-onglets et sauvegarde ZIP (Étape 3)', () => {
  test('persiste après rechargement, verrouille le 2e onglet et restaure une archive ZIP', async ({
    context,
    page,
  }) => {
    await page.goto('/');

    // Créer un projet et une tâche dans l’onglet 1
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Persistance');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche durable');
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.getByRole('button', { name: 'Tâche durable', exact: true })).toBeVisible();

    // Ouvrir un 2e onglet pendant que le 1er détient le Web Lock
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('#readonly-banner-slot')).toContainText('Mode lecture seule actif');
    await expect(page2.locator('#btn-new-task')).toBeDisabled();

    // Fermer le 1er onglet -> le 2e onglet reprend l’édition
    await page.close();
    await expect(page2.locator('#readonly-banner-slot')).toBeEmpty({ timeout: 5000 });
    await expect(page2.locator('#btn-new-task')).toBeEnabled();

    // Vérifier la persistance après rechargement sur l’onglet 2
    await page2.reload();
    await expect(page2.getByRole('button', { name: 'Tâche durable', exact: true })).toBeVisible();

    // Cycle complet Export ZIP -> Réinitialisation -> Import ZIP + suivi d’ancienneté
    await page2.locator('#topbar-backup-btn').click();
    await expect(page2.locator('#modal-backup')).toHaveAttribute('open', '');
    await expect(page2.locator('#stat-last-backup-age')).toHaveText('Aucune sauvegarde ZIP');

    const downloadPromise = page2.waitForEvent('download');
    await page2.locator('#btn-export-archive').click();
    const download = await downloadPromise;
    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();
    await expect(page2.locator('#stat-last-backup-age')).toHaveText('À l’instant');

    // L’horodatage de dernière sauvegarde survit au rechargement
    await page2.reload();
    await page2.locator('#topbar-backup-btn').click();
    await expect(page2.locator('#stat-last-backup-age')).toHaveText('À l’instant');

    // Réinitialiser toutes les données locales
    await page2.locator('#btn-reset-all-data').click();
    await page2.locator('#modal-confirm').getByRole('button', { name: 'Effacer tout' }).click();
    await expect(page2.getByText('Créez un premier projet pour commencer')).toBeVisible();

    // Importer l’archive ZIP précédemment exportée en mode remplacement
    await page2.locator('#topbar-backup-btn').click();
    await expect(page2.locator('#stat-last-backup-age')).toHaveText('Aucune sauvegarde ZIP');
    await page2.locator('#input-import-archive').setInputFiles(/** @type {string} */ (zipPath));
    await expect(page2.locator('#import-archive-panel')).toBeVisible();
    await page2.locator('input[name="import-mode"][value="replace"]').check();
    await page2.locator('#btn-confirm-import-archive').click();
    await page2
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Importer et remplacer' })
      .click();

    await expect(page2.getByRole('button', { name: 'Tâche durable', exact: true })).toBeVisible();
  });

  test('importe une archive ZIP par fusion ou sélection de projet sans écraser les données locales', async ({
    page,
  }) => {
    await page.goto('/');

    // Préparer deux projets avec tâches pour exporter une archive source
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Alpha Archive');
    await page.locator('#modal-project button[type="submit"]').click();
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Alpha');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('[data-nav-view="projects"]').click();
    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Beta Archive');
    await page.locator('#modal-project button[type="submit"]').click();
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#task-project-filter').selectOption({ label: 'Beta Archive' });
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Beta');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('#topbar-backup-btn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-archive').click();
    const download = await downloadPromise;
    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();

    // Réinitialiser puis créer un projet local distinct à préserver
    await page.locator('#btn-reset-all-data').click();
    await page.locator('#modal-confirm').getByRole('button', { name: 'Effacer tout' }).click();

    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Local Conservé');
    await page.locator('#modal-project button[type="submit"]').click();

    // Ouvrir l’import et sélectionner uniquement "Beta Archive"
    await page.locator('#topbar-backup-btn').click();
    await page.locator('#input-import-archive').setInputFiles(/** @type {string} */ (zipPath));
    await expect(page.locator('#import-archive-panel')).toBeVisible();
    await page.locator('input[name="import-mode"][value="projects"]').check();
    await expect(page.locator('#import-project-selection')).toBeVisible();

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Décocher "Alpha Archive" et garder "Beta Archive"
    await page.getByLabel(/Alpha Archive/).uncheck();
    await page.locator('#btn-confirm-import-archive').click();
    await expect(page.locator('#modal-backup')).not.toHaveAttribute('open', '');

    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.getByRole('heading', { name: 'Local Conservé' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Beta Archive' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alpha Archive' })).toHaveCount(0);

    // Fusionner toute l'archive ensuite -> les données existantes restent intactes et Alpha Archive est ajouté
    await page.locator('#topbar-backup-btn').click();
    await page.locator('#input-import-archive').setInputFiles(/** @type {string} */ (zipPath));
    await expect(page.locator('input[name="import-mode"][value="merge"]')).toBeChecked();
    await page.locator('#btn-confirm-import-archive').click();

    await expect(page.getByRole('heading', { name: 'Local Conservé' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alpha Archive' })).toBeVisible();
  });

  test('utilise showSaveFilePicker lorsqu’il est disponible et met à jour l’ancienneté de sauvegarde', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      /** @type {{ __pickerSaves: Array<{ name: string; size: number }>; showSaveFilePicker: (options?: { suggestedName?: string }) => Promise<unknown> }} */
      const w = /** @type {any} */ (window);
      w.__pickerSaves = [];
      w.showSaveFilePicker = async (options) => ({
        createWritable: async () => {
          let writtenSize = 0;
          return {
            write: async (/** @type {Blob} */ blob) => {
              writtenSize += blob.size;
            },
            close: async () => {
              w.__pickerSaves.push({
                name: options?.suggestedName ?? '',
                size: writtenSize,
              });
            },
          };
        },
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Picker');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#topbar-backup-btn').click();
    await page.locator('#btn-export-archive').click();

    await expect(page.locator('#stat-last-backup-age')).toHaveText('À l’instant');
    const saves = await page.evaluate(() => /** @type {any} */ (window).__pickerSaves);
    expect(saves).toHaveLength(1);
    expect(saves[0].name).toMatch(/^locavern-sauvegarde-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(saves[0].size).toBeGreaterThan(0);
  });
});
