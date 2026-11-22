import { test, expect } from '@playwright/test';

// The rich-text editor (Tiptap) and the whiteboard canvas are code-split: the first screen does
// not fetch them, the screens that need them do, the service worker precaches them for offline
// use, and a failed fetch shows a translated error with a retry. The interface is in French
// (see playwright.config.js).

const EDITOR_CHUNK = /\/assets\/rich-text-tiptap-[\w-]+\.js$/;
const WHITEBOARD_CHUNK = /\/assets\/whiteboard-view-[\w-]+\.js$/;

/** @param {import('@playwright/test').Page} page @param {RegExp} pattern @returns {string[]} */
function trackRequests(page, pattern) {
  /** @type {string[]} */
  const urls = [];
  page.on('request', (request) => {
    if (pattern.test(new URL(request.url()).pathname)) urls.push(request.url());
  });
  return urls;
}

/** @param {import('@playwright/test').Page} page */
async function createNote(page, title = 'Note paresseuse') {
  await page.locator('[data-nav-view="notes"]').click();
  await expect(page.locator('#topbar-title')).toHaveText('Notes');
  await page.getByRole('button', { name: 'Créer une note' }).click();
  await page.locator('#note-dialog-title-input').fill(title);
  await page.locator('#dialog-note button[type="submit"]').click();
  await expect(page.locator('#note-title-input')).toHaveValue(title);
}

test.describe('Lazy chunks: rich-text editor and whiteboard', () => {
  test('the editor chunk is not fetched at startup, then notes open and edit after the lazy load', async ({
    page,
  }) => {
    /** @type {string[]} */
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const editorRequests = trackRequests(page, EDITOR_CHUNK);

    await page.goto('/');
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    await page.locator('[data-nav-view="notes"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Notes');
    // The notes list and its empty state need no editor.
    expect(editorRequests).toEqual([]);

    await createNote(page);
    // A note editor: the chunk arrives, the editor mounts with its toolbar, a loading state is gone.
    const editor = page.locator('.lc-editor__surface .ProseMirror');
    await expect(editor).toBeVisible();
    await expect(page.locator('.lc-lazy-loading')).toHaveCount(0);
    expect(editorRequests).toHaveLength(1);

    await editor.click();
    await page.keyboard.type('Texte après chargement ');
    await page.getByRole('button', { name: 'Gras' }).click();
    await page.keyboard.type('gras');
    await page.locator('#btn-save-note').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Note enregistrée');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    // Back from the consult mode, the chunk is not fetched twice.
    await page.reload();
    await expect(page.locator('#note-consult-title')).toHaveText('Note paresseuse');
    await expect(page.locator('.lc-editor__surface .ProseMirror')).toContainText(
      'Texte après chargement gras',
    );
    await page.locator('#btn-switch-note-edit').click();
    await expect(page.locator('[role="toolbar"].lc-editor__toolbar')).toBeVisible();
    await page.locator('.lc-editor__surface .ProseMirror').click();
    await page.keyboard.type(' suite');
    await expect(page.locator('.lc-editor__surface .ProseMirror')).toContainText('gras suite');
    expect(pageErrors).toEqual([]);
  });

  test('the task drawer description editor also comes from the lazy chunk and keeps its tooltips', async ({
    page,
  }) => {
    const editorRequests = trackRequests(page, EDITOR_CHUNK);
    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet paresseux');
    await page.locator('#modal-project button[type="submit"]').click();
    expect(editorRequests).toEqual([]);

    await page.locator('#btn-new-task').click();
    const toolbar = page.locator('#drawer-task [role="toolbar"].lc-editor__toolbar');
    await expect(toolbar).toBeVisible();
    // Tooltips are wired once the editor has arrived.
    await expect(toolbar.locator('button[aria-label="Gras"] + .cv-tooltip')).toHaveCount(1);
    expect(editorRequests).toHaveLength(1);

    await page.locator('#task-title-input').fill('Tâche avec description');
    await page.locator('#drawer-task .lc-editor__surface .ProseMirror').click();
    await page.keyboard.type('Description saisie');
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.locator('#drawer-task')).toBeHidden();
    await page
      .getByRole('button', { name: /Tâche avec description/ })
      .first()
      .click();
    await expect(page.locator('#drawer-task .lc-editor__surface .ProseMirror')).toContainText(
      'Description saisie',
    );
  });

  test('the whiteboard chunk is not fetched at startup but when the whiteboards screen opens', async ({
    page,
  }) => {
    const whiteboardRequests = trackRequests(page, WHITEBOARD_CHUNK);
    await page.goto('/');
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    expect(whiteboardRequests).toEqual([]);

    await page.locator('[data-nav-view="whiteboards"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau paresseux');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('.lc-wb-svg')).toBeVisible();
    expect(whiteboardRequests).toHaveLength(1);
  });

  // Failure tests block the service worker: it would answer from its cache and hide the abort.
  test.describe('without a service worker', () => {
    test.use({ serviceWorkers: 'block' });

    test('shows a translated error when the editor chunk cannot be fetched, then recovers on retry', async ({
      page,
    }) => {
      await page.goto('/');
      await page.locator('[data-nav-view="notes"]').click();
      await expect(page.locator('#topbar-title')).toHaveText('Notes');

      await page.route(EDITOR_CHUNK, (route) => route.abort('failed'));
      await page.getByRole('button', { name: 'Créer une note' }).click();
      await page.locator('#note-dialog-title-input').fill('Note hors réseau');
      await page.locator('#dialog-note button[type="submit"]').click();

      const alert = page.locator('.lc-lazy-error');
      await expect(alert).toBeVisible();
      await expect(alert).toHaveAttribute('role', 'alert');
      await expect(alert).toContainText('Impossible de charger l’éditeur.');
      await expect(alert).toContainText('Vérifiez votre connexion');
      await expect(page.locator('.lc-editor__surface')).toHaveCount(0);

      await page.unroute(EDITOR_CHUNK);
      await alert.getByRole('button', { name: 'Réessayer' }).click();
      await expect(page.locator('.lc-editor__surface .ProseMirror')).toBeVisible();
      await expect(page.locator('.lc-lazy-error')).toHaveCount(0);
    });

    test('the editor error is shown in English when the browser language is English', async ({
      browser,
    }) => {
      const context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.goto('/');
      await page.locator('[data-nav-view="notes"]').click();
      await page.route(EDITOR_CHUNK, (route) => route.abort('failed'));
      await page.getByRole('button', { name: 'Create a note' }).click();
      await page.locator('#note-dialog-title-input').fill('Offline note');
      await page.locator('#dialog-note button[type="submit"]').click();
      const alert = page.locator('.lc-lazy-error');
      await expect(alert).toContainText('Couldn’t load the editor.');
      await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
      await context.close();
    });

    test('shows a translated error when the whiteboard chunk cannot be fetched, then recovers on retry', async ({
      page,
    }) => {
      await page.goto('/');
      await page.route(WHITEBOARD_CHUNK, (route) => route.abort('failed'));
      await page.locator('[data-nav-view="whiteboards"]').click();
      const alert = page.locator('.lc-lazy-error');
      await expect(alert).toContainText('Impossible de charger les tableaux blancs.');
      await page.unroute(WHITEBOARD_CHUNK);
      await alert.getByRole('button', { name: 'Réessayer' }).click();
      await expect(page.locator('.lc-lazy-error')).toHaveCount(0);
      await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
      await expect(page.getByRole('button', { name: 'Créer un tableau blanc' })).toBeVisible();
    });
  });

  test('the service worker precaches both chunks and notes and whiteboards open offline after a first visit', async ({
    context,
    page,
  }) => {
    /** @type {string[]} */
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
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

    // Every file of the build manifest, the lazy chunks included, is in the worker's cache.
    const cached = await page.evaluate(async () => {
      const manifest = /** @type {string[]} */ (
        await (await fetch('./precache-manifest.json')).json()
      );
      const name = (await caches.keys()).find((key) => key.startsWith('locavern-shell-'));
      const cache = await caches.open(name ?? '');
      const keys = (await cache.keys()).map((request) => new URL(request.url).pathname);
      return {
        chunks: manifest.filter((entry) => /rich-text-tiptap-|whiteboard-view-/.test(entry)),
        missing: manifest.filter((entry) => !keys.includes(new URL(entry, location.href).pathname)),
      };
    });
    expect(cached.chunks).toHaveLength(2);
    expect(cached.missing).toEqual([]);

    // Online: a project and a note with text.
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Projet hors ligne');
    await page.locator('#modal-project button[type="submit"]').click();
    await expect(page.locator('#task-project-filter')).toContainText('Projet hors ligne');
    await createNote(page, 'Note hors ligne');
    await page.locator('.lc-editor__surface .ProseMirror').click();
    await page.keyboard.type('Écrit en ligne');
    await page.locator('#btn-save-note').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Note enregistrée');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    // Offline, on a fresh page load: the chunks come from the cache.
    await context.setOffline(true);
    await page.reload();
    await page.locator('[data-nav-view="notes"]').click();
    await expect(page.locator('#note-consult-title')).toHaveText('Note hors ligne');
    await expect(page.locator('.lc-editor__surface .ProseMirror')).toContainText('Écrit en ligne');
    await page.locator('#btn-switch-note-edit').click();
    await page.locator('.lc-editor__surface .ProseMirror').click();
    await page.keyboard.type(' et hors ligne');
    await expect(page.locator('.lc-editor__surface .ProseMirror')).toContainText('et hors ligne');
    await page.locator('#btn-save-note').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Note enregistrée');

    await page.locator('[data-nav-view="whiteboards"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau hors ligne');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('.lc-wb-svg')).toBeVisible();
    await expect(page.locator('.lc-lazy-error')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
});
