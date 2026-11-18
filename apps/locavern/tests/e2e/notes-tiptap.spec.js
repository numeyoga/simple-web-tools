import { test, expect } from '@playwright/test';

const TINY_PNG_PATH = new URL('./fixtures/tiny.png', import.meta.url).pathname;

test.describe('Notes enrichies Tiptap & images locales (Étape 5)', () => {
  test('édite une note, embarque une image locale dans IndexedDB et bloque les images distantes', async ({
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
    await page.locator('[data-nav-view="notes"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Notes');

    // Créer une note via la fenêtre de saisie dédiée
    await page.getByRole('button', { name: 'Créer une note' }).click();
    await expect(page.locator('#dialog-note')).toBeVisible();
    await page.locator('#note-dialog-title-input').fill('Note architecture');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#dialog-note')).toBeHidden();
    await expect(page.locator('#note-title-input')).toHaveValue('Note architecture');

    const editor = page.locator('.lc-editor__surface .ProseMirror');
    await editor.click();
    await page.keyboard.type('Contenu local ');
    await page.getByRole('button', { name: 'Gras' }).click();
    await page.keyboard.type('important');

    // Insérer une image locale via le sélecteur de fichier Tiptap
    await page.locator('.lc-editor .lc-file-input-hidden').setInputFiles(TINY_PNG_PATH);

    const localImg = page.locator('.lc-editor__surface img[data-asset-id]');
    await expect(localImg).toBeVisible();
    await expect(localImg).toHaveAttribute('src', /^blob:/);

    // Tenter de coller une URL d’image distante -> avertissement et aucune requête réseau externe
    await page.evaluate(() => {
      const pm = document.querySelector('.lc-editor__surface .ProseMirror');
      if (!pm) return;
      const dt = new DataTransfer();
      dt.setData('text/plain', 'https://tracker.invalid/pixel.png');
      pm.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    await expect(page.locator('.cv-toast-region')).toContainText('Image distante bloquée');
    expect(externalRequests).toEqual([]);

    // Enregistrer explicitement, attendre la fin de l’écriture IndexedDB puis recharger (ouvre en consultation)
    await page.locator('#btn-save-note').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Note enregistrée');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
    await page.reload();

    await expect(page.locator('#topbar-title')).toHaveText('Notes');
    await expect(page.locator('#note-consult-title')).toHaveText('Note architecture');
    await expect(page.locator('.lc-editor__surface .ProseMirror')).toContainText('Contenu local');
    await expect(page.locator('.lc-editor__surface img[data-asset-id]')).toHaveAttribute(
      'src',
      /^blob:/,
    );

    // Vérifier conservation de l’image dans l’export -> reset -> import
    await page.locator('#topbar-backup-btn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-archive').click();
    const download = await downloadPromise;
    const zipPath = await download.path();

    await page.locator('#btn-reset-all-data').click();
    await page.locator('#modal-confirm').getByRole('button', { name: 'Effacer tout' }).click();
    await expect(page.getByText('Aucune note disponible')).toBeVisible();

    await page.locator('#topbar-backup-btn').click();
    await page.locator('#input-import-archive').setInputFiles(/** @type {string} */ (zipPath));
    await expect(page.locator('#import-archive-panel')).toBeVisible();
    await page.locator('input[name="import-mode"][value="replace"]').check();
    await page.locator('#btn-confirm-import-archive').click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Importer et remplacer' })
      .click();

    await expect(page.locator('#note-consult-title')).toHaveText('Note architecture');
    await expect(page.locator('.lc-editor__surface img[data-asset-id]')).toHaveAttribute(
      'src',
      /^blob:/,
    );

    // Passer en modification pour supprimer la note -> placée en corbeille locale, puis vidage définitif purge l’image d’IndexedDB
    await page.locator('#btn-switch-note-edit').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Note architecture');
    await page.locator('#btn-delete-note').click();
    await page.locator('#modal-confirm').getByRole('button', { name: 'Supprimer la note' }).click();
    await expect(page.getByText('Aucune note disponible')).toBeVisible();
    await expect(page.locator('#nav-trash-count')).toHaveText('1');

    await page.locator('#nav-trash-btn').click();
    await expect(page.locator('#modal-trash')).toHaveAttribute('open', '');
    await page.locator('#btn-empty-trash').click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Vider la corbeille' })
      .click();
    await expect(page.locator('#nav-trash-count')).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    const remainingAssetCount = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('locavern-db');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('assets', 'readonly');
            const countReq = tx.objectStore('assets').count();
            countReq.onsuccess = () => {
              db.close();
              resolve(countReq.result);
            };
            countReq.onerror = () => reject(countReq.error);
          };
        }),
    );
    expect(remainingAssetCount).toBe(0);
  });

  test('expose les titres H1/H3, duplique une note et exporte en Markdown (.md)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="notes"]').click();

    await page.getByRole('button', { name: 'Créer une note' }).click();
    await page.locator('#note-dialog-title-input').fill('Guide Markdown');
    await page.locator('#dialog-note button[type="submit"]').click();
    await expect(page.locator('#dialog-note')).toBeHidden();

    const editor = page.locator('.lc-editor__surface .ProseMirror');
    await editor.click();
    await page.getByRole('button', { name: 'Titre 1', exact: true }).click();
    await page.keyboard.type('Introduction');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Titre 3', exact: true }).click();
    await page.keyboard.type('Détails techniques');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Texte brut local');

    await expect(editor.locator('h1')).toContainText('Introduction');
    await expect(editor.locator('h3')).toContainText('Détails techniques');

    // Dupliquer la note
    await page.locator('#btn-duplicate-note').click();
    await expect(page.locator('#note-title-input')).toHaveValue('Guide Markdown (copie)');
    await expect(page.locator('.lc-notes-list')).toContainText('Guide Markdown (copie)');
    await expect(editor.locator('h1')).toContainText('Introduction');

    // Exporter la copie en Markdown (.md)
    const mdDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-note-md').click();
    const mdDownload = await mdDownloadPromise;
    expect(mdDownload.suggestedFilename()).toBe('guide-markdown-copie.md');
    const mdStream = await mdDownload.createReadStream();
    /** @type {string[]} */
    const chunks = [];
    for await (const chunk of mdStream) {
      chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    const mdContent = chunks.join('');
    expect(mdContent).toContain('# Guide Markdown (copie)');
    expect(mdContent).toContain('# Introduction');
    expect(mdContent).toContain('### Détails techniques');
    expect(mdContent).toContain('Texte brut local');
  });
});
