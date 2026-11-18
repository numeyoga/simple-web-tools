import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Étiquettes transversales tâches & notes (Todo 17)', () => {
  test('ajoute des étiquettes sur tâches et notes et filtre au-delà des projets, WCAG 2.2 AA', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer 2 projets distincts
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Un');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('[data-nav-view="projects"]').click();
    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Projet Deux');
    await page.locator('#modal-project button[type="submit"]').click();

    // Créer une tâche dans Projet Un avec tag "client-a"
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Audit sécurité');
    await page.locator('#task-project-select').selectOption({ label: 'Projet Un' });
    await page.locator('#task-tags-input').fill('client-a, urgent');
    await page.locator('#task-tags-add').click();
    await expect(page.locator('#task-tags-chips')).toContainText('#client-a');
    await expect(page.locator('#task-tags-chips')).toContainText('#urgent');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Créer une deuxième tâche dans Projet Deux avec tag "client-a"
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Déploiement local');
    await page.locator('#task-project-select').selectOption({ label: 'Projet Deux' });
    await page.locator('#task-tags-input').fill('client-a');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Passer sur "Tous les projets" et filtrer par étiquette #client-a puis #urgent
    await page.locator('#task-project-filter').selectOption('');
    await page.locator('#list-tag-filter').selectOption('client-a');
    await expect(page.locator('.cv-table tbody tr')).toHaveCount(2);

    await page.locator('#list-tag-filter').selectOption('urgent');
    await expect(page.locator('.cv-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.cv-table tbody')).toContainText('Audit sécurité');

    // Vérifier aussi le filtre étiquette sur le Kanban
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await page.locator('#kanban-tag-filter').selectOption('urgent');
    await expect(page.locator('.lc-kanban__card')).toHaveCount(1);
    await expect(page.locator('.lc-kanban')).toContainText('Audit sécurité');

    // Créer une note dans Projet Deux avec tag "client-a" et filtrer dans Notes
    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Compte rendu Client A');
    await page.locator('#note-dialog-tags-input').fill('client-a');
    await page.locator('#note-dialog-tags-add').click();
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#dialog-note')).toBeHidden();

    await expect(page.locator('#note-tags-chips')).toContainText('#client-a');
    await page.locator('#notes-tag-filter').selectOption('client-a');
    await expect(page.locator('.lc-notes-list .lc-note-item')).toHaveCount(1);

    // Audit axe-core thème clair
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    // Persistance après rechargement
    await page.reload();
    await expect(page.locator('#note-tags-chips')).toContainText('#client-a');
  });
});
