import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** @param {number} deltaDays */
function formatIsoOffset(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Vue d’accueil Aujourd’hui', () => {
  test('synthétise retards, échéances proches, priorités hautes, éléments récents et reste conforme WCAG 2.2 AA', async ({
    page,
  }) => {
    const yesterday = formatIsoOffset(-2);
    const today = formatIsoOffset(0);
    const soon = formatIsoOffset(3);

    await page.goto('/');

    // Créer un projet et quelques tâches via la vue Tâches
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Tableau de bord');
    await page.locator('#modal-project button[type="submit"]').click();

    // Tâche en retard
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Corriger anomalie critique');
    await page.locator('#task-due-input').fill(yesterday);
    await page.locator('#drawer-task button[type="submit"]').click();

    // Tâche du jour priorité haute
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Livrer jalon');
    await page.locator('#task-priority-select').selectOption('high');
    await page.locator('#task-due-input').fill(today);
    await page.locator('#drawer-task button[type="submit"]').click();

    // Tâche sous 3 jours
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Préparer démo');
    await page.locator('#task-due-input').fill(soon);
    await page.locator('#drawer-task button[type="submit"]').click();

    // Créer une note pour l’historique récent
    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Note de cadrage');
    await page.locator('#dialog-note button[type="submit"]').click();

    // Naviguer vers Aujourd’hui
    await page.locator('[data-nav-view="today"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Aujourd’hui');

    await expect(page.locator('#today-stat-overdue')).toContainText('1');
    await expect(page.locator('#today-stat-due-today')).toContainText('1');
    await expect(page.locator('#today-stat-upcoming')).toContainText('1');
    await expect(page.locator('#today-stat-high-prio')).toContainText('1');

    await expect(page.locator('#today-overdue-section')).toContainText(
      'Corriger anomalie critique',
    );
    await expect(page.locator('#today-upcoming-section')).toContainText('Livrer jalon');
    await expect(page.locator('#today-upcoming-section')).toContainText('Préparer démo');
    await expect(page.locator('#today-priority-section')).toContainText('Livrer jalon');
    await expect(page.locator('#today-recent-section')).toContainText('Note de cadrage');

    // Marquer la tâche en retard comme terminée -> le compteur En retard passe à 0
    await page
      .locator('#today-overdue-section')
      .getByRole('button', { name: 'Marquer « Corriger anomalie critique » comme terminée' })
      .click();
    await expect(page.locator('#today-stat-overdue')).toContainText('0');
    await expect(page.locator('#today-overdue-section')).toContainText('Aucune tâche en retard.');

    // Recharger -> la vue active Aujourd’hui persiste
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Aujourd’hui');

    // Axe-core clair & sombre + reflow 320 px
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    await page.locator('#theme-switch').click();
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
  });
});
