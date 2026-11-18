import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Durée paramétrable des notifications toast', () => {
  test('valide, persiste, ferme automatiquement les toasts info/succès et préserve les alertes', async ({
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

    // 1. Vérifier la valeur par défaut (6 s) et la validation d’erreur dans Préférences d’affichage
    await page.locator('#nav-preferences-btn').click();
    await expect(page.locator('#modal-preferences')).toBeVisible();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');

    const durationInput = page.locator('#pref-toast-duration');
    const durationError = page.locator('#pref-toast-duration-error');
    await expect(durationInput).toHaveValue('6');
    await expect(durationError).toBeHidden();

    // Saisir une valeur hors plage (0) puis quitter le champ -> erreur accessible
    await durationInput.fill('0');
    await durationInput.blur();
    await expect(durationInput).toHaveAttribute('aria-invalid', 'true');
    await expect(durationError).toBeVisible();
    await expect(durationError).toContainText('1 et 60');

    const errorLightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(errorLightAxe.violations).toEqual([]);

    // Vérifier aussi en thème sombre et à 320 px
    await page.locator('#modal-preferences [data-cv-close]').first().click();
    // La fermeture réinitialise le brouillon invalide à la valeur persistée (6)
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.locator('#nav-preferences-btn').click();
    await expect(page.locator('#modal-preferences')).toHaveCSS('opacity', '1');
    await expect(durationInput).toHaveValue('6');
    await expect(durationError).toBeHidden();

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });

    const darkPrefAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkPrefAxe.violations).toEqual([]);

    // 2. Configurer 1 seconde, vérifier la persistance au rechargement
    await durationInput.fill('1');
    await durationInput.blur();
    await expect(durationInput).not.toHaveAttribute('aria-invalid', 'true');
    await expect(durationError).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    await page.reload();
    await page.locator('#nav-preferences-btn').click();
    await expect(durationInput).toHaveValue('1');
    await page.locator('#modal-preferences [data-cv-close]').first().click();

    // 3. Créer un projet : le toast de succès doit se fermer seul au bout de ~1 s
    await page.locator('[data-nav-view="projects"]').click();
    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Projet Toast');
    await page.locator('#modal-project button[type="submit"]').click();

    const successToast = page.locator('.cv-toast--success').filter({ hasText: 'Projet créé' });
    await expect(successToast).toBeVisible();
    await expect(successToast).toHaveCount(0, { timeout: 3000 });

    // 4. Pause au survol puis reprise à la sortie
    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Projet Survol');
    await page.locator('#modal-project button[type="submit"]').click();

    const hoverToast = page.locator('.cv-toast--success').filter({ hasText: 'Projet Survol' });
    await expect(hoverToast).toBeVisible();
    await hoverToast.hover();
    await page.waitForTimeout(1300);
    await expect(hoverToast).toBeVisible();
    await page.mouse.move(10, 10);
    await expect(hoverToast).toHaveCount(0, { timeout: 2500 });

    // 5. Pause au focus sur le bouton de fermeture puis reprise au départ du focus
    await page.locator('[data-nav-view="notes"]').click();
    await page.locator('#btn-new-note').click();
    await page.locator('#note-dialog-title-input').fill('Note Focus Toast');
    await page.locator('#dialog-note button[type="submit"]').click();
    // Éloigner le curseur du tiroir bas-droite pour tester uniquement la pause au focus
    await page.mouse.move(10, 10);

    const focusToast = page.locator('.cv-toast--success').filter({ hasText: 'Note créée' });
    await expect(focusToast).toBeVisible();
    await focusToast.locator('[data-cv-dismiss]').focus();
    await page.waitForTimeout(1300);
    await expect(focusToast).toBeVisible();
    await page.locator('#topbar-backup-btn').focus();
    await expect(focusToast).toHaveCount(0, { timeout: 2500 });

    // 6. Un toast warning/danger reste affiché au-delà du délai (WCAG 2.2.1) jusqu’à fermeture manuelle
    await page.evaluate(() => {
      const pm = document.querySelector('.lc-editor__surface .ProseMirror');
      if (!pm) return;
      const dt = new DataTransfer();
      dt.setData('text/plain', 'https://tracker.invalid/pixel.png');
      pm.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    const warningToast = page
      .locator('.cv-toast--warning')
      .filter({ hasText: 'Image distante bloquée' });
    await expect(warningToast).toBeVisible();
    await page.waitForTimeout(1300);
    await expect(warningToast).toBeVisible();
    await warningToast.locator('[data-cv-dismiss]').click();
    await expect(warningToast).toHaveCount(0);

    expect(externalRequests).toEqual([]);
  });
});
