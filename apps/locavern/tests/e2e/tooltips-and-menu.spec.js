import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Helper to hover a button, wait for the hover delay, and assert the top-layer
 * tooltip displays the expected text near the button without clipping.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} trigger
 * @param {string | RegExp} expectedText
 */
async function expectTooltipOnHover(page, trigger, expectedText) {
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  await expect(trigger).not.toHaveAttribute('title', /.+/);

  const box = await trigger.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const tip = page.locator('.lc-tooltip:popover-open');
  await expect(tip).toBeVisible({ timeout: 2000 });
  await expect(tip).toContainText(expectedText);

  const tipBox = await tip.boundingBox();
  expect(tipBox).not.toBeNull();
  if (!tipBox) return;

  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  expect(tipBox.x).toBeGreaterThanOrEqual(0);
  expect(tipBox.y).toBeGreaterThanOrEqual(0);
  expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(vp.width + 1);
  expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(vp.height + 1);

  // Must sit close to its trigger (not stranded at 0,0)
  const triggerCx = box.x + box.width / 2;
  const tipCx = tipBox.x + tipBox.width / 2;
  expect(Math.abs(tipCx - triggerCx)).toBeLessThan(220);
  expect(
    Math.abs(tipBox.y + tipBox.height - box.y) < 40 ||
      Math.abs(tipBox.y - (box.y + box.height)) < 40,
  ).toBe(true);

  return tip;
}

test.describe('Menu Kanban positionné et infobulles accessibles sur les boutons', () => {
  test('menu 3 points du Kanban ancré au bouton (colonnes gauche et droite) + WCAG 1.4.13', async ({
    page,
  }) => {
    await page.goto('/');

    // Créer un projet et deux tâches (première colonne et dernière colonne)
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Audit UI');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche gauche');
    await page.locator('#task-status-select').selectOption('todo');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche droite');
    await page.locator('#task-status-select').selectOption('done');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(page.locator('.lc-kanban')).toBeVisible();

    // 1) Vérifier positionnement du menu 3 points dans la colonne de gauche
    const leftBtn = page.getByRole('button', { name: 'Actions pour « Tâche gauche »' });
    const leftBtnBox = await leftBtn.boundingBox();
    expect(leftBtnBox).not.toBeNull();

    // D'abord vérifier l'infobulle au survol (avec délai ~300 ms, hoverable, fermée au clic)
    const box = /** @type {NonNullable<typeof leftBtnBox>} */ (leftBtnBox);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Ne doit pas apparaître instantanément (délai anti-flash)
    await page.waitForTimeout(80);
    await expect(page.locator('.lc-tooltip:popover-open')).toHaveCount(0);

    const tip = page.locator('.lc-tooltip:popover-open');
    await expect(tip).toBeVisible({ timeout: 1500 });
    await expect(tip).toHaveText('Actions sur la tâche');

    // WCAG 1.4.13 Hoverable : déplacer la souris sur l'infobulle la garde visible
    const tipBox = await tip.boundingBox();
    expect(tipBox).not.toBeNull();
    if (tipBox) {
      await page.mouse.move(tipBox.x + tipBox.width / 2, tipBox.y + tipBox.height / 2);
      await page.waitForTimeout(300);
      await expect(tip).toBeVisible();
    }

    // Cliquer le bouton ferme l'infobulle et ouvre le menu ancré près du bouton
    await leftBtn.click();
    await expect(page.locator('.lc-tooltip:popover-open')).toHaveCount(0);

    const leftMenuId = await leftBtn.getAttribute('popovertarget');
    expect(leftMenuId).toBeTruthy();
    const leftMenu = page.locator(`#${leftMenuId}`);
    await expect(leftMenu).toBeVisible();

    const leftMenuBox = await leftMenu.boundingBox();
    expect(leftMenuBox).not.toBeNull();
    if (leftMenuBox) {
      // Ne doit JAMAIS se placer en (0, 0)
      expect(leftMenuBox.x).toBeGreaterThan(20);
      expect(leftMenuBox.y).toBeGreaterThan(box.y - leftMenuBox.height - 20);
      expect(Math.abs(leftMenuBox.x - box.x)).toBeLessThan(220);
      expect(
        Math.abs(leftMenuBox.y - (box.y + box.height)) < 24 ||
          Math.abs(box.y - (leftMenuBox.y + leftMenuBox.height)) < 24,
      ).toBe(true);
    }

    // Axe-core avec menu ouvert en thème clair
    const lightMenuAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightMenuAxe.violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(leftMenu).toBeHidden();

    // 2) Vérifier le menu 3 points de la colonne de droite (ne déborde pas du viewport)
    const rightBtn = page.getByRole('button', { name: 'Actions pour « Tâche droite »' });
    const rightBtnBox = await rightBtn.boundingBox();
    expect(rightBtnBox).not.toBeNull();
    await rightBtn.click();

    const rightMenuId = await rightBtn.getAttribute('popovertarget');
    const rightMenu = page.locator(`#${rightMenuId}`);
    await expect(rightMenu).toBeVisible();

    const rightMenuBox = await rightMenu.boundingBox();
    expect(rightMenuBox).not.toBeNull();
    if (rightMenuBox && rightBtnBox) {
      expect(rightMenuBox.x + rightMenuBox.width).toBeLessThanOrEqual(1280);
      expect(rightMenuBox.x).toBeGreaterThan(rightBtnBox.x - rightMenuBox.width - 40);
      expect(Math.abs(rightMenuBox.y - (rightBtnBox.y + rightBtnBox.height))).toBeLessThan(24);
    }
    await page.keyboard.press('Escape');

    // 3) WCAG 1.4.13 Clavier + Échap : focus clavier ouvre l'infobulle, Échap la ferme sans perdre le focus
    await leftBtn.focus();
    await page.keyboard.press('Shift'); // assure contexte clavier récent
    await rightBtn.focus();
    await expect(page.locator('.lc-tooltip:popover-open')).toHaveText('Actions sur la tâche');

    await page.keyboard.press('Escape');
    await expect(page.locator('.lc-tooltip:popover-open')).toHaveCount(0);
    await expect(rightBtn).toBeFocused();

    // Axe-core en thème sombre avec infobulle ouverte
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await rightBtn.focus();
    await expect(page.locator('.lc-tooltip:popover-open')).toBeVisible();
    const darkTipAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkTipAxe.violations).toEqual([]);
    await page.keyboard.press('Escape');

    // Bouton d'ajout rapide de colonne & bouton config statuts
    await expectTooltipOnHover(
      page,
      page.getByRole('button', { name: 'Ajouter une tâche dans À faire' }),
      'Ajouter une tâche dans À faire',
    );
    await expectTooltipOnHover(
      page,
      page.locator('#btn-configure-statuses'),
      'Configurer les colonnes du Kanban',
    );
  });

  test('audit complet des boutons : topbar, modales, Tiptap, tableau blanc, calendrier et aujourd’hui', async ({
    page,
  }) => {
    const offsetToday = (() => {
      const dt = new Date();
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    })();

    await page.goto('/');

    // Aucun bouton avec attribut natif `title` sur la coque de base
    await expect(page.locator('button[title]')).toHaveCount(0);

    // Topbar : recherche (Ctrl+K), sauvegarde, menu mobile à 640 px
    await expectTooltipOnHover(
      page,
      page.locator('.cv-search'),
      'Rechercher ou exécuter une commande (Ctrl+K)',
    );
    await expectTooltipOnHover(
      page,
      page.locator('#topbar-backup-btn'),
      'Sauvegardes et import/export',
    );

    await page.setViewportSize({ width: 640, height: 800 });
    await expectTooltipOnHover(page, page.locator('.cv-shell__menu'), 'Menu de navigation');
    await page.setViewportSize({ width: 1280, height: 800 });

    // Modale sauvegarde : bascule mot de passe
    await page.locator('#topbar-backup-btn').click();
    await expect(page.locator('#modal-backup')).toBeVisible();
    await page.locator('#chk-export-encrypt').check();
    const pwToggle = page.locator('#export-encrypt-fields .lc-password-toggle').first();
    await expectTooltipOnHover(page, pwToggle, 'Afficher le mot de passe');
    await pwToggle.click();
    await expectTooltipOnHover(page, pwToggle, 'Masquer le mot de passe');
    await expectTooltipOnHover(
      page,
      page.locator('#modal-backup [data-cv-close]').first(),
      'Fermer',
    );
    // Échap avec infobulle ouverte dans une dialog ferme l'infobulle SANS fermer la modale
    await page.keyboard.press('Escape');
    await expect(page.locator('.lc-tooltip:popover-open')).toHaveCount(0);
    await expect(page.locator('#modal-backup')).toBeVisible();
    await page.locator('#modal-backup [data-cv-close]').first().click();

    // Créer un projet, tâche (pour Aujourd'hui & Calendrier & tiroir)
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet Audit');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    const drawer = page.locator('#drawer-task');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('button[title]')).toHaveCount(0);
    await expectTooltipOnHover(page, drawer.locator('[data-cv-close]').first(), 'Fermer');
    await expectTooltipOnHover(
      page,
      drawer.locator('.lc-editor__toolbar button[aria-label="Gras"]'),
      'Gras',
    );

    await page.locator('#task-title-input').fill('Tâche datée');
    await page.locator('#task-due-input').fill(offsetToday);
    await page.locator('#task-checklist-new').fill('Étape A');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expectTooltipOnHover(
      page,
      drawer.locator('.lc-checklist__row button[aria-label^="Retirer"]'),
      'Retirer l’étape',
    );

    await page.locator('#task-tags-input').fill('urgent');
    await page.locator('#task-tags-add').click();
    await expectTooltipOnHover(page, drawer.locator('.lc-tag-chip__remove'), 'Retirer l’étiquette');

    await drawer.locator('button[type="submit"]').click();

    // Modale de configuration des statuts Kanban
    await page.locator('#btn-configure-statuses').click();
    const statusModal = page.locator('#modal-statuses');
    await expect(statusModal).toBeVisible();
    await expect(statusModal.locator('button[title]')).toHaveCount(0);
    await expectTooltipOnHover(
      page,
      statusModal.locator('[data-move-down]').first(),
      'Descendre le statut',
    );
    await expectTooltipOnHover(
      page,
      statusModal.locator('[data-delete-status]').first(),
      'Supprimer le statut',
    );
    await statusModal.locator('[data-cv-close]').first().click();

    // Vue Calendrier : -1 j, +1 j, + ajout jour
    await page.locator('[data-nav-view="calendar"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Calendrier');
    await expect(page.locator('button[title]')).toHaveCount(0);
    await expectTooltipOnHover(
      page,
      page.locator('[aria-label^="Avancer «"]').first(),
      'Avancer d’un jour',
    );
    await expectTooltipOnHover(
      page,
      page.locator('[aria-label^="Reporter «"]').first(),
      'Reporter d’un jour',
    );
    await expectTooltipOnHover(
      page,
      page.locator('[aria-label^="Ajouter une tâche le"]').first(),
      /^Ajouter une tâche le /,
    );

    // Vue Aujourd'hui : marquer terminée sans attribut title natif
    await page.locator('[data-nav-view="today"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Aujourd’hui');
    await expect(page.locator('button[title]')).toHaveCount(0);
    await expectTooltipOnHover(
      page,
      page.locator('[aria-label^="Marquer « Tâche datée » comme terminée"]'),
      'Marquer terminée',
    );

    // Vue Notes : barre d'outils Tiptap non rognée malgré overflow: hidden sur .lc-editor + lien
    await page.locator('[data-nav-view="notes"]').click();
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Note audit');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('button[title]')).toHaveCount(0);
    await expectTooltipOnHover(
      page,
      page.locator(
        'section[aria-label="Éditeur de note"] .lc-editor__toolbar button[aria-label="Italique"]',
      ),
      'Italique',
    );
    await page.locator('#note-links-select').selectOption({ label: 'Tâche datée' });
    await page.locator('#note-links-add').click();
    await expectTooltipOnHover(
      page,
      page.locator('#note-links-list .lc-tag-chip__remove'),
      'Retirer le lien',
    );

    // Vue Tableau blanc : boutons outils, réinitialisation zoom, taille maximum dynamique
    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau audit');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('button[title]')).toHaveCount(0);

    await expectTooltipOnHover(
      page,
      page.locator('.lc-wb-toolbar [data-wb-tool="rect"]'),
      'Rectangle',
    );
    await expectTooltipOnHover(
      page,
      page.locator('.lc-wb-toolbar [data-wb-action="zoom-reset"]'),
      'Réinitialiser le zoom à 100 %',
    );
    const maxBtn = page.locator('.lc-wb-toolbar [data-wb-action="toggle-maximize"]');
    await expectTooltipOnHover(page, maxBtn, 'Afficher en taille maximum');
    await maxBtn.click();
    await expectTooltipOnHover(
      page,
      page.locator('#dialog-whiteboard-max [data-wb-action="toggle-maximize"]'),
      'Quitter la taille maximum',
    );
  });
});
