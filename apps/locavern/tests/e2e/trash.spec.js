import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Corbeille locale et rétention configurable (Todo 20)', () => {
  test('conserve les éléments supprimés, configure la rétention, restaure et purge définitivement, WCAG 2.2 AA', async ({
    page,
  }) => {
    await page.goto('/');

    // Configurer la rétention de la corbeille dans les préférences (14 jours)
    await page.locator('#nav-preferences-btn').click();
    await expect(page.locator('#modal-preferences')).toHaveAttribute('open', '');
    await page.locator('#pref-trash-retention').fill('14');
    await page.locator('#pref-trash-retention').blur();
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    // Créer un projet et deux tâches
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Archive Corbeille');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche récupérable');
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(
      page.getByRole('button', { name: 'Tâche récupérable', exact: true }),
    ).toBeVisible();

    // Supprimer la tâche -> placée dans la corbeille
    await page.getByRole('button', { name: 'Supprimer « Tâche récupérable »' }).click();
    await page.locator('#modal-confirm').getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByRole('button', { name: 'Tâche récupérable', exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('#nav-trash-count')).toHaveText('1');

    // Vérifier la persistance après rechargement
    await page.reload();
    await expect(page.locator('#nav-trash-count')).toHaveText('1');

    // Ouvrir la corbeille locale, vérifier l’affichage de la rétention et l’accessibilité WCAG 2.2 AA
    await page.locator('#nav-trash-btn').click();
    await expect(page.locator('#modal-trash')).toHaveAttribute('open', '');
    await expect(page.locator('#modal-trash')).toHaveCSS('opacity', '1');
    await expect(page.locator('#modal-trash-body')).toContainText(
      'Rétention configurée : 14 jours',
    );
    await expect(page.locator('#modal-trash-body')).toContainText('Tâche récupérable');

    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    // Restaurer la tâche depuis la corbeille
    await page.getByRole('button', { name: 'Restaurer Tâche récupérable' }).click();
    await expect(page.locator('#modal-trash-body')).toContainText('La corbeille est vide');
    await page.locator('#modal-trash [data-cv-close]').first().click();

    await expect(
      page.getByRole('button', { name: 'Tâche récupérable', exact: true }),
    ).toBeVisible();
    await expect(page.locator('#nav-trash-count')).toBeHidden();

    // Supprimer le projet complet -> restaurable ou purgeable
    await page.locator('[data-nav-view="projects"]').click();
    await page.getByRole('button', { name: 'Supprimer Projet Archive Corbeille' }).click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Supprimer le projet' })
      .click();
    await expect(page.getByText('Aucun projet pour le moment')).toBeVisible();
    await expect(page.locator('#nav-trash-count')).toHaveText('1');

    await page.locator('#theme-switch').click();
    await page.locator('#nav-trash-btn').click();
    await expect(page.locator('#modal-trash')).toHaveCSS('opacity', '1');
    await expect(page.locator('#modal-trash-body')).toContainText('Projet Archive Corbeille');
    await expect(page.locator('#modal-trash-body')).toContainText('1 tâche');

    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Purger définitivement l’élément
    await page
      .getByRole('button', { name: 'Supprimer définitivement Projet Archive Corbeille' })
      .click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Supprimer définitivement' })
      .click();
    await expect(page.locator('#nav-trash-count')).toBeHidden();
  });
});
