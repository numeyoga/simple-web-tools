import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Paramétrage du visuel de saisie par écran (tiroir latéral / modale)', () => {
  test('configure chaque écran dans les préférences, persiste au rechargement et respecte WCAG 2.2 AA', async ({
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

    // 1. Vérifier les valeurs par défaut dans Préférences d’affichage
    await page.locator('#nav-preferences-btn').click();
    await expect(page.locator('#modal-preferences')).toBeVisible();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await expect(
      page.locator('input[name="input-presentation-tasks"][value="drawer"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[name="input-presentation-projects"][value="modal"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[name="input-presentation-notes"][value="drawer"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[name="input-presentation-whiteboards"][value="modal"]'),
    ).toBeChecked();

    // Accessibilité en thème clair et à 320 px
    const lightPrefAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightPrefAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const prefOverflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(prefOverflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2. Basculer les 4 écrans sur l’autre visuel et vérifier la persistance
    await page.locator('input[name="input-presentation-tasks"][value="modal"]').check();
    await page.locator('input[name="input-presentation-projects"][value="drawer"]').check();
    await page.locator('input[name="input-presentation-notes"][value="modal"]').check();
    await page.locator('input[name="input-presentation-whiteboards"][value="drawer"]').check();
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    await page.reload();
    await page.keyboard.press('Control+k');
    await expect(page.locator('#cmd-menu')).toBeVisible();
    await page.locator('#cmd-list [data-value="action:open-preferences"]').click();
    await expect(page.locator('#modal-preferences')).toBeVisible();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await expect(
      page.locator('input[name="input-presentation-tasks"][value="modal"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[name="input-presentation-projects"][value="drawer"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[name="input-presentation-notes"][value="modal"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[name="input-presentation-whiteboards"][value="drawer"]'),
    ).toBeChecked();
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    // 3. Projets configuré en tiroir latéral (cv-drawer)
    await page.locator('[data-nav-view="projects"]').click();
    await page.locator('#btn-new-project').click();
    const projectDialog = page.locator('#modal-project');
    await expect(projectDialog).toBeVisible();
    await expect(projectDialog).toHaveClass(/cv-drawer/);
    await expect(projectDialog).not.toHaveClass(/cv-modal/);
    await expect(projectDialog).toHaveCSS('transform', 'none');
    const projectBox = await projectDialog.boundingBox();
    expect(projectBox).not.toBeNull();
    if (projectBox) {
      expect(projectBox.x + projectBox.width).toBeGreaterThanOrEqual(1275);
      expect(projectBox.height).toBeGreaterThanOrEqual(795);
    }

    const projectDrawerAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(projectDrawerAxe.violations).toEqual([]);

    await page.locator('#project-name-input').fill('Projet Alpha');
    await page.locator('#modal-project button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: 'Projet Alpha' })).toBeVisible();

    // 4. Tâches configuré en modale (cv-modal)
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    const taskDialog = page.locator('#drawer-task');
    await expect(taskDialog).toBeVisible();
    await expect(taskDialog).toHaveClass(/cv-modal/);
    await expect(taskDialog).not.toHaveClass(/cv-drawer/);
    await expect(taskDialog).toHaveCSS('opacity', '1');
    const taskBox = await taskDialog.boundingBox();
    expect(taskBox).not.toBeNull();
    if (taskBox) {
      expect(taskBox.x).toBeGreaterThan(100);
      expect(taskBox.x + taskBox.width).toBeLessThan(1180);
    }

    const taskModalAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(taskModalAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const taskOverflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(taskOverflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.locator('#task-title-input').fill('Tâche en modale');
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.getByRole('button', { name: 'Tâche en modale', exact: true })).toBeVisible();

    // 5. Notes : création en modale, puis bascule vers tiroir latéral et édition via « Ouvrir la saisie »
    await page.locator('[data-nav-view="notes"]').click();
    await page.locator('#btn-new-note').click();
    const noteDialog = page.locator('#dialog-note');
    await expect(noteDialog).toBeVisible();
    await expect(noteDialog).toHaveClass(/cv-modal/);
    await expect(noteDialog).not.toHaveClass(/cv-drawer/);
    await expect(noteDialog).toHaveCSS('opacity', '1');
    await page.locator('#note-dialog-title-input').fill('Note modale');
    await page.locator('#dialog-note .ProseMirror').click();
    await page.keyboard.type('Corps initial');
    await page.locator('#dialog-note button[type="submit"]').click();

    await expect(page.locator('#note-title-input')).toHaveValue('Note modale');
    await expect(page.locator('#app-view .ProseMirror')).toContainText('Corps initial');

    // Basculer Notes en tiroir latéral puis éditer
    await page.locator('#nav-preferences-btn').click();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await page.locator('input[name="input-presentation-notes"][value="drawer"]').check();
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    await page.locator('#btn-open-note-dialog').click();
    await expect(noteDialog).toBeVisible();
    await expect(noteDialog).toHaveClass(/cv-drawer/);
    await expect(noteDialog).not.toHaveClass(/cv-modal/);
    await expect(noteDialog).toHaveCSS('transform', 'none');
    await page.locator('#note-dialog-title-input').fill('Note tiroir');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Note tiroir');

    // 6. Tableaux blancs : création en tiroir latéral, puis bascule vers modale et édition via « Ouvrir la saisie »
    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.locator('#btn-new-whiteboard').click();
    const wbDialog = page.locator('#dialog-whiteboard');
    await expect(wbDialog).toBeVisible();
    await expect(wbDialog).toHaveClass(/cv-drawer/);
    await expect(wbDialog).not.toHaveClass(/cv-modal/);
    await expect(wbDialog).toHaveCSS('transform', 'none');
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau tiroir');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Tableau tiroir');

    // Basculer Tableaux blancs en modale puis éditer en thème sombre
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('#nav-preferences-btn').click();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await page.locator('input[name="input-presentation-whiteboards"][value="modal"]').check();
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    await page.locator('#btn-open-whiteboard-dialog').click();
    await expect(wbDialog).toBeVisible();
    await expect(wbDialog).toHaveClass(/cv-modal/);
    await expect(wbDialog).not.toHaveClass(/cv-drawer/);
    await expect(wbDialog).toHaveCSS('opacity', '1');

    const wbModalDarkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(wbModalDarkAxe.violations).toEqual([]);

    await page.locator('#whiteboard-dialog-title-input').fill('Tableau modale');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Tableau modale');

    // 7. Création via Ctrl+K sur Tableaux blancs depuis la vue Projets -> bascule de vue après validation
    await page.locator('[data-nav-view="projects"]').click();
    await page.keyboard.press('Control+k');
    await expect(page.locator('#cmd-menu')).toBeVisible();
    await page.locator('#cmd-list [data-value="action:new-whiteboard"]').click();
    await expect(wbDialog).toBeVisible();
    await expect(wbDialog).toHaveCSS('opacity', '1');
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau depuis palette');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Tableau depuis palette');

    expect(externalRequests).toEqual([]);
  });
});
