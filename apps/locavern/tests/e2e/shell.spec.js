import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { openPreferences, setTheme } from './support/shell.js';

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
    await expectNoA11yViolations(page);

    // Basculer en thème sombre
    await setTheme(page, 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await expectNoA11yViolations(page);

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

    // Ouvrir les préférences d'affichage avec l'engrenage de la barre supérieure
    await openPreferences(page);
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await expect(page.locator('input[name="text-size"][value="auto"]')).toBeChecked();

    // Accessibilité de la modale Préférences en clair et sombre
    await expectNoA11yViolations(page);

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
    await setTheme(page, 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('Control+k');
    await expect(page.locator('#cmd-menu')).toBeVisible();
    await page.locator('#cmd-list [data-value="action:open-preferences"]').click();
    await expect(page.locator('#modal-preferences')).toBeVisible();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await expect(page.locator('input[name="text-size"][value="large"]')).toBeChecked();

    await expectNoA11yViolations(page);

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

  test('la coque occupe exactement la fenêtre : la page elle-même ne défile pas', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('.cv-shell')).toBeVisible();
    // La marge de 8px du navigateur sur body ajoutait 16px à une coque haute de 100dvh.
    const metrics = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      client: document.documentElement.clientHeight,
      shellTop: document.querySelector('.cv-shell')?.getBoundingClientRect().top,
    }));
    expect(metrics.shellTop).toBe(0);
    expect(metrics.scroll).toBe(metrics.client);
  });

  test('la barre latérale affiche la marque en premier et le sélecteur d’applications en dernier', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });

    const brand = nav.locator('.cv-sidebar__brand');
    await expect(brand).toHaveText('Locavern');
    await expect(brand.locator('i.ph-kanban[aria-hidden="true"]')).toHaveCount(1);
    await expect(brand.locator('svg')).toHaveCount(0);
    await expect(nav.locator(':scope > :first-child')).toHaveClass(/cv-sidebar__brand/);

    // Le sélecteur est le dernier enfant : les trois applications, Locavern étant la courante.
    await expect(nav.locator(':scope > :last-child')).toHaveClass(/swt-switcher/);
    const switcher = nav.getByRole('list', { name: 'Applications' });
    const links = switcher.getByRole('link');
    await expect(links).toHaveText(['Chrono', 'Locavern', 'Transient Notes']);
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toHaveAttribute('href', '../chrono/');
    await expect(links.nth(1)).toHaveAttribute('href', './');
    await expect(links.nth(2)).toHaveAttribute('href', '../transient-notes/');
    await expect(switcher.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(links.nth(1)).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(0)).not.toHaveAttribute('aria-current', 'page');
    await expect(links.nth(2)).not.toHaveAttribute('aria-current', 'page');

    // Les préférences et le thème n’ont plus d’entrée dans la barre latérale.
    await expect(page.locator('#nav-preferences-btn')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Sauvegardes' })).toBeVisible();
  });

  test('l’engrenage est le dernier contrôle de la barre supérieure, après la recherche, et ouvre les préférences', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const topbar = page.locator('header.cv-topbar');

    await expect(topbar.locator('#theme-switch')).toHaveCount(0);
    await expect(topbar.locator('#topbar-backup-btn')).toHaveCount(0);

    // A tooltip is a popover element right after its trigger: it is not a control.
    const controls = topbar.locator(':scope > :not(.lc-tooltip)');
    const gear = controls.last();
    await expect(gear).toHaveAttribute('id', 'topbar-preferences-btn');
    await expect(gear).toHaveAccessibleName('Préférences');
    await expect(gear.locator('i.ph-gear')).toHaveCount(1);
    const search = topbar.locator('.cv-search');
    await expect(controls.nth(-2)).toHaveClass(/cv-search/);
    await expect(search).toBeVisible();

    await gear.click();
    await expect(page.locator('#modal-preferences')).toBeVisible();
    // Le thème est le premier choix visuel des préférences, après la langue.
    await expect(
      page.locator('#modal-preferences fieldset[data-theme-control] input[type="radio"]'),
    ).toHaveCount(3);
    await expect(page.locator('input[name="theme"][value="system"]')).toBeChecked();
  });

  test('choisir Sombre dans les préférences applique le thème, le conserve au rechargement et reste synchronisé avec la palette', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await openPreferences(page);
    await page.locator('input[name="theme"][value="dark"]').check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('locavern-color-scheme'))).toBe('dark');
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await openPreferences(page);
    await expect(page.locator('input[name="theme"][value="dark"]')).toBeChecked();

    // Système : la clé de stockage disparaît et le thème suit l’OS (clair par défaut).
    await page.locator('input[name="theme"][value="system"]').check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('locavern-color-scheme'))).toBeNull();

    // La palette de commandes bascule le thème et le contrôle suit.
    await page.locator('#modal-preferences [data-cv-close]').first().click();
    await page.keyboard.press('Control+k');
    await page.locator('#cmd-list [data-value="action:toggle-theme"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await openPreferences(page);
    await expect(page.locator('input[name="theme"][value="dark"]')).toBeChecked();
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
    await expectNoA11yViolations(page);
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
