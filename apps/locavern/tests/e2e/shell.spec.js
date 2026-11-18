import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('AppShell Covenant & accessibilité (Étape 1)', () => {
  test('zéro requête externe, thème clair/sombre et 0 violation WCAG 2.2 AA', async ({ page }) => {
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
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');

    // Vérifier absence de requêtes externes
    expect(externalRequests).toEqual([]);

    // Vérifier thème clair avec axe-core
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const lightResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightResults.violations).toEqual([]);

    // Basculer en thème sombre
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const darkResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkResults.violations).toEqual([]);

    // Vérifier reflow à 320 px (aucun débordement horizontal)
    await page.setViewportSize({ width: 320, height: 640 });
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('préférences TextSize, persistance, échelle grand écran et WCAG 2.2 AA', async ({
    page,
  }) => {
    await page.goto('/');

    // Ouvrir les préférences d'affichage depuis la barre latérale
    await page.locator('#nav-preferences-btn').click();
    await expect(page.locator('#modal-preferences')).toBeVisible();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await expect(page.locator('input[name="text-size"][value="auto"]')).toBeChecked();

    // Accessibilité de la modale Préférences en clair et sombre
    const lightModalAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightModalAxe.violations).toEqual([]);

    // Sélectionner la taille Grande (x1.25)
    await page.locator('input[name="text-size"][value="large"]').check();
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');

    const scaledSizes = await page.evaluate(() => ({
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      bodyFontSize: getComputedStyle(document.body).fontSize,
      stored: localStorage.getItem('locavern-text-size'),
    }));
    expect(scaledSizes).toEqual({
      rootFontSize: '20px',
      bodyFontSize: '16.25px',
      stored: 'large',
    });

    // Pas de débordement horizontal à 1280 px ni à 320 px avec la taille Grande
    const overflow1280 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow1280).toBe(false);

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);

    // Recharger à 1280 px : theme-init.js pré-hydrate data-text-size avant peinture
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
    const afterReloadFontSize = await page.evaluate(
      () => getComputedStyle(document.documentElement).fontSize,
    );
    expect(afterReloadFontSize).toBe('20px');

    // Rouvrir via la palette de commandes (Ctrl+K) et vérifier en thème sombre
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('Control+k');
    await expect(page.locator('#cmd-menu')).toBeVisible();
    await page.locator('#cmd-list [data-value="action:open-preferences"]').click();
    await expect(page.locator('#modal-preferences')).toBeVisible();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await expect(page.locator('input[name="text-size"][value="large"]')).toBeChecked();

    const darkModalAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkModalAxe.violations).toEqual([]);

    // Revenir sur Automatique et tester l'échelle automatique 2560x1440 (x1.25)
    await page.locator('input[name="text-size"][value="auto"]').check();
    await expect(page.locator('html')).not.toHaveAttribute('data-text-size');
    const storedAfterAuto = await page.evaluate(() => localStorage.getItem('locavern-text-size'));
    expect(storedAfterAuto).toBeNull();
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    await page.setViewportSize({ width: 2560, height: 1440 });
    const auto2560Sizes = await page.evaluate(() => ({
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      bodyFontSize: getComputedStyle(document.body).fontSize,
    }));
    expect(auto2560Sizes).toEqual({
      rootFontSize: '20px',
      bodyFontSize: '16.25px',
    });
  });

  test('palette Ctrl+K et recherche plein contenu ouvrent projets, tâches, notes et tableaux blancs', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer un projet, une tâche avec checklist/description, une note avec contenu et un tableau blanc
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Palette');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Palette');
    await page.locator('#task-checklist-new').fill('Vérifier sauvegarde cryptée');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page
      .locator('#drawer-task [contenteditable="true"]')
      .fill('Description détaillée hors-ligne');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Rechercher par le texte de la checklist dans la vue Liste
    await page.locator('#list-search-input').fill('cryptee');
    await expect(page.locator('tbody')).toContainText('Tâche Palette');
    await page.locator('#list-search-input').fill('');

    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Note Palette');
    await page
      .locator('#dialog-note [contenteditable="true"]')
      .fill('Compte-rendu architecture locale');
    await page.locator('#dialog-note button[type="submit"]').click();

    // Rechercher par le contenu Tiptap dans la vue Notes
    await page.locator('#notes-search-input').fill('architecture');
    await expect(page.locator('.lc-notes-list')).toContainText('Note Palette');
    await page.locator('#notes-search-input').fill('');

    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau Palette');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    // Ouvrir Ctrl+K, filtrer le projet et naviguer via Entrée
    await page.keyboard.press('Control+k');
    await expect(page.locator('#cmd-menu')).toBeVisible();
    const cmdInput = page.locator('#cmd-menu .cv-cmd__input');
    await cmdInput.fill('Projet Palette');
    await expect(page.locator('#cmd-list [data-value^="open:project:"]')).toBeVisible();
    const axeCmd = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeCmd.violations).toEqual([]);
    await cmdInput.press('Enter');
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');

    // Ouvrir la tâche directement via Ctrl+K en cherchant un mot de sa description (mode Consultation)
    await page.keyboard.press('Control+k');
    await cmdInput.fill('detaillee');
    await expect(page.locator('#cmd-list [data-value^="open:task:"]')).toBeVisible();
    await cmdInput.press('Enter');
    await expect(page.locator('#drawer-task')).toBeVisible();
    await expect(page.locator('#task-consult-view')).toContainText('Tâche Palette');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // Ouvrir la note directement via Ctrl+K en cherchant un mot de son contenu (mode Consultation)
    await page.keyboard.press('Control+k');
    await cmdInput.fill('architecture');
    await expect(page.locator('#cmd-list [data-value^="open:note:"]')).toBeVisible();
    await cmdInput.press('Enter');
    await expect(page.locator('#topbar-title')).toHaveText('Notes');
    await expect(page.locator('#note-consult-title')).toHaveText('Note Palette');

    // Ouvrir le tableau blanc directement via Ctrl+K (mode Consultation)
    await page.keyboard.press('Control+k');
    await cmdInput.fill('Tableau Palette');
    await expect(page.locator('#cmd-list [data-value^="open:whiteboard:"]')).toBeVisible();
    await cmdInput.press('Enter');
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await expect(page.locator('#whiteboard-consult-title')).toHaveText('Tableau Palette');
  });
});
