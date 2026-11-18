import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Modèles locaux réutilisables (checklists, trames de notes, canevas) & WCAG 2.2 AA', () => {
  test('cycle complet : modèles intégrés, création personnalisée, persistance IndexedDB, suppression et axe-core', async ({
    page,
  }) => {
    /** @type {string[]} */
    const externalRequests = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (
        url.origin !== 'http://127.0.0.1:4173' &&
        url.protocol !== 'data:' &&
        url.protocol !== 'blob:'
      ) {
        externalRequests.push(req.url());
      }
    });

    await page.goto('/');

    // 1. Créer un projet puis tester les modèles de checklist dans le tiroir tâche
    await page.locator('[data-nav-view="projects"]').click();
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Modèles');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    await expect(page.locator('#drawer-task')).toBeVisible();
    await page.locator('#task-title-input').fill('Déployer version');

    // Appliquer le modèle intégré de checklist
    await page.locator('#task-checklist-tpl-select').selectOption('builtin-checklist-release');
    await page.locator('#task-checklist-tpl-apply').click();
    await expect(page.locator('.lc-checklist__row')).toHaveCount(4);

    // Ajouter une étape spécifique et enregistrer en modèle local personnalisé
    await page.locator('#task-checklist-new').fill('Archiver la note de livraison');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.locator('.lc-checklist__row')).toHaveCount(5);

    await page.locator('#task-checklist-tpl-save-open').click();
    await page.locator('#task-checklist-tpl-name-input').fill('Ma checklist release');
    await page.locator('#task-checklist-tpl-name-input').press('Enter');
    await expect(page.locator('.cv-toast-region')).toContainText('Modèle de checklist enregistré');
    await expect(page.locator('#drawer-task')).toBeVisible();

    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.locator('.cv-table tbody tr')).toContainText('Déployer version');

    // 2. Tester les modèles de trames de notes
    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Réunion hebdo');
    await page.locator('#note-dialog-tpl-select').selectOption('builtin-note-meeting');
    await page.locator('#note-dialog-tpl-apply').click();
    await expect(page.locator('#dialog-note .ProseMirror')).toContainText('Ordre du jour');
    await page.locator('#dialog-note button[type="submit"]').click();

    await expect(page.locator('#note-title-input')).toHaveValue('Réunion hebdo');
    await page.locator('#note-tpl-save-open').click();
    await page.locator('#note-tpl-name-input').fill('Trame hebdo équipe');
    await page.locator('#note-tpl-save-confirm').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Modèle de note enregistré');

    // 3. Tester les modèles de canevas de tableau blanc (création directe depuis modèle intégré + sauvegarde perso)
    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Flux initial');
    await page.locator('#whiteboard-dialog-template-select').selectOption('builtin-wb-flow');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Flux initial');
    await expect(page.locator('.lc-wb-el')).toHaveCount(5);
    await expect(page.locator('.lc-wb-el[data-el-type="arrow"]')).toHaveCount(2);

    await page.locator('#wb-tpl-save-open').click();
    await page.locator('#wb-tpl-name-input').fill('Mon canevas flux');
    await page.locator('#wb-tpl-save-confirm').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Modèle de canevas enregistré');

    // Recharger et vérifier que les 3 modèles personnalisés persistent dans IndexedDB (bascule en modification)
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await expect(page.locator('#whiteboard-consult-title')).toHaveText('Flux initial');
    await page.locator('#btn-switch-wb-edit').click();
    await expect(page.locator('#wb-tpl-select')).toContainText('Mon canevas flux');

    // Appliquer le modèle de canevas sur un nouveau tableau blanc vide
    await page.locator('#btn-new-whiteboard').click();
    await page.locator('#whiteboard-dialog-title-input').fill('Canevas vide');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('.lc-wb-el')).toHaveCount(0);

    const customWbValue = await page
      .locator('#wb-tpl-select option', { hasText: 'Mon canevas flux' })
      .getAttribute('value');
    expect(customWbValue).toBeTruthy();
    await page.locator('#wb-tpl-select').selectOption(String(customWbValue));
    await page.locator('#wb-tpl-apply').click();
    await expect(page.locator('.lc-wb-el')).toHaveCount(5);

    // Vérifier aussi la persistance du modèle de checklist personnalisé et sa suppression
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    const customClOpt = page.locator('#task-checklist-tpl-select option', {
      hasText: 'Ma checklist release',
    });
    const customClVal = await customClOpt.getAttribute('value');
    expect(customClVal).toBeTruthy();
    await page.locator('#task-checklist-tpl-select').selectOption(String(customClVal));
    await page.locator('#task-checklist-tpl-apply').click();
    await expect(page.locator('.lc-checklist__row')).toHaveCount(5);

    // Supprimer le modèle personnalisé de checklist
    await page.locator('#task-checklist-tpl-delete').click();
    await expect(
      page.locator('#task-checklist-tpl-select option', { hasText: 'Ma checklist release' }),
    ).toHaveCount(0);
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // Vérifier aussi la persistance du modèle de note personnalisé
    await page.locator('[data-nav-view="notes"]').click();
    await page.locator('#btn-switch-note-edit').click();
    await expect(page.locator('#note-tpl-select')).toContainText('Trame hebdo équipe');

    // Audit axe-core clair + sombre + reflow 320 px
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
    expect(externalRequests).toEqual([]);
  });
});
