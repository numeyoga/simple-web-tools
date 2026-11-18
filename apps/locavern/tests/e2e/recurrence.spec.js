import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Tâches récurrentes & génération de l’occurrence suivante', () => {
  test('création, complétion en Liste et Kanban, réinitialisation checklist, persistance IndexedDB et axe-core', async ({
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

    // 1. Créer un projet
    await page.locator('[data-nav-view="projects"]').click();
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Récurrence');
    await page.locator('#modal-project button[type="submit"]').click();

    // 2. Créer une tâche récurrente hebdomadaire avec checklist dans la vue Liste
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    await expect(page.locator('#drawer-task')).toBeVisible();
    await page.locator('#task-title-input').fill('Revue hebdomadaire');
    await page.locator('#task-due-input').fill('2026-11-15');
    await page.locator('#task-recurrence-select').selectOption('weekly');

    await page.locator('#task-checklist-new').fill('Vérifier les sauvegardes');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.locator('.lc-checklist__row input[type="checkbox"]').check();

    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.locator('.cv-table tbody tr')).toHaveCount(1);
    await expect(page.locator('[data-recurrence-badge="weekly"]')).toBeVisible();

    // 3. Terminer la tâche via le sélecteur rapide de statut -> génère l’occurrence du 2026-11-22
    await page.getByLabel('Changer le statut de « Revue hebdomadaire »').selectOption('done');
    await expect(page.locator('.cv-toast-region')).toContainText('Prochaine occurrence créée');
    await expect(page.locator('.cv-table tbody tr')).toHaveCount(2);

    const nextRow = page.locator('.cv-table tbody tr', { hasText: '2026-11-22' });
    await expect(nextRow).toBeVisible();
    await expect(nextRow).toContainText('À faire');
    await expect(nextRow.locator('[data-recurrence-badge="weekly"]')).toBeVisible();

    // Vérifier que la checklist de la nouvelle occurrence est réinitialisée (décochée)
    await nextRow.getByRole('button', { name: /Modifier « Revue hebdomadaire »/ }).click();
    await expect(page.locator('#drawer-task')).toBeVisible();
    await expect(page.locator('#task-recurrence-select')).toHaveValue('weekly');
    await expect(page.locator('.lc-checklist__row input[type="checkbox"]')).not.toBeChecked();
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // 4. Basculer sur le Kanban et tester une récurrence mensuelle bornée (31 janv -> 28 fév)
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(page.locator('.lc-kanban')).toBeVisible();
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Clôture mensuelle');
    await page.locator('#task-due-input').fill('2026-01-31');
    await page.locator('#task-recurrence-select').selectOption('monthly');
    await page.locator('#drawer-task button[type="submit"]').click();

    const todoCol = page.locator('[data-kanban-status="todo"]');
    const doneCol = page.locator('[data-kanban-status="done"]');
    await expect(
      todoCol.locator('.lc-kanban__card', { hasText: 'Clôture mensuelle' }),
    ).toBeVisible();

    await todoCol.getByRole('button', { name: 'Actions pour « Clôture mensuelle »' }).click();
    await page.getByRole('menuitem', { name: 'Déplacer vers Terminé' }).click();

    await expect(page.locator('.cv-toast-region')).toContainText('Prochaine occurrence créée');
    await expect(doneCol.locator('.lc-kanban__card', { hasText: '2026-01-31' })).toBeVisible();
    await expect(todoCol.locator('.lc-kanban__card', { hasText: '2026-02-28' })).toBeVisible();

    // 5. Recharger la page et vérifier la persistance IndexedDB
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    await expect(page.locator('.lc-kanban')).toBeVisible();
    await expect(
      page.locator('[data-kanban-status="todo"] .lc-kanban__card', { hasText: '2026-02-28' }),
    ).toBeVisible();
    await expect(
      page.locator('[data-kanban-status="done"] .lc-kanban__card', { hasText: '2026-01-31' }),
    ).toBeVisible();

    // 6. Audit axe-core clair + sombre + reflow 320 px
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
