import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Projets, Tâches (Liste & Kanban) et accessibilité (Étape 4)', () => {
  test('cycle complet projets, tâches, vue liste, Kanban D&D + clavier et axe-core', async ({
    page,
  }) => {
    await page.goto('/');

    // État initial sans projet
    await expect(page.getByText('Créez un premier projet pour commencer')).toBeVisible();

    // Créer une note sans projet pour vérifier ensuite le filtrage par projet depuis une carte
    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Note hors projet');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Note hors projet');

    // Aller dans Projets et créer un projet
    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Projets');

    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Refonte site');
    await page.locator('#project-desc-input').fill('Projet vitrine local');
    await page.locator('#modal-project button[type="submit"]').click();

    await expect(page.getByRole('heading', { name: 'Refonte site' })).toBeVisible();

    // Modifier puis archiver/désarchiver le projet
    await page.getByRole('button', { name: 'Modifier Refonte site' }).click();
    await page.locator('#project-name-input').fill('Refonte web');
    await page.locator('#modal-project button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: 'Refonte web' })).toBeVisible();

    await page.getByRole('button', { name: 'Archiver Refonte web' }).click();
    await expect(page.getByRole('heading', { name: 'Refonte web' })).toHaveCount(0);
    await page.locator('[data-nav-view="archives"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Archives');
    await expect(page.locator('.lc-archives-list')).toContainText('Refonte web');
    await page.locator('#btn-archive-restore').click();
    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.getByRole('heading', { name: 'Refonte web' })).toBeVisible();

    // Accessibilité WCAG 2.2 AA et reflow 320 px sur la vue Projets (boutons Tâches + Notes + Tableaux blancs + filtre Actifs/Archivés)
    const projectsLightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(projectsLightAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const projectsOverflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(projectsOverflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Ouvrir les notes du projet depuis la card et vérifier le filtre projet
    await page.getByRole('button', { name: 'Ouvrir les notes de Refonte web' }).click();
    await expect(page.locator('#topbar-title')).toHaveText('Notes');
    const selectedFilterLabel = await page
      .locator('#notes-project-filter option:checked')
      .textContent();
    expect(selectedFilterLabel).toBe('Refonte web');
    await expect(page.getByText('Aucune note disponible')).toBeVisible();
    await expect(page.locator('.lc-notes-list')).toHaveCount(0);

    await page.getByRole('button', { name: 'Créer une note' }).click();
    await expect(page.locator('#dialog-note')).toBeVisible();
    const noteProjLabel = await page
      .locator('#note-dialog-project-select option:checked')
      .textContent();
    expect(noteProjLabel).toBe('Refonte web');
    await page.locator('#note-dialog-title-input').fill('Note cadrage');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Note cadrage');
    await expect(page.locator('.lc-notes-list')).not.toContainText('Note hors projet');

    // Revenir aux Projets et ouvrir les tâches du projet
    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Projets');
    await page.getByRole('button', { name: 'Ouvrir les tâches de Refonte web' }).click();
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');

    // Créer 2 tâches via le Drawer
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Maquette accueil');
    await page.locator('#task-priority-select').selectOption('high');
    await page.locator('#task-due-input').fill('2026-12-01');
    await page.locator('#task-checklist-new').fill('Valider entête');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.locator('#drawer-task .ProseMirror').click();
    await page.keyboard.type('Description détaillée');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tests E2E');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Vérifier DataTable et sa région défilable focalisable en vue Liste
    const tableWrap = page.locator('.cv-table-wrap');
    await expect(tableWrap).toHaveAttribute('role', 'region');
    await expect(tableWrap).toHaveAttribute('aria-labelledby', 'task-table-caption');
    await expect(tableWrap).toHaveAttribute('tabindex', '0');
    await expect(page.locator('table.cv-table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maquette accueil', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tests E2E', exact: true })).toBeVisible();

    // Reflow 320 px sur la vue Liste (seule .cv-table-wrap peut défiler horizontalement)
    await page.setViewportSize({ width: 320, height: 640 });
    const listOverflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(listOverflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Filtrer par recherche dans la vue Liste
    await page.locator('#list-search-input').fill('Maquette');
    await expect(page.getByRole('button', { name: 'Maquette accueil', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tests E2E', exact: true })).toHaveCount(0);
    await page.locator('#list-search-input').fill('');

    // Basculer en vue Kanban
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(page.locator('.lc-kanban')).toBeVisible();

    const todoCol = page.locator('[data-kanban-status="todo"]');
    const inProgressCol = page.locator('[data-kanban-status="in_progress"]');
    const doneCol = page.locator('[data-kanban-status="done"]');

    await expect(todoCol.getByText('Maquette accueil')).toBeVisible();
    await expect(todoCol.getByText('Tests E2E')).toBeVisible();

    // Déplacement accessible au clavier via Menu Covenant
    await page.getByRole('button', { name: 'Actions pour « Maquette accueil »' }).click();
    await page.getByRole('menuitem', { name: 'Déplacer vers En cours' }).click();
    await expect(inProgressCol.getByText('Maquette accueil')).toBeVisible();

    // Déplacement par Drag & Drop natif HTML
    const dragCard = todoCol.locator('[data-kanban-task-id]', { hasText: 'Tests E2E' });
    await dragCard.dragTo(doneCol);
    await expect(doneCol.getByText('Tests E2E')).toBeVisible();

    // Accessibilité WCAG 2.2 AA en clair et sombre sur Kanban
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

    // Reflow 320 px
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    // Suppression de projet avec confirmation modale (et axe-core en thème sombre sur Projets)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-nav-view="projects"]').click();
    const projectsDarkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(projectsDarkAxe.violations).toEqual([]);
    await page.getByRole('button', { name: 'Supprimer Refonte web' }).click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Supprimer le projet' })
      .click();
    await expect(page.getByText('Aucun projet pour le moment')).toBeVisible();
  });

  test('statuts Kanban paramétrables, tâches sans statut ou au statut inconnu dans la liste et réassignation', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer un projet
    await page.locator('[data-nav-view="projects"]').click();
    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Projet Kanban');
    await page.locator('#modal-project button[type="submit"]').click();
    await page.getByRole('button', { name: 'Ouvrir les tâches de Projet Kanban' }).click();

    // Créer 3 tâches : "Tâche standard" (À faire), "Tâche en cours" (En cours), "Tâche sans statut" (Sans statut)
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche standard');
    await page.locator('#task-status-select').selectOption('todo');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche en cours');
    await page.locator('#task-status-select').selectOption('in_progress');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche sans statut');
    await page.locator('#task-status-select').selectOption('');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Basculer en vue Kanban : la tâche sans statut n'apparaît pas sur le tableau
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(page.locator('[data-kanban-status="todo"]')).toContainText('Tâche standard');
    await expect(page.locator('[data-kanban-status="in_progress"]')).toContainText(
      'Tâche en cours',
    );
    await expect(page.locator('.lc-kanban')).not.toContainText('Tâche sans statut');

    // Ouvrir le paramétrage des statuts
    await page.locator('#btn-configure-statuses').click();
    const statusModal = page.locator('#modal-statuses');
    await expect(statusModal).toBeVisible();

    // Vérifier WCAG 2.2 AA sur la modale de configuration des statuts
    const modalAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(modalAxe.violations).toEqual([]);

    // Renommer "À faire" -> "À traiter", ajouter "En revue", monter "En revue" avant "Terminé", et supprimer "En cours"
    await statusModal.getByLabel('Libellé du statut 1').fill('À traiter');
    await statusModal.locator('#new-status-label-input').fill('En revue');
    await statusModal.locator('#btn-add-status').click();
    await statusModal.getByRole('button', { name: 'Monter le statut En revue' }).click();
    await statusModal.getByRole('button', { name: 'Supprimer le statut En cours' }).click();
    await statusModal.locator('#btn-save-statuses').click();
    await expect(statusModal).toBeHidden();

    // Dans le Kanban : colonnes "À traiter", "En revue", "Terminé"
    // Ni "Tâche en cours" (statut supprimé) ni "Tâche sans statut" n'apparaissent dans le Kanban
    const colHeadings = page.locator('.lc-kanban__col-title');
    await expect(colHeadings).toHaveText(['À traiter', 'En revue', 'Terminé']);
    await expect(page.locator('[data-kanban-status="todo"]')).toContainText('Tâche standard');
    await expect(page.locator('.lc-kanban')).not.toContainText('Tâche en cours');
    await expect(page.locator('.lc-kanban')).not.toContainText('Tâche sans statut');

    // Basculer en vue Liste : les 3 tâches sont visibles, avec identification visuelle des statuts inconnu / manquant
    await page.locator('input[name="task-display-mode"][value="list"]').check();
    await expect(page.locator('table.cv-table')).toBeVisible();

    const unknownRow = page.locator('tr', { hasText: 'Tâche en cours' });
    const missingRow = page.locator('tr', { hasText: 'Tâche sans statut' });
    const knownRow = page.locator('tr', { hasText: 'Tâche standard' });

    await expect(unknownRow).toHaveAttribute('data-status-unknown', 'true');
    await expect(unknownRow.locator('[data-status-badge="unknown"]')).toContainText(
      'Statut inconnu (En cours)',
    );
    await expect(missingRow).toHaveAttribute('data-status-unknown', 'true');
    await expect(missingRow.locator('[data-status-badge="missing"]')).toContainText('Sans statut');
    await expect(knownRow).not.toHaveAttribute('data-status-unknown', 'true');
    await expect(knownRow.locator('[data-status-badge="known"]')).toContainText('À traiter');

    // Vérifier WCAG 2.2 AA en thème clair et sombre + reflow 320 px sur la liste avec badges d'alerte
    const listLightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(listLightAxe.violations).toEqual([]);

    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const listDarkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(listDarkAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Filtrer par "Statut inconnu" puis "Sans statut"
    await page.locator('#list-status-filter').selectOption('__unknown__');
    await expect(page.getByRole('button', { name: 'Tâche en cours', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tâche sans statut', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: 'Tâche standard', exact: true })).toHaveCount(0);

    await page.locator('#list-status-filter').selectOption('__none__');
    await expect(
      page.getByRole('button', { name: 'Tâche sans statut', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tâche en cours', exact: true })).toHaveCount(0);

    await page.locator('#list-status-filter').selectOption('all');

    // Réassigner "Tâche en cours" au nouveau statut "En revue" depuis le sélecteur rapide de la liste
    const quickSelect = unknownRow.getByLabel('Changer le statut de « Tâche en cours »');
    await quickSelect.selectOption({ label: 'En revue' });
    await expect(unknownRow).not.toHaveAttribute('data-status-unknown', 'true');
    await expect(unknownRow.locator('[data-status-badge="known"]')).toContainText('En revue');

    // Retourner sur le Kanban : "Tâche en cours" est maintenant dans la colonne "En revue"
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(page.locator('[data-kanban-status="en_revue"]')).toContainText('Tâche en cours');
  });

  test('archivage déplacé vers Archives et raccourci Ouvrir les tableaux blancs sur les cartes projet', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="projects"]').click();

    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Projet Actif');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Projet Archive');
    await page.locator('#modal-project button[type="submit"]').click();
    await page.getByRole('button', { name: 'Archiver Projet Archive' }).click();

    // Projet Archive n'est plus visible dans Projets
    await expect(page.getByRole('heading', { name: 'Projet Actif' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projet Archive' })).toHaveCount(0);

    // Projet Archive est visible et filtrable dans Archives, puis désarchivable
    await page.locator('[data-nav-view="archives"]').click();
    await expect(page.locator('.lc-archives-list')).toContainText('Projet Archive');
    await page.locator('#btn-archive-restore').click();
    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.getByRole('heading', { name: 'Projet Actif' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projet Archive' })).toBeVisible();

    // Raccourci Ouvrir les tableaux blancs
    await page.getByRole('button', { name: 'Ouvrir les tableaux blancs de Projet Actif' }).click();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    const wbProjectLabel = await page
      .locator('#whiteboards-project-filter option:checked')
      .textContent();
    expect(wbProjectLabel).toBe('Projet Actif');
  });

  test('filtres priorité/échéance sur le Kanban et signalement avec réassignation des tâches hors colonnes', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Kanban avancé');
    await page.locator('#modal-project button[type="submit"]').click();

    // Tâche priorité haute en retard
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Urgence retard');
    await page.locator('#task-priority-select').selectOption('high');
    await page.locator('#task-due-input').fill('2020-01-10');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Tâche sans échéance priorité basse
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche libre');
    await page.locator('#task-priority-select').selectOption('low');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Tâche sans statut
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche orpheline');
    await page.locator('#task-status-select').selectOption('');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Basculer sur le Kanban
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();

    // Le bandeau d’alerte signale la tâche hors colonnes
    const unmappedAlert = page.locator('#kanban-unmapped-alert');
    await expect(unmappedAlert).toBeVisible();
    await expect(unmappedAlert).toContainText('Tâche orpheline');
    await expect(unmappedAlert).toContainText('Sans statut');
    await expect(page.locator('.lc-kanban')).not.toContainText('Tâche orpheline');

    // Filtrer par priorité haute puis par échéance "En retard" / "Sans échéance"
    await page.locator('#kanban-priority-filter').selectOption('high');
    await expect(page.locator('.lc-kanban')).toContainText('Urgence retard');
    await expect(page.locator('.lc-kanban')).not.toContainText('Tâche libre');

    await page.locator('#kanban-priority-filter').selectOption('all');
    await page.locator('#kanban-due-filter').selectOption('undated');
    await expect(page.locator('.lc-kanban')).toContainText('Tâche libre');
    await expect(page.locator('.lc-kanban')).not.toContainText('Urgence retard');
    await page.locator('#kanban-due-filter').selectOption('all');

    // Réassigner la tâche sans statut directement depuis le bandeau vers "En cours"
    await unmappedAlert
      .getByLabel('Assigner une colonne à « Tâche orpheline »')
      .selectOption('in_progress');
    await expect(unmappedAlert).toHaveCount(0);
    await expect(page.locator('[data-kanban-status="in_progress"]')).toContainText(
      'Tâche orpheline',
    );

    // Ajout rapide en haut d'une colonne Kanban ("Terminé") via Entrée
    const doneQuickInput = page.locator('#kanban-quick-add-done');
    await doneQuickInput.fill('Ajout rapide Kanban');
    await doneQuickInput.press('Enter');
    await expect(page.locator('[data-kanban-status="done"]')).toContainText('Ajout rapide Kanban');

    // Basculer en vue Liste et tester l'ajout rapide en tête de Liste
    await page.locator('input[name="task-display-mode"][value="list"]').check();
    const listQuickInput = page.locator('#list-quick-add-input');
    await listQuickInput.fill('Ajout rapide Liste');
    await listQuickInput.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Ajout rapide Liste', exact: true }),
    ).toBeVisible();
  });

  test('mise en évidence visuelle des tâches en retard, du jour et de la semaine en Liste et Kanban', async ({
    page,
  }) => {
    const offsetIso = (/** @type {number} */ d) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const yesterday = offsetIso(-2);
    const today = offsetIso(0);
    const inThreeDays = offsetIso(3);

    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Suivi échéances');
    await page.locator('#modal-project button[type="submit"]').click();

    for (const [title, due] of /** @type {const} */ ([
      ['Tâche retard', yesterday],
      ['Tâche jour', today],
      ['Tâche semaine', inThreeDays],
    ])) {
      await page.locator('#btn-new-task').click();
      await page.locator('#task-title-input').fill(title);
      await page.locator('#task-due-input').fill(due);
      await page.locator('#drawer-task button[type="submit"]').click();
    }

    // Liste : attributs & badges d'urgence visibles
    await expect(page.locator('tr', { hasText: 'Tâche retard' })).toHaveAttribute(
      'data-due-urgency',
      'overdue',
    );
    await expect(page.locator('tr', { hasText: 'Tâche retard' })).toContainText('En retard');
    await expect(page.locator('tr', { hasText: 'Tâche jour' })).toHaveAttribute(
      'data-due-urgency',
      'today',
    );
    await expect(page.locator('tr', { hasText: 'Tâche jour' })).toContainText('Aujourd’hui');
    await expect(page.locator('tr', { hasText: 'Tâche semaine' })).toHaveAttribute(
      'data-due-urgency',
      'this_week',
    );
    await expect(page.locator('tr', { hasText: 'Tâche semaine' })).toContainText('Cette semaine');

    // Kanban : cartes soulignées & badgées
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(
      page.locator('[data-kanban-task-id]', { hasText: 'Tâche retard' }),
    ).toHaveAttribute('data-due-urgency', 'overdue');
    await expect(page.locator('[data-kanban-task-id]', { hasText: 'Tâche jour' })).toHaveAttribute(
      'data-due-urgency',
      'today',
    );
    await expect(
      page.locator('[data-kanban-task-id]', { hasText: 'Tâche semaine' }),
    ).toHaveAttribute('data-due-urgency', 'this_week');

    const axeLight = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeLight.violations).toEqual([]);
  });
});
