import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TINY_PNG_PATH = new URL('./fixtures/tiny.png', import.meta.url).pathname;

test.describe('Tableaux blancs SVG, persistance IndexedDB & accessibilité WCAG 2.2 AA', () => {
  test('cycle complet : création, outil persistant, superposition, fond transparent, déplacement clavier, image locale, blocage distant, reload, export et axe-core', async ({
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
    await page.locator('[data-nav-view="whiteboards"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');

    // Créer un tableau blanc via la fenêtre de saisie dédiée
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await expect(page.locator('#dialog-whiteboard')).toBeVisible();
    await page.locator('#whiteboard-dialog-title-input').fill('Schéma architecture');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Schéma architecture');

    // Ajouter un Post-it via la barre d’outils et saisir son texte au clavier
    await page.locator('[data-wb-tool="sticky"]').click();
    await page.locator('[data-wb-action="add-center"]').click();
    // L’outil sélectionné reste actif tant que l’utilisateur n’en change pas
    await expect(page.locator('[data-wb-tool="sticky"]')).toHaveAttribute('aria-pressed', 'true');

    const stickyEl = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    await expect(stickyEl).toBeVisible();
    await stickyEl.focus();

    const initialX = Number(await stickyEl.getAttribute('data-x'));
    const initialY = Number(await stickyEl.getAttribute('data-y'));

    // Édition de texte accessible via F2
    await stickyEl.press('F2');
    const textEditor = page.locator('.lc-wb-text-editor textarea');
    await expect(textEditor).toBeVisible();
    await textEditor.fill('Idée locale');
    await textEditor.press('Enter');
    await expect(stickyEl).toContainText('Idée locale');

    // Déplacement au clavier (ArrowRight + ArrowDown => +10 sur X et Y)
    await stickyEl.focus();
    await stickyEl.press('ArrowRight');
    await stickyEl.press('ArrowDown');
    await expect(stickyEl).toHaveAttribute('data-x', String(initialX + 10));
    await expect(stickyEl).toHaveAttribute('data-y', String(initialY + 10));

    // Sélectionner Rectangle et vérifier qu’il reste actif pour plusieurs dessins successifs
    const rectBtn = page.locator('[data-wb-tool="rect"]');
    await rectBtn.click();
    await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');

    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (svgBox) {
      // Premier dessin par glisser-déposer sur le canevas
      await page.mouse.move(svgBox.x + 40, svgBox.y + 40);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 140, svgBox.y + 110);
      await page.mouse.up();
      await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(1);
      await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');

      // Deuxième dessin sans re-cliquer sur l’outil Rectangle (même en démarrant sur le premier rectangle)
      await page.mouse.move(svgBox.x + 90, svgBox.y + 75);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 210, svgBox.y + 160);
      await page.mouse.up();
      await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(2);
      await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');
    }

    // Troisième ajout au centre avec fond transparent activé (pour encadrer un autre élément)
    const transparentBtn = page.locator('[data-wb-action="toggle-transparent-bg"]');
    await transparentBtn.click();
    await expect(transparentBtn).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-wb-action="add-center"]').click();
    await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(3);
    await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');

    const transparentRect = page.locator(
      '.lc-wb-el[data-el-type="rect"][data-transparent-bg="true"]',
    );
    await expect(transparentRect).toHaveCount(1);
    const transparentFill = await transparentRect
      .locator('.lc-wb-shape')
      .evaluate((el) => getComputedStyle(el).fill);
    expect(transparentFill).toBe('none');

    // Revenir à Sélectionner et tester la superposition (reculer / avancer d’un niveau à la fois)
    await page.locator('[data-wb-tool="select"]').click();
    await expect(page.locator('[data-wb-tool="select"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(rectBtn).toHaveAttribute('aria-pressed', 'false');

    const stickyId = await stickyEl.getAttribute('data-el-id');
    const transparentRectId = await transparentRect.getAttribute('data-el-id');
    expect(stickyId).toBeTruthy();
    expect(transparentRectId).toBeTruthy();

    // Le rectangle transparent vient d’être créé en dernier : il est tout devant
    const getDomOrder = () =>
      page
        .locator('.lc-wb-elements > .lc-wb-el')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-el-id')));

    let order = await getDomOrder();
    expect(order[order.length - 1]).toBe(transparentRectId);

    const bringForwardBtn = page.locator('[data-wb-action="bring-forward"]');
    const sendBackwardBtn = page.locator('[data-wb-action="send-backward"]');
    await transparentRect.focus();
    await expect(bringForwardBtn).toBeDisabled();
    await expect(sendBackwardBtn).toBeEnabled();

    // Reculer d’un seul niveau
    await sendBackwardBtn.click();
    order = await getDomOrder();
    expect(order[order.length - 2]).toBe(transparentRectId);
    await expect(bringForwardBtn).toBeEnabled();

    // Avancer d’un niveau via PageUp au clavier
    await transparentRect.focus();
    await transparentRect.press('PageUp');
    order = await getDomOrder();
    expect(order[order.length - 1]).toBe(transparentRectId);

    // Basculer le fond transparent sur le Post-it puis le rétablir
    await stickyEl.focus();
    await expect(transparentBtn).toHaveAttribute('aria-pressed', 'false');
    await transparentBtn.click();
    await expect(stickyEl).toHaveAttribute('data-transparent-bg', 'true');
    await transparentBtn.click();
    await expect(stickyEl).not.toHaveAttribute('data-transparent-bg', 'true');

    // Ajouter une image locale
    await page.locator('.lc-wb-container .lc-file-input-hidden').setInputFiles(TINY_PNG_PATH);
    const svgImg = page.locator('.lc-wb-el[data-el-type="image"] image[data-asset-id]');
    await expect(svgImg).toBeVisible();
    await expect(svgImg).toHaveAttribute('href', /^blob:/);

    // Tester le blocage du collage d’une image distante HTML
    await page.evaluate(() => {
      const container = document.querySelector('.lc-wb-container');
      if (!container) return;
      const dt = new DataTransfer();
      dt.setData('text/html', '<img src="https://evil.example/remote.png" alt="Externe" />');
      container.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    await expect(page.locator('.cv-toast-region')).toContainText('Image distante bloquée');
    expect(externalRequests).toEqual([]);

    // Enregistrer et recharger la page
    await page.locator('#btn-save-whiteboard').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Tableau blanc enregistré');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await expect(page.locator('#whiteboard-consult-title')).toHaveText('Schéma architecture');

    const restoredSticky = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    await expect(restoredSticky).toContainText('Idée locale');
    await expect(restoredSticky).toHaveAttribute('data-x', String(initialX + 10));
    await expect(restoredSticky).toHaveAttribute('data-y', String(initialY + 10));
    await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(3);
    await expect(
      page.locator('.lc-wb-el[data-el-type="rect"][data-transparent-bg="true"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.lc-wb-el[data-el-type="image"] image[data-asset-id]'),
    ).toHaveAttribute('href', /^blob:/);

    // Export SVG et PNG (téléchargements locaux, zéro requête externe)
    const svgDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-wb-svg').click();
    const svgDownload = await svgDownloadPromise;
    expect(svgDownload.suggestedFilename()).toBe('schema-architecture.svg');
    const svgStream = await svgDownload.createReadStream();
    /** @type {string[]} */
    const svgChunks = [];
    for await (const chunk of svgStream) {
      svgChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    expect(svgChunks.join('')).toContain('fill="none"');

    const pngDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-wb-png').click();
    const pngDownload = await pngDownloadPromise;
    expect(pngDownload.suggestedFilename()).toBe('schema-architecture.png');

    // Audit axe-core WCAG 2.2 AA en thème clair
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    // Basculer en thème sombre et vérifier axe-core
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Vérifier reflow à 320 px
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
    expect(externalRequests).toEqual([]);
  });

  test('sélection multiple (Maj+clic & zone), duplication Ctrl+D et ajustement à la vue', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="whiteboards"]').click();

    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau multi-sélection');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    // Créer un Post-it et dessiner un Rectangle distinct à côté
    await page.locator('[data-wb-tool="sticky"]').click();
    await page.locator('[data-wb-action="add-center"]').click();
    await page.locator('[data-wb-tool="rect"]').click();
    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (svgBox) {
      await page.mouse.move(svgBox.x + 24, svgBox.y + 24);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 124, svgBox.y + 104);
      await page.mouse.up();
    }

    await page.locator('[data-wb-tool="select"]').click();
    const sticky = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    const rect = page.locator('.lc-wb-el[data-el-type="rect"]').first();

    // Sélectionner les deux via Maj+clic
    await sticky.click();
    await rect.click({ modifiers: ['Shift'] });
    await expect(page.locator('.lc-wb-el[data-selected="true"]')).toHaveCount(2);

    // Déplacer les deux simultanément au clavier (+10 px)
    const sX0 = Number(await sticky.getAttribute('data-x'));
    const rX0 = Number(await rect.getAttribute('data-x'));
    await rect.press('ArrowRight');
    await expect(sticky).toHaveAttribute('data-x', String(sX0 + 10));
    await expect(rect).toHaveAttribute('data-x', String(rX0 + 10));

    // Dupliquer la sélection avec Ctrl+D -> 4 éléments au total, dont 2 nouveaux sélectionnés
    await page.keyboard.press('Control+d');
    await expect(page.locator('.lc-wb-el')).toHaveCount(4);
    await expect(page.locator('.lc-wb-el[data-selected="true"]')).toHaveCount(2);

    // Sélection par zone (outil marquee)
    if (svgBox) {
      await page.locator('[data-wb-tool="marquee"]').click();
      await page.mouse.move(svgBox.x + 6, svgBox.y + 6);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + svgBox.width - 6, svgBox.y + svgBox.height - 6);
      await page.mouse.up();
      await expect(page.locator('.lc-wb-el[data-selected="true"]')).toHaveCount(4);
    }

    // Zoomer puis cliquer sur Ajuster à la vue -> transforme le viewport pour recentrer les éléments
    await page.locator('[data-wb-action="zoom-in"]').click();
    await page.locator('[data-wb-action="zoom-in"]').click();
    await expect(page.locator('[data-wb-action="zoom-reset"]')).toHaveText('140 %');

    await page.locator('[data-wb-action="fit-to-view"]').click();
    await expect(page.locator('[data-wb-action="zoom-reset"]')).toHaveText('100 %');

    const worldTransform = await page.locator('.lc-wb-world').getAttribute('transform');
    expect(worldTransform).toContain('translate(');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('flèches aimantées aux formes : attachement, suivi des déplacements, persistance et détachement', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="whiteboards"]').click();

    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Schéma flèches aimantées');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (!svgBox) return;

    // Créer un Post-it à gauche et un Rectangle à droite
    await page.locator('[data-wb-tool="sticky"]').click();
    await page.mouse.move(svgBox.x + 60, svgBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 200, svgBox.y + 180);
    await page.mouse.up();

    await page.locator('[data-wb-tool="rect"]').click();
    await page.mouse.move(svgBox.x + 360, svgBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 500, svgBox.y + 180);
    await page.mouse.up();

    const sticky = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    const rect = page.locator('.lc-wb-el[data-el-type="rect"]').first();
    const stickyId = await sticky.getAttribute('data-el-id');
    const rectId = await rect.getAttribute('data-el-id');
    expect(stickyId).toBeTruthy();
    expect(rectId).toBeTruthy();

    // Dessiner une flèche reliant le Post-it au Rectangle
    await page.locator('[data-wb-tool="arrow"]').click();
    await page.mouse.move(svgBox.x + 195, svgBox.y + 130);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 365, svgBox.y + 130);
    await page.mouse.up();

    const arrow = page.locator('.lc-wb-el[data-el-type="arrow"]').first();
    await expect(arrow).toHaveAttribute('data-start-bound', String(stickyId));
    await expect(arrow).toHaveAttribute('data-end-bound', String(rectId));

    const arrowInitialW = Number(await arrow.getAttribute('data-w'));

    // Déplacer le Rectangle vers la droite (+40 px au clavier) -> la flèche s'allonge pour suivre
    await page.locator('[data-wb-tool="select"]').click();
    await rect.focus();
    await rect.press('ArrowRight');
    await rect.press('ArrowRight');
    await rect.press('ArrowRight');
    await rect.press('ArrowRight');

    const arrowUpdatedW = Number(await arrow.getAttribute('data-w'));
    expect(arrowUpdatedW).toBeGreaterThanOrEqual(arrowInitialW + 30);

    // Sauvegarder et recharger : les liaisons et coordonnées suivies persistent
    await page.locator('#btn-save-whiteboard').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Tableau blanc enregistré');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    await page.reload();
    const restoredArrow = page.locator('.lc-wb-el[data-el-type="arrow"]').first();
    await expect(restoredArrow).toHaveAttribute('data-start-bound', String(stickyId));
    await expect(restoredArrow).toHaveAttribute('data-end-bound', String(rectId));
    expect(Number(await restoredArrow.getAttribute('data-w'))).toBe(arrowUpdatedW);

    // Passer en modification puis sélectionner la flèche et détacher la poignée de fin vers le vide
    await expect(page.locator('#whiteboard-consult-title')).toHaveText('Schéma flèches aimantées');
    await page.locator('#btn-switch-wb-edit').click();
    const editArrow = page.locator('.lc-wb-el[data-el-type="arrow"]').first();
    await editArrow.focus();
    const endHandle = editArrow.locator('[data-wb-arrow-handle="end"]');
    await expect(endHandle).toBeVisible();
    const handleBox = await endHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 300, svgBox.y + 320);
      await page.mouse.up();
    }
    await expect(editArrow).not.toHaveAttribute('data-end-bound', String(rectId));
    await expect(editArrow).toHaveAttribute('data-start-bound', String(stickyId));

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('grille d’alignement SVG, bascule d’affichage, magnétisme optionnel et export propre', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="whiteboards"]').click();

    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Grille alignement');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    const wbContainer = page.locator('.lc-wb-container');
    const gridLayer = page.locator('.lc-wb-grid-layer');
    const gridBtn = page.locator('[data-wb-action="toggle-grid"]');
    const snapBtn = page.locator('[data-wb-action="toggle-snap"]');

    // Grille visible par défaut, magnétisme désactivé par défaut
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(snapBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(wbContainer).toHaveAttribute('data-wb-grid', 'true');
    await expect(wbContainer).toHaveAttribute('data-wb-snap', 'false');
    await expect(gridLayer).toBeVisible();

    // Masquer puis réafficher la grille
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(gridLayer).toBeHidden();
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(gridLayer).toBeVisible();

    // Activer le magnétisme sur la grille (pas de 20 px)
    await snapBtn.click();
    await expect(snapBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(wbContainer).toHaveAttribute('data-wb-snap', 'true');

    // Dessiner un rectangle avec coordonnées non multiples de 20 -> aligné sur la grille
    await page.locator('[data-wb-tool="rect"]').click();
    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (svgBox) {
      await page.mouse.move(svgBox.x + 33, svgBox.y + 47);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 172, svgBox.y + 153);
      await page.mouse.up();
    }

    const rect = page.locator('.lc-wb-el[data-el-type="rect"]').first();
    await expect(rect).toBeVisible();
    const rx = Number(await rect.getAttribute('data-x'));
    const ry = Number(await rect.getAttribute('data-y'));
    const rw = Number(await rect.getAttribute('data-w'));
    const rh = Number(await rect.getAttribute('data-h'));
    expect(rx % 20).toBe(0);
    expect(ry % 20).toBe(0);
    expect(rw % 20).toBe(0);
    expect(rh % 20).toBe(0);

    // Déplacement clavier avec magnétisme actif -> avance de 20 px
    await page.locator('[data-wb-tool="select"]').click();
    await rect.focus();
    await rect.press('ArrowRight');
    await rect.press('ArrowDown');
    await expect(rect).toHaveAttribute('data-x', String(rx + 20));
    await expect(rect).toHaveAttribute('data-y', String(ry + 20));

    // L’export SVG autonome ne doit pas inclure la grille d’alignement de travail
    const svgDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-wb-svg').click();
    const svgDownload = await svgDownloadPromise;
    const svgStream = await svgDownload.createReadStream();
    /** @type {string[]} */
    const svgChunks = [];
    for await (const chunk of svgStream) {
      svgChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    const exportedSvg = svgChunks.join('');
    expect(exportedSvg).toContain('<rect');
    expect(exportedSvg).not.toContain('lc-wb-grid-layer');
    expect(exportedSvg).not.toContain('grid-minor');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('affichage en taille maximum : modale sur la zone visible de main, conservation d’état, fermetures, thèmes et reflow 320 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.locator('[data-nav-view="whiteboards"]').click();

    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau taille maximum');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    await page.locator('[data-wb-tool="sticky"]').click();
    await page.locator('[data-wb-action="add-center"]').click();

    const maxBtn = page.locator('[data-wb-action="toggle-maximize"]');
    const maxDialog = page.locator('#dialog-whiteboard-max');
    const inlineStageBox = await page.locator('.lc-wb-stage').boundingBox();
    expect(inlineStageBox).not.toBeNull();

    await expect(maxBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(maxDialog).toBeHidden();

    // Passer en taille maximum
    await maxBtn.click();
    await expect(maxDialog).toBeVisible();
    await expect(page.locator('#dialog-whiteboard-max-title')).toHaveText('Tableau taille maximum');
    await expect(maxBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(maxDialog.locator('.lc-wb-container')).toBeVisible();
    await expect(page.locator('#app-view .lc-wb-container')).toHaveCount(0);

    // La modale couvre toute la zone visible de <main> (#shell-main)
    await maxDialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const bounds = await page.evaluate(() => {
      const main = document.getElementById('shell-main');
      const dlg = document.getElementById('dialog-whiteboard-max');
      const stage = document.querySelector('.lc-wb-stage');
      if (!main || !dlg || !stage) return null;
      const m = main.getBoundingClientRect();
      const d = dlg.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        mainTop: Math.max(0, Math.round(m.top)),
        mainLeft: Math.round(m.left),
        mainWidth: Math.round(m.width),
        dlgTop: Math.round(d.top),
        dlgLeft: Math.round(d.left),
        dlgWidth: Math.round(d.width),
        dlgBottom: Math.round(d.bottom),
        stageHeight: Math.round(s.height),
      };
    });
    expect(bounds).not.toBeNull();
    if (bounds && inlineStageBox) {
      expect(Math.abs(bounds.dlgLeft - bounds.mainLeft)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds.dlgTop - bounds.mainTop)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds.dlgWidth - bounds.mainWidth)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds.dlgBottom - bounds.vh)).toBeLessThanOrEqual(2);
      expect(bounds.stageHeight).toBeGreaterThan(inlineStageBox.height);
    }

    // Relâcher un glisser-déposer sur le ::backdrop (zone barre latérale) ne ferme pas la modale
    await page.locator('[data-wb-tool="rect"]').click();
    const maxSvgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(maxSvgBox).not.toBeNull();
    if (maxSvgBox) {
      await page.mouse.move(maxSvgBox.x + 80, maxSvgBox.y + 80);
      await page.mouse.down();
      await page.mouse.move(60, 240);
      await page.mouse.up();
    }
    await expect(maxDialog).toBeVisible();
    await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(1);

    // Édition de texte : Échap ferme d'abord la barre d'édition sans fermer la modale
    const stickyEl = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    await stickyEl.focus();
    await stickyEl.press('F2');
    const textEditor = page.locator('.lc-wb-text-editor textarea');
    await expect(textEditor).toBeVisible();
    await textEditor.fill('Texte temporaire');
    await textEditor.press('Escape');
    await expect(textEditor).toBeHidden();
    await expect(maxDialog).toBeVisible();
    await expect(stickyEl).toContainText('Post-it');

    // Échap suivant ferme la modale et rend le focus au bouton taille maximum
    await page.keyboard.press('Escape');
    await expect(maxDialog).toBeHidden();
    await expect(page.locator('#app-view .lc-wb-container')).toBeVisible();
    await expect(maxBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(maxBtn).toBeFocused();
    await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(1);

    // Modifier le texte en taille maximum + fermer via le bouton de barre d'outils
    await maxBtn.click();
    await expect(maxDialog).toBeVisible();
    await stickyEl.focus();
    await stickyEl.press('F2');
    await textEditor.fill('Modifié en taille maximum');
    await textEditor.press('Enter');
    await expect(stickyEl).toHaveAttribute('aria-label', /Modifié en taille maximum/);

    await maxBtn.click();
    await expect(maxDialog).toBeHidden();
    await expect(maxBtn).toBeFocused();

    // Fermeture via le bouton Fermer de l'en-tête de modale
    await maxBtn.click();
    await expect(maxDialog).toBeVisible();
    await maxDialog.locator('[data-cv-close]').click();
    await expect(maxDialog).toBeHidden();
    await expect(maxBtn).toBeFocused();

    // Audit axe-core WCAG 2.2 AA en thème clair (modale ouverte)
    await maxBtn.click();
    await expect(maxDialog).toBeVisible();
    const lightMaxAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightMaxAxe.violations).toEqual([]);

    // Fermeture par clic sur le ::backdrop (dans la zone barre latérale)
    await page.mouse.click(60, 240);
    await expect(maxDialog).toBeHidden();
    await expect(maxBtn).toBeFocused();

    // Basculer en thème sombre, rouvrir et auditer axe-core + reflow 320 px
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await maxBtn.click();
    await expect(maxDialog).toBeVisible();
    const darkMaxAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkMaxAxe.violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 640 });
    await expect(maxDialog).toBeVisible();
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const m = document.getElementById('shell-main');
          const d = document.getElementById('dialog-whiteboard-max');
          if (!m || !d) return null;
          const mr = m.getBoundingClientRect();
          const dr = d.getBoundingClientRect();
          return {
            leftDiff: Math.abs(Math.round(dr.left) - Math.round(mr.left)),
            widthDiff: Math.abs(Math.round(dr.width) - Math.round(mr.width)),
            topDiff: Math.abs(Math.round(dr.top) - Math.max(0, Math.round(mr.top))),
            bottomDiff: Math.abs(Math.round(dr.bottom) - window.innerHeight),
          };
        });
      })
      .toEqual({ leftDiff: 0, widthDiff: 0, topDiff: 0, bottomDiff: 0 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);

    // Navigation Ctrl+K pendant que la modale est ouverte -> ferme proprement la modale
    await page.keyboard.press('Control+k');
    await expect(page.locator('#cmd-menu')).toBeVisible();
    await page.locator('#cmd-list [data-value="view:tasks"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    await expect(maxDialog).toBeHidden();
  });

  test('couleurs des éléments, flèches et pastilles nettement différentiables et contrastées en mode sombre', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.locator('[data-nav-view="whiteboards"]').click();
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Palette mode sombre');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    const colors = ['neutral', 'accent', 'success', 'warning', 'danger'];
    for (const color of colors) {
      await page.locator('[data-wb-tool="sticky"]').click();
      await page.locator(`[data-wb-color="${color}"]`).click();
      await page.locator('[data-wb-action="add-center"]').click();
      await page.locator('.lc-wb-container').press('Escape');
      await page.locator('.lc-wb-container').press('Escape');

      await page.locator('[data-wb-tool="arrow"]').click();
      await page.locator(`[data-wb-color="${color}"]`).click();
      await page.locator('[data-wb-action="add-center"]').click();
      await page.locator('.lc-wb-container').press('Escape');
      await page.locator('.lc-wb-container').press('Escape');
    }
    await expect(page.locator('.lc-wb-el[data-el-type="sticky"]')).toHaveCount(5);
    await expect(page.locator('.lc-wb-el[data-el-type="arrow"]')).toHaveCount(5);

    const metrics = await page.evaluate((paletteKeys) => {
      /** @param {string} raw */
      const parseRgba = (raw) => {
        const m =
          /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i.exec(
            raw.trim(),
          );
        if (!m) return null;
        return {
          r: Number(m[1]),
          g: Number(m[2]),
          b: Number(m[3]),
          a: m[4] !== undefined ? Number(m[4]) : 1,
        };
      };
      /** @param {{ r: number; g: number; b: number }} c */
      const relLum = (c) => {
        /** @param {number} v */
        const toLin = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * toLin(c.r) + 0.7152 * toLin(c.g) + 0.0722 * toLin(c.b);
      };
      /** @param {{ r: number; g: number; b: number }} a @param {{ r: number; g: number; b: number }} b */
      const contrastRatio = (a, b) => {
        const l1 = relLum(a);
        const l2 = relLum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      /** @param {{ r: number; g: number; b: number }} a @param {{ r: number; g: number; b: number }} b */
      const rgbDist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

      const stage = document.querySelector('.lc-wb-stage');
      if (!stage) throw new Error('missing stage');
      const stageBg = parseRgba(getComputedStyle(stage).backgroundColor);
      if (!stageBg) throw new Error('unparseable stage bg');

      /** @typedef {{ r: number; g: number; b: number; a: number }} Rgba */
      /** @type {Record<string, { fill: Rgba; stroke: Rgba; line: Rgba; text: Rgba; swatchBg: Rgba }>} */
      const byColor = {};
      for (const key of paletteKeys) {
        const shape = document.querySelector(`.lc-wb-shape[data-color="${key}"]`);
        const arrowLine = document.querySelector(`.lc-wb-arrow-line[data-color="${key}"]`);
        const text = document.querySelector(`.lc-wb-el-text[data-color="${key}"]`);
        const swatch = document.querySelector(`.lc-wb-swatch--${key}`);
        if (!shape || !arrowLine || !text || !swatch) throw new Error(`missing nodes for ${key}`);
        const shapeCs = getComputedStyle(shape);
        const arrowCs = getComputedStyle(arrowLine);
        const textCs = getComputedStyle(text);
        const swatchCs = getComputedStyle(swatch);
        const fill = parseRgba(shapeCs.fill);
        const stroke = parseRgba(shapeCs.stroke);
        const line = parseRgba(arrowCs.stroke);
        const textRgb = parseRgba(textCs.fill);
        const swatchBg = parseRgba(swatchCs.backgroundColor);
        if (!fill || !stroke || !line || !textRgb || !swatchBg) {
          throw new Error(`unparseable css for ${key}`);
        }
        byColor[key] = { fill, stroke, line, text: textRgb, swatchBg };
      }

      /** @param {string} key */
      const getEntry = (key) => {
        const entry = byColor[key];
        if (!entry) throw new Error(`missing entry for ${key}`);
        return entry;
      };

      const opaqueAll = paletteKeys.every((k) => {
        const c = getEntry(k);
        return c.fill.a === 1 && c.swatchBg.a === 1;
      });
      const minDistFromStage = Math.min(
        ...paletteKeys.map((k) => rgbDist(getEntry(k).fill, stageBg)),
      );
      const minTextContrast = Math.min(
        ...paletteKeys.map((k) => contrastRatio(getEntry(k).text, getEntry(k).fill)),
      );
      const minStrokeStageContrast = Math.min(
        ...paletteKeys.map((k) => contrastRatio(getEntry(k).stroke, stageBg)),
      );
      const minStrokeFillContrast = Math.min(
        ...paletteKeys.map((k) => contrastRatio(getEntry(k).stroke, getEntry(k).fill)),
      );
      const minLineStageContrast = Math.min(
        ...paletteKeys.map((k) => contrastRatio(getEntry(k).line, stageBg)),
      );

      let minPairwiseFillDist = Infinity;
      let minPairwiseSwatchDist = Infinity;
      let minPairwiseLineDist = Infinity;
      for (let i = 0; i < paletteKeys.length; i += 1) {
        for (let j = i + 1; j < paletteKeys.length; j += 1) {
          const ki = paletteKeys[i];
          const kj = paletteKeys[j];
          if (!ki || !kj) continue;
          const ci = getEntry(ki);
          const cj = getEntry(kj);
          minPairwiseFillDist = Math.min(minPairwiseFillDist, rgbDist(ci.fill, cj.fill));
          minPairwiseSwatchDist = Math.min(
            minPairwiseSwatchDist,
            rgbDist(ci.swatchBg, cj.swatchBg),
          );
          minPairwiseLineDist = Math.min(minPairwiseLineDist, rgbDist(ci.line, cj.line));
        }
      }

      return {
        opaqueAll,
        minDistFromStage,
        minTextContrast,
        minStrokeStageContrast,
        minStrokeFillContrast,
        minLineStageContrast,
        minPairwiseFillDist,
        minPairwiseSwatchDist,
        minPairwiseLineDist,
      };
    }, colors);

    expect(metrics.opaqueAll).toBe(true);
    expect(metrics.minDistFromStage).toBeGreaterThanOrEqual(40);
    expect(metrics.minPairwiseFillDist).toBeGreaterThanOrEqual(45);
    expect(metrics.minPairwiseSwatchDist).toBeGreaterThanOrEqual(45);
    expect(metrics.minPairwiseLineDist).toBeGreaterThanOrEqual(45);
    expect(metrics.minTextContrast).toBeGreaterThanOrEqual(4.5);
    expect(metrics.minStrokeStageContrast).toBeGreaterThanOrEqual(3);
    expect(metrics.minStrokeFillContrast).toBeGreaterThanOrEqual(3);
    expect(metrics.minLineStageContrast).toBeGreaterThanOrEqual(3);

    // Export SVG autonome en mode sombre : pas de var(--...), 5 fonds et 5 traits de flèche distincts
    const svgDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-wb-svg').click();
    const svgDownload = await svgDownloadPromise;
    const svgStream = await svgDownload.createReadStream();
    /** @type {string[]} */
    const svgChunks = [];
    for await (const chunk of svgStream) {
      svgChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    const exportedSvg = svgChunks.join('');
    expect(exportedSvg).not.toContain('var(--');
    const fillMatches = [...exportedSvg.matchAll(/<rect[^>]*rx="8"[^>]*fill="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(new Set(fillMatches).size).toBe(5);
    const arrowStrokeMatches = [...exportedSvg.matchAll(/<line[^>]*stroke="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(new Set(arrowStrokeMatches).size).toBe(5);

    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);
  });
});
