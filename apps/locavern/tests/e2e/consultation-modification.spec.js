import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Helper: format current month day in YYYY-MM-DD for Calendar tests.
 * @param {number} deltaDays
 */
function isoTodayOffset(deltaDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Choix explicite Consultation vs Modification sur tous les éléments', () => {
  test('projets, tâches (Liste/Kanban/Aujourd’hui/Calendrier), notes et tableaux blancs distinguent consultation et modification (WCAG 2.2 AA)', async ({
    page,
  }) => {
    const todayIso = isoTodayOffset(0);

    await page.goto('/');

    // 1. Création -> entre immédiatement en Modification
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await expect(page.locator('#modal-project-title')).toHaveText('Nouveau projet');
    await page.locator('#project-name-input').fill('Projet Mode Lecture');
    await page.locator('#project-desc-input').fill('Description du projet local');
    await page.locator('#modal-project button[type="submit"]').click();

    // Créer 2 notes (pour tester sélection consultation vs crayon modification + duplication)
    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Note Principale');
    await page.locator('#note-dialog-tags-input').fill('spec');
    await page.locator('#note-dialog-tags-add').click();
    await page.locator('#dialog-note .ProseMirror').click();
    await page.keyboard.type('Corps enrichi en lecture');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Note Principale');
    await page.locator('#btn-save-note').click();

    await page.locator('#btn-new-note').click();
    await page.locator('#note-dialog-title-input').fill('Note Secondaire');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Note Secondaire');

    // Créer 2 tableaux blancs avec au moins un élément SVG
    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Canevas Architecture');
    await page.locator('#whiteboard-dialog-template-select').selectOption('builtin-wb-flow');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Canevas Architecture');
    await page.locator('#btn-save-whiteboard').click();

    // Créer une tâche datée (avec checklist, description, étiquette, lien) et une tâche sans date
    await page.locator('[data-nav-view="tasks"]').click();
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Complète');
    await page.locator('#task-due-input').fill(todayIso);
    await page.locator('#task-tags-input').fill('audit');
    await page.locator('#task-tags-add').click();
    const noteLinkVal = await page
      .locator('#task-links-select option', { hasText: 'Note Principale' })
      .getAttribute('value');
    expect(noteLinkVal).toBeTruthy();
    await page.locator('#task-links-select').selectOption(String(noteLinkVal));
    await page.locator('#task-links-add').click();
    await page.locator('#task-checklist-new').fill('Étape vérifiée');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.locator('.lc-checklist__row input[type="checkbox"]').check();
    await page.locator('#drawer-task .ProseMirror').click();
    await page.keyboard.type('Détail non éditable en consultation');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Sans Date');
    await page.locator('#drawer-task button[type="submit"]').click();

    // 2. Vue Projets : boutons explicites Consulter et Modifier + bascule interne
    await page.locator('[data-nav-view="projects"]').click();
    await page.getByRole('button', { name: 'Consulter Projet Mode Lecture' }).click();
    await expect(page.locator('#modal-project-title')).toHaveText('Consulter le projet');
    await expect(page.locator('#project-consult-view')).toBeVisible();
    await expect(page.locator('#project-consult-view')).toContainText(
      'Description du projet local',
    );
    await expect(page.locator('#modal-project input, #modal-project textarea')).toHaveCount(0);
    await expect(page.locator('#modal-project button[type="submit"]')).toHaveCount(0);

    // Bascule Consultation -> Modification -> Consultation dans la modale Projet
    await page.locator('#btn-switch-project-edit').click();
    await expect(page.locator('#modal-project-title')).toHaveText('Modifier le projet');
    await expect(page.locator('#project-name-input')).toHaveValue('Projet Mode Lecture');
    await page.locator('#btn-switch-project-view').click();
    await expect(page.locator('#modal-project-title')).toHaveText('Consulter le projet');
    await expect(page.locator('#project-consult-view')).toBeVisible();
    await page.locator('#modal-project [data-cv-close]').first().click();

    // Ouvrir directement en Modification depuis la carte Projet
    await page.getByRole('button', { name: 'Modifier Projet Mode Lecture' }).click();
    await expect(page.locator('#modal-project-title')).toHaveText('Modifier le projet');
    await expect(page.locator('#project-name-input')).toBeVisible();
    await page.locator('#modal-project [data-cv-close]').first().click();

    // 3. Vue Tâches (Liste) : Consulter vs Modifier + contenu lecture seule pur
    await page.locator('[data-nav-view="tasks"]').click();
    await page.getByRole('button', { name: 'Consulter « Tâche Complète »' }).click();
    const drawer = page.locator('#drawer-task');
    await expect(drawer).toBeVisible();
    await expect(page.locator('#drawer-task-title')).toHaveText('Consulter la tâche');
    const consultTask = page.locator('#task-consult-view');
    await expect(consultTask).toBeVisible();
    await expect(consultTask).toContainText('Tâche Complète');
    await expect(consultTask).toContainText('#audit');
    await expect(consultTask).toContainText('Note Principale');
    await expect(consultTask).toContainText('Liste de contrôle (1/1)');
    await expect(consultTask).toContainText('Étape vérifiée');
    await expect(consultTask).toContainText('Détail non éditable en consultation');

    // Zéro outil de modification dans la consultation de tâche
    await expect(drawer.locator('input, select, textarea, [contenteditable="true"]')).toHaveCount(
      0,
    );
    await expect(drawer.locator('.lc-editor__toolbar, .lc-template-bar')).toHaveCount(0);
    await expect(drawer.locator('button[type="submit"], #btn-archive-task')).toHaveCount(0);
    await expect(page.locator('button[title]')).toHaveCount(0);

    // WCAG 2.2 AA sur Tâche en Consultation (thème clair)
    const taskConsultAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(taskConsultAxe.violations).toEqual([]);

    // Bascule Consulter -> Modifier -> Consulter puis fermeture
    await page.locator('#btn-switch-task-edit').click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Modifier la tâche');
    await expect(page.locator('#task-title-input')).toHaveValue('Tâche Complète');
    await page.locator('#btn-switch-task-view').click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Consulter la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // Ouvrir directement en Modification depuis le bouton Modifier de la ligne
    await page.getByRole('button', { name: 'Modifier « Tâche Complète »' }).click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Modifier la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // 4. Vue Kanban : titre -> Consulter, menu -> Consulter / Modifier
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await page.locator('.lc-kanban__card-title-btn', { hasText: 'Tâche Complète' }).click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Consulter la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    await page.getByRole('button', { name: 'Actions pour « Tâche Complète »' }).click();
    await expect(page.getByRole('menuitem', { name: 'Consulter' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Modifier' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Modifier' }).click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Modifier la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // 5. Vue Aujourd’hui : clic principal -> Consulter, bouton crayon -> Modifier
    await page.locator('[data-nav-view="today"]').click();
    await page
      .locator('#today-upcoming-section .lc-today-item__btn', { hasText: 'Tâche Complète' })
      .first()
      .click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Consulter la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    await page
      .locator('#today-upcoming-section')
      .getByRole('button', { name: 'Modifier « Tâche Complète »' })
      .first()
      .click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Modifier la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    await page
      .locator('#today-recent-section')
      .getByRole('button', { name: 'Modifier « Note Principale »' })
      .click();
    await expect(page.locator('#topbar-title')).toHaveText('Notes');
    await expect(page.locator('section[aria-label="Éditeur de note"]')).toBeVisible();
    await expect(page.locator('#note-title-input')).toHaveValue('Note Principale');

    // Quitter et revenir sur Notes -> repasse en Consultation par défaut
    await page.locator('[data-nav-view="today"]').click();
    await page
      .locator('#today-recent-section .lc-today-item__btn', { hasText: 'Note Principale' })
      .click();
    await expect(page.locator('#topbar-title')).toHaveText('Notes');
    await expect(page.locator('section[aria-label="Consultation de note"]')).toBeVisible();
    await expect(page.locator('#note-consult-title')).toHaveText('Note Principale');

    // 6. Vue Calendrier : carte et puce sans date -> Consulter, bouton crayon -> Modifier
    await page.locator('[data-nav-view="calendar"]').click();
    const todayCell = page.locator(`[data-cal-date="${todayIso}"]`);
    await todayCell.locator('.lc-cal-task__btn', { hasText: 'Tâche Complète' }).click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Consulter la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    await todayCell.getByRole('button', { name: 'Modifier « Tâche Complète »' }).click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Modifier la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    await page
      .locator('.lc-cal-undated')
      .getByRole('button', { name: 'Tâche Sans Date', exact: true })
      .click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Consulter la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    await page
      .locator('.lc-cal-undated')
      .getByRole('button', { name: 'Modifier « Tâche Sans Date »' })
      .click();
    await expect(page.locator('#drawer-task-title')).toHaveText('Modifier la tâche');
    await page.locator('#drawer-task [data-cv-close]').first().click();

    // 7. Vue Notes : séparation stricte Consultation / Modification + dialogue + duplication
    await page.locator('[data-nav-view="notes"]').click();
    await page.locator('.lc-notes-list .lc-note-item', { hasText: 'Note Principale' }).click();
    const noteConsultPanel = page.locator('section[aria-label="Consultation de note"]');
    await expect(noteConsultPanel).toBeVisible();
    await expect(page.locator('#note-consult-title')).toHaveText('Note Principale');
    await expect(noteConsultPanel).toContainText('Corps enrichi en lecture');
    await expect(noteConsultPanel).toContainText('#spec');

    // Aucun outil d’édition, aucune saisie, aucune barre de modèles ou suppression en Consultation
    await expect(
      noteConsultPanel.locator('input, select, textarea, [contenteditable="true"]'),
    ).toHaveCount(0);
    await expect(noteConsultPanel.locator('.lc-editor__toolbar, .lc-template-bar')).toHaveCount(0);
    await expect(
      noteConsultPanel.locator('#btn-save-note, #btn-delete-note, #btn-archive-note'),
    ).toHaveCount(0);
    await expect(noteConsultPanel.locator('.ProseMirror')).toHaveAttribute('role', 'region');
    await expect(noteConsultPanel.locator('#btn-export-note-md')).toBeVisible();
    await expect(page.locator('button[title]')).toHaveCount(0);

    // WCAG 2.2 AA sur Consultation de note (thème clair + sombre + reflow 320 px)
    const noteConsultLightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(noteConsultLightAxe.violations).toEqual([]);

    // Clic sur le crayon de la liste -> ouvre directement l’éditeur inline sur Note Secondaire
    await page.getByRole('button', { name: 'Modifier la note « Note Secondaire »' }).click();
    await expect(page.locator('section[aria-label="Éditeur de note"]')).toBeVisible();
    await expect(page.locator('#note-title-input')).toHaveValue('Note Secondaire');

    // Dialogue dédié : Ouvrir la saisie -> basculer vers Consulter -> revenir vers Modifier -> fermer
    await page.locator('#btn-open-note-dialog').click();
    await expect(page.locator('#dialog-note-title')).toHaveText('Modifier la note');
    await page.locator('#btn-switch-note-dialog-view').click();
    await expect(page.locator('#dialog-note-title')).toHaveText('Consulter la note');
    await expect(page.locator('#note-consult-view')).toBeVisible();
    await expect(page.locator('#dialog-note input, #dialog-note textarea')).toHaveCount(0);
    await page.locator('#btn-switch-note-dialog-edit').click();
    await expect(page.locator('#dialog-note-title')).toHaveText('Modifier la note');
    await page.locator('#dialog-note [data-cv-close]').first().click();

    // Duplication -> reste en Modification sur la copie, puis retour Consultation via bouton Consulter
    await page.locator('#btn-duplicate-note').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Note Secondaire (copie)');
    await page.locator('#btn-switch-note-view').click();
    await expect(page.locator('#note-consult-title')).toHaveText('Note Secondaire (copie)');

    // 8. Vue Tableaux blancs : Consultation vs Modification + zoom/grille en Consultation
    await page.locator('[data-nav-view="whiteboards"]').click();
    const wbConsultPanel = page.locator('section[aria-label="Consultation de tableau blanc"]');
    await expect(wbConsultPanel).toBeVisible();
    await expect(page.locator('#whiteboard-consult-title')).toHaveText('Canevas Architecture');
    await expect(wbConsultPanel.locator('.lc-wb-el')).toHaveCount(5);

    // Aucun outil de dessin/saisie/modèle/suppression en Consultation, mais Zoom/Grille/Exports présents
    await expect(
      wbConsultPanel.locator('input, select, textarea, .lc-wb-text-editor, .lc-template-bar'),
    ).toHaveCount(0);
    await expect(
      wbConsultPanel.locator(
        '[data-wb-tool], [data-wb-action="undo"], #btn-save-whiteboard, #btn-delete-whiteboard, #btn-archive-whiteboard',
      ),
    ).toHaveCount(0);
    await expect(wbConsultPanel.locator('#btn-export-wb-svg')).toBeVisible();
    await expect(wbConsultPanel.locator('#btn-export-wb-png')).toBeVisible();
    await expect(wbConsultPanel.locator('[data-wb-action="zoom-in"]')).toBeVisible();
    await expect(wbConsultPanel.locator('[data-wb-action="toggle-grid"]')).toBeVisible();
    await wbConsultPanel.locator('[data-wb-action="zoom-in"]').click();
    await expect(wbConsultPanel.locator('[data-wb-action="zoom-reset"]')).toHaveText('120 %');
    await expect(page.locator('button[title]')).toHaveCount(0);

    // WCAG 2.2 AA en thème sombre + reflow 320 px sur Consultation de tableau blanc
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const wbConsultDarkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(wbConsultDarkAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    const wbOverflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(wbOverflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Bascule vers Modification par le bouton Modifier de la barre d'actions ou de la liste
    await page.locator('#btn-switch-wb-edit').click();
    await expect(page.locator('section[aria-label="Éditeur de tableau blanc"]')).toBeVisible();
    await expect(page.locator('[data-wb-tool="sticky"]')).toBeVisible();

    // Dialogue Tableau blanc : bascule Modifier <-> Consulter
    await page.locator('#btn-open-whiteboard-dialog').click();
    await expect(page.locator('#dialog-whiteboard-title')).toHaveText('Modifier le tableau blanc');
    await page.locator('#btn-switch-whiteboard-dialog-view').click();
    await expect(page.locator('#dialog-whiteboard-title')).toHaveText('Consulter le tableau blanc');
    await expect(page.locator('#whiteboard-consult-view')).toBeVisible();
    await page.locator('#dialog-whiteboard [data-cv-close]').first().click();

    await page.locator('#btn-switch-wb-view').click();
    await expect(wbConsultPanel).toBeVisible();
  });

  test('verrou multi-onglets readOnly impose strictement le mode Consultation sans bouton Modifier', async ({
    context,
    page,
  }) => {
    await page.goto('/');

    // Préparer un projet, une tâche, une note et un tableau blanc dans l’onglet 1
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Verrou');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche Verrouillée');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Note Verrouillée');
    await page.locator('#dialog-note button[type="submit"]').click();

    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    // Ouvrir un 2e onglet (readOnly actif)
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('#readonly-banner-slot')).toContainText('Mode lecture seule actif');

    // Projets : Consulter fonctionne, Modifier désactivé, pas de bouton bascule Modifier
    await page2.locator('[data-nav-view="projects"]').click();
    await expect(page2.getByRole('button', { name: 'Modifier Projet Verrou' })).toBeDisabled();
    await page2.getByRole('button', { name: 'Consulter Projet Verrou' }).click();
    await expect(page2.locator('#project-consult-view')).toBeVisible();
    await expect(page2.locator('#btn-switch-project-edit')).toHaveCount(0);
    await page2.locator('#modal-project [data-cv-close]').first().click();

    // Tâches : Consultation uniquement, aucun bouton bascule Modifier
    await page2.locator('[data-nav-view="tasks"]').click();
    await expect(
      page2.getByRole('button', { name: 'Modifier « Tâche Verrouillée »' }),
    ).toBeDisabled();
    await page2.getByRole('button', { name: 'Consulter « Tâche Verrouillée »' }).click();
    await expect(page2.locator('#task-consult-view')).toBeVisible();
    await expect(page2.locator('#btn-switch-task-edit')).toHaveCount(0);
    await page2.locator('#drawer-task [data-cv-close]').first().click();

    // Notes : uniquement Consultation, aucun crayon d’édition ni bouton Modifier
    await page2.locator('[data-nav-view="notes"]').click();
    await expect(page2.locator('section[aria-label="Consultation de note"]')).toBeVisible();
    await expect(page2.locator('.lc-note-row__edit')).toHaveCount(0);
    await expect(page2.locator('#btn-switch-note-edit')).toHaveCount(0);
  });
});
