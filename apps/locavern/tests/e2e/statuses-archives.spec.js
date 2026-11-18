import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Statuts initiaux/terminaux, garde de liens et archivage complet', () => {
  test('identifie statuts initiaux/terminaux et empêche les nouveaux liens avec un statut terminal', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer un projet, une note et deux tâches
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Rôles');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Note Référence');
    await page.locator('#dialog-note button[type="submit"]').click();

    await page.locator('[data-nav-view="tasks"]').click();

    // Tâche A (statut initial par défaut "todo" -> badge Initial)
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Initiale');
    await expect(page.locator('#task-status-role-badge')).toHaveText('Initial');
    const noteOptVal = await page
      .locator('#task-links-select option', { hasText: 'Note Référence' })
      .getAttribute('value');
    expect(noteOptVal).toBeTruthy();
    await page.locator('#task-links-select').selectOption(/** @type {string} */ (noteOptVal));
    await page.locator('#task-links-add').click();
    await page.locator('#drawer-task button[type="submit"]').click();

    // Tâche B (pour vérifier la liste des cibles)
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Seconde');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Vérifier les badges Initial et Terminal en Liste puis en Kanban
    const rowInitial = page.locator('tr', { hasText: 'Tâche Initiale' });
    await expect(rowInitial.locator('[data-status-role="initial"]')).toHaveText('Initial');

    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(
      page.locator('[data-kanban-status="todo"] [data-status-role="initial"]'),
    ).toHaveText('Initial');
    await expect(
      page.locator('[data-kanban-status="done"] [data-status-role="terminal"]'),
    ).toHaveText('Terminal');

    // Configurer un nouveau statut terminal personnalisé "Validé"
    await page.locator('#btn-configure-statuses').click();
    const statusModal = page.locator('#modal-statuses');
    await statusModal.locator('#new-status-label-input').fill('Validé');
    await statusModal.locator('#new-status-role-select').selectOption('terminal');
    await statusModal.locator('#btn-add-status').click();
    await statusModal.locator('#btn-save-statuses').click();
    await expect(statusModal).toBeHidden();

    await expect(
      page.locator('[data-kanban-status="valide"] [data-status-role="terminal"]'),
    ).toHaveText('Terminal');

    // Passer "Tâche Initiale" vers le statut terminal "Validé" depuis son tiroir (consultation -> modification)
    await page.getByRole('button', { name: 'Tâche Initiale', exact: true }).click();
    await expect(page.locator('#task-consult-view')).toBeVisible();
    await page.locator('#btn-switch-task-edit').click();
    await page.locator('#task-status-select').selectOption('valide');
    await expect(page.locator('#task-status-role-badge')).toHaveText('Terminal');
    await expect(page.locator('#task-links-select')).toBeDisabled();
    await expect(page.locator('#task-links-add')).toBeDisabled();
    await expect(page.locator('#task-links-terminal-hint')).toBeVisible();
    // Le lien existant reste consultable et même supprimable
    await expect(page.locator('#task-links-list')).toContainText('Note Référence');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Tâche Seconde ne doit plus pouvoir sélectionner "Tâche Initiale" (désormais terminale) comme cible
    await page.getByRole('button', { name: 'Tâche Seconde', exact: true }).click();
    await expect(page.locator('#task-consult-view')).toBeVisible();
    await page.locator('#btn-switch-task-edit').click();
    await expect(page.locator('#task-links-select')).not.toContainText('Tâche Initiale');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // La note affiche le rétrolien historique en consultation et exclut "Tâche Initiale" en modification
    await page.locator('[data-nav-view="notes"]').click();
    await expect(page.locator('#note-links-backlinks')).toContainText('Tâche Initiale');
    await expect(page.locator('#note-links-backlinks')).toContainText('Terminal');
    await page.locator('#btn-switch-note-edit').click();
    await expect(page.locator('#note-links-select')).not.toContainText('Tâche Initiale');
  });

  test('archive tâches, notes, tableaux blancs et projets, masque des écrans habituels et filtre dans Archives (WCAG 2.2 AA)', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer 2 projets et différents éléments
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Alpha');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('[data-nav-view="projects"]').click();
    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Projet Beta');
    await page.locator('#modal-project button[type="submit"]').click();

    // Tâche dans Projet Alpha avec étiquette #compta
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Clôture mensuelle');
    await page.locator('#task-project-select').selectOption({ label: 'Projet Alpha' });
    await page.locator('#task-tags-input').fill('compta');
    await page.locator('#task-tags-add').click();
    await page.locator('#drawer-task button[type="submit"]').click();

    // Note dans Projet Beta avec étiquette #note
    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Mémo fiscal');
    await page.locator('#note-dialog-project-select').selectOption({ label: 'Projet Beta' });
    await page.locator('#dialog-note button[type="submit"]').click();

    // Tableau blanc dans Projet Beta
    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Schéma Bilan');
    await page.locator('#whiteboard-dialog-project-select').selectOption({ label: 'Projet Beta' });
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    // Archiver la note et le tableau blanc directement depuis leurs vues (passage en modification pour la note)
    await page.locator('#btn-archive-whiteboard').click();
    await expect(page.locator('#whiteboard-title-input')).toHaveCount(0);

    await page.locator('[data-nav-view="notes"]').click();
    await page.locator('#btn-switch-note-edit').click();
    await page.locator('#btn-archive-note').click();
    await expect(page.locator('#note-title-input')).toHaveCount(0);

    // Archiver Projet Alpha (masque aussi sa tâche "Clôture mensuelle")
    await page.locator('[data-nav-view="projects"]').click();
    await page.getByRole('button', { name: 'Archiver Projet Alpha' }).click();
    await expect(page.getByRole('heading', { name: 'Projet Alpha' })).toHaveCount(0);

    await page.locator('[data-nav-view="tasks"]').click();
    await expect(page.getByRole('button', { name: 'Clôture mensuelle' })).toHaveCount(0);

    // Vérifier aussi que la palette de commandes n'affiche pas les éléments archivés
    await page.locator('[data-cv-open="cmd-menu"]').click();
    await page.locator('#cmd-menu .cv-cmd__input').fill('Clôture');
    await expect(page.locator('#cmd-list')).not.toContainText('Clôture mensuelle');
    await page.keyboard.press('Escape');

    // Ouvrir l'écran Archives et vérifier le compteur de navigation
    await expect(page.locator('#nav-archives-count')).toHaveText('4');
    await page.locator('[data-nav-view="archives"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Archives');
    await expect(page.locator('[data-archive-entry]')).toHaveCount(4);

    // Filtrer par type = Note, puis par étiquette = compta, puis par recherche
    await page.locator('#archives-kind-filter').selectOption('note');
    await expect(page.locator('.lc-archives-list')).toContainText('Mémo fiscal');
    await expect(page.locator('[data-archive-entry]')).toHaveCount(1);

    await page.locator('#btn-archives-reset-filters').click();
    await page.locator('#archives-tag-filter').selectOption('compta');
    await expect(page.locator('.lc-archives-list')).toContainText('Clôture mensuelle');
    await expect(page.locator('#archive-detail-panel')).toContainText(
      'Archivé via le projet « Projet Alpha »',
    );

    // WCAG 2.2 AA en thème clair et sombre + reflow 320 px sur Archives
    const archLightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(archLightAxe.violations).toEqual([]);

    await page.locator('#theme-switch').click();
    const archDarkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(archDarkAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Désarchiver la tâche "Clôture mensuelle" -> réactive aussi Projet Alpha
    await page.locator('#btn-archive-restore').click();
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#task-project-filter').selectOption('');
    await expect(
      page.getByRole('button', { name: 'Clôture mensuelle', exact: true }),
    ).toBeVisible();
    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.getByRole('heading', { name: 'Projet Alpha' })).toBeVisible();

    // Envoyer un élément archivé vers la corbeille depuis Archives
    await page.locator('[data-nav-view="archives"]').click();
    await page.locator('#archives-kind-filter').selectOption('note');
    await page.locator('#btn-archive-delete').click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Mettre à la corbeille' })
      .click();
    await expect(page.locator('#nav-trash-count')).toHaveText('1');
  });

  test('les tuiles de la liste Archives ne se compriment pas ni ne chevauchent leur texte quand la liste déborde', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Créer un projet et 8 éléments variés (note, tableau blanc, tâches à titres longs)
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Locavern');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Nouvelle note');
    await page.locator('#note-dialog-project-select').selectOption({ label: 'Locavern' });
    await page.locator('#dialog-note button[type="submit"]').click();

    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Nouveau tableau blanc');
    await page.locator('#whiteboard-dialog-project-select').selectOption({ label: 'Locavern' });
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    await page.locator('[data-nav-view="tasks"]').click();
    const taskTitles = [
      'Mieux profiter de la largeur de l’écran',
      'Implémenter tableau blanc',
      'Sauvegarder et charger un dessin',
      'Ajouter bouton ouvrir les notes',
      'Les toasts doivent se fermer automatiquement',
      'Pouvoir choisir le type d’éditeur pour les tâches',
    ];
    for (const title of taskTitles) {
      await page.locator('#btn-new-task').click();
      await page.locator('#task-title-input').fill(title);
      await page.locator('#task-project-select').selectOption({ label: 'Locavern' });
      await page.locator('#drawer-task button[type="submit"]').click();
    }

    // Archiver le projet (archive ainsi les 9 éléments)
    await page.locator('[data-nav-view="projects"]').click();
    await page.getByRole('button', { name: 'Archiver Locavern' }).click();

    await page.locator('[data-nav-view="archives"]').click();
    await expect(page.locator('[data-archive-entry]')).toHaveCount(9);

    const metrics = await page.evaluate(() => {
      const list = document.querySelector('.lc-archives-list');
      if (!list) throw new Error('Missing .lc-archives-list');
      const items = [...list.querySelectorAll('.lc-archive-item')];
      const listRect = list.getBoundingClientRect();
      const itemStats = items.map((item) => {
        const rect = item.getBoundingClientRect();
        const children = [...item.children].map((child) => {
          const cRect = child.getBoundingClientRect();
          return {
            className: child.className,
            top: cRect.top,
            bottom: cRect.bottom,
            left: cRect.left,
            right: cRect.right,
          };
        });
        return {
          text: item.textContent?.trim() ?? '',
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          clientHeight: item.clientHeight,
          scrollHeight: item.scrollHeight,
          children,
        };
      });
      return {
        listClientHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
        listTop: listRect.top,
        listBottom: listRect.bottom,
        itemStats,
      };
    });

    // La liste doit défiler verticalement au lieu d'écraser ses tuiles
    expect(metrics.listScrollHeight).toBeGreaterThan(metrics.listClientHeight);

    /** @type {(typeof metrics.itemStats)[number] | null} */
    let prev = null;
    for (const [i, item] of metrics.itemStats.entries()) {
      // Aucun débordement interne du texte hors de sa tuile
      expect(item.scrollHeight, `Tuile #${i} (${item.text}) déborde`).toBeLessThanOrEqual(
        item.clientHeight + 1,
      );
      for (const child of item.children) {
        expect(
          child.top,
          `Enfant ${child.className} de la tuile #${i} dépasse en haut`,
        ).toBeGreaterThanOrEqual(item.top - 0.5);
        expect(
          child.bottom,
          `Enfant ${child.className} de la tuile #${i} dépasse en bas`,
        ).toBeLessThanOrEqual(item.bottom + 0.5);
      }
      if (prev) {
        expect(item.top, `Tuile #${i} chevauche la tuile #${i - 1}`).toBeGreaterThanOrEqual(
          prev.bottom - 0.5,
        );
      }
      prev = item;
    }
  });
});
