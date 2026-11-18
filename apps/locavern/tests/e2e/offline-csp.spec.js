import { test, expect } from '@playwright/test';

test.describe('CSP stricte & fonctionnement hors ligne PWA (Étape 6)', () => {
  test('applique une CSP stricte sans CDN et fonctionne hors ligne après installation du Service Worker', async ({
    context,
    page,
  }) => {
    /** @type {string[]} */
    const externalRequests = [];
    /** @type {string[]} */
    const pageErrors = [];
    /** @type {string[]} */
    const failedRequests = [];

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
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('requestfailed', (req) =>
      failedRequests.push(`${req.url()} (${req.failure()?.errorText ?? 'failed'})`),
    );

    await page.goto('/');

    // Vérifier la balise CSP injectée au build
    const cspContent = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(cspContent).toContain("default-src 'none'");
    expect(cspContent).toContain("script-src 'self'");
    expect(cspContent).toContain("worker-src 'self'");

    // Attendre que le Service Worker contrôle l’onglet
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(undefined), {
            once: true,
          });
        });
      }
    });

    // Créer un projet en ligne, attendre la fin d’écriture IndexedDB puis passer hors ligne
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Hors ligne');
    await page.locator('#modal-project button[type="submit"]').click();
    await expect(page.locator('#task-project-filter')).toContainText('Hors ligne');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    await context.setOffline(true);
    await page.reload();

    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    await expect(page.locator('#task-project-filter')).toContainText('Hors ligne');
    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.getByRole('heading', { name: 'Hors ligne' })).toBeVisible();
    expect(externalRequests).toEqual([]);
  });

  test('affiche une notification invitant à recharger lorsqu’une mise à jour du Service Worker est prête', async ({
    page,
  }) => {
    /** @type {string[]} */
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(undefined), {
            once: true,
          });
        });
      }
    });

    await expect(page.locator('#sw-update-banner')).toHaveCount(0);

    // Enregistrer une nouvelle URL du Service Worker sur la même portée pour simuler une mise à jour prête en attente
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('./sw.js?v=2', { scope: './' });
    });

    const banner = page.locator('#sw-update-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Nouvelle version prête hors ligne');

    await Promise.all([page.waitForEvent('load'), page.locator('#btn-sw-reload').click()]);

    await expect(page.locator('#sw-update-banner')).toHaveCount(0);
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    const controllerUrl = await page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? '',
    );
    expect(controllerUrl).toContain('sw.js?v=2');
    expect(pageErrors).toEqual([]);
  });
});
