import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Chiffrement optionnel des sauvegardes ZIP (AES-GCM + PBKDF2)', () => {
  test('exporte une archive chiffrée, refuse un mauvais mot de passe puis restaure avec le bon', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer un projet, une tâche et une note locale
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Coffre Locavern');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Sauvegarder les clés');
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(
      page.getByRole('button', { name: 'Sauvegarder les clés', exact: true }),
    ).toBeVisible();

    // Ouvrir les sauvegardes et activer le chiffrement
    await page.locator('#topbar-backup-btn').click();
    await expect(page.locator('#modal-backup')).toHaveAttribute('open', '');
    await expect(page.locator('#modal-backup')).toHaveCSS('opacity', '1');
    await page.locator('#chk-export-encrypt').check();
    await expect(page.locator('#export-encrypt-fields')).toBeVisible();

    // Vérifier la validation en cas de mots de passe divergents
    await page.locator('#input-export-password').fill('MotDePasse#2026');
    await page.locator('#input-export-password-confirm').fill('AutreMotDePasse');
    await page.locator('#btn-export-archive').click();
    await expect(page.locator('#export-encrypt-error')).toBeVisible();

    const axeExportResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeExportResults.violations).toEqual([]);

    // Corriger et exporter l’archive chiffrée
    await page.locator('#input-export-password-confirm').fill('MotDePasse#2026');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-archive').click();
    const download = await downloadPromise;
    const encryptedZipPath = await download.path();
    expect(encryptedZipPath).toBeTruthy();

    // Vérifier que les champs sensibles ont été vidés après l’export
    await expect(page.locator('#input-export-password')).toHaveValue('');
    await expect(page.locator('#input-export-password-confirm')).toHaveValue('');

    // Réinitialiser toutes les données locales
    await page.locator('#btn-reset-all-data').click();
    await page.locator('#modal-confirm').getByRole('button', { name: 'Effacer tout' }).click();
    await expect(page.getByText('Créez un premier projet pour commencer')).toBeVisible();

    // Importer l’archive chiffrée : le formulaire de déverrouillage s’affiche
    await page.locator('#topbar-backup-btn').click();
    await expect(page.locator('#modal-backup')).toHaveCSS('opacity', '1');
    await page
      .locator('#input-import-archive')
      .setInputFiles(/** @type {string} */ (encryptedZipPath));
    await expect(page.locator('#import-decrypt-panel')).toBeVisible();

    const axeUnlockResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeUnlockResults.violations).toEqual([]);

    // Mauvais mot de passe -> message d’erreur clair
    await page.locator('#input-import-password').fill('Mauvais');
    await page.locator('#btn-unlock-archive').click();
    await expect(page.locator('#import-decrypt-error')).toContainText('Mot de passe incorrect');

    // Bon mot de passe -> prévisualisation puis restauration complète
    await page.locator('#input-import-password').fill('MotDePasse#2026');
    await page.locator('#btn-unlock-archive').click();
    await expect(page.locator('#import-archive-panel')).toBeVisible();
    await expect(page.locator('#import-archive-panel')).toContainText(
      'Archive chiffrée déverrouillée',
    );

    await page.locator('#btn-confirm-import-archive').click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Importer et remplacer' })
      .click();

    await expect(
      page.getByRole('button', { name: 'Sauvegarder les clés', exact: true }),
    ).toBeVisible();
  });
});
