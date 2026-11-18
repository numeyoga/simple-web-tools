import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Références locales internes tâches, notes & tableaux blancs (Todo 18)', () => {
  test('lie directement tâche, note et tableau blanc avec navigation et rétroliens, WCAG 2.2 AA', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer un projet, une note, un tableau blanc et une tâche
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Liens');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Cahier des charges');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#dialog-note')).toBeHidden();

    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Schéma Flux');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('#dialog-whiteboard')).toBeHidden();

    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Développer connecteur');

    // Lier la note et le tableau blanc depuis le tiroir de tâche
    const taskLinkSelect = page.locator('#task-links-select');
    const noteOptValue = await taskLinkSelect
      .locator('option', { hasText: 'Cahier des charges' })
      .getAttribute('value');
    const wbOptValue = await taskLinkSelect
      .locator('option', { hasText: 'Schéma Flux' })
      .getAttribute('value');
    expect(noteOptValue).toBeTruthy();
    expect(wbOptValue).toBeTruthy();

    await taskLinkSelect.selectOption(/** @type {string} */ (noteOptValue));
    await page.locator('#task-links-add').click();
    await taskLinkSelect.selectOption(/** @type {string} */ (wbOptValue));
    await page.locator('#task-links-add').click();

    await expect(page.locator('#task-links-list')).toContainText('Cahier des charges');
    await expect(page.locator('#task-links-list')).toContainText('Schéma Flux');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Rouvrir la tâche en consultation et naviguer directement vers la note liée
    await page.getByRole('button', { name: 'Développer connecteur', exact: true }).click();
    await expect(page.locator('#task-consult-view')).toBeVisible();
    await expect(page.locator('#task-links-list')).toContainText('Cahier des charges');

    // Audit axe-core sur le tiroir avec liens
    const drawerAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(drawerAxe.violations).toEqual([]);

    await page
      .locator('#task-links-list')
      .getByRole('button', { name: /Ouvrir note « Cahier des charges »/ })
      .click();

    await expect(page.locator('#topbar-title')).toHaveText('Notes');
    await expect(page.locator('#note-consult-title')).toHaveText('Cahier des charges');
    // Rétrolien visible dès la consultation + passage en modification pour ajouter un lien
    await expect(page.locator('#note-links-backlinks')).toContainText('Développer connecteur');

    await page.locator('#btn-switch-note-edit').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Cahier des charges');

    const noteLinkSelect = page.locator('#note-links-select');
    const wbFromNote = await noteLinkSelect
      .locator('option', { hasText: 'Schéma Flux' })
      .getAttribute('value');
    await noteLinkSelect.selectOption(/** @type {string} */ (wbFromNote));
    await page.locator('#note-links-add').click();
    await expect(page.locator('#note-links-list')).toContainText('Schéma Flux');

    // Naviguer vers le tableau blanc depuis la note (ouvre en consultation)
    await page
      .locator('#note-links-list')
      .getByRole('button', { name: /Ouvrir tableau « Schéma Flux »/ })
      .click();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await expect(page.locator('#whiteboard-consult-title')).toHaveText('Schéma Flux');
    await expect(page.locator('#whiteboard-links-backlinks')).toContainText(
      'Développer connecteur',
    );
    await expect(page.locator('#whiteboard-links-backlinks')).toContainText('Cahier des charges');

    // Persistance après rechargement (retour en consultation)
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await expect(page.locator('#whiteboard-consult-title')).toHaveText('Schéma Flux');
    await expect(page.locator('#whiteboard-links-backlinks')).toContainText(
      'Développer connecteur',
    );
  });
});
