import { test, expect } from '@playwright/test';

test('enregistre une archive et les images dans le dossier choisi, puis permet de le retirer', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => ({
        kind: 'directory',
        name: 'Sauvegardes test',
        requestPermission: async () => 'granted',
        getFileHandle: async (/** @type {string} */ filename) => ({
          createWritable: async () => ({
            write: async (/** @type {Blob} */ blob) => {
              sessionStorage.setItem('export-filename', filename);
              sessionStorage.setItem('export-size', String(blob.size));
            },
            close: async () => sessionStorage.setItem('export-closed', 'yes'),
            abort: async () => {},
          }),
        }),
      }),
    });
  });
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.goto('/');
  await page.locator('#topbar-backup-btn').click();
  await page.locator('#btn-choose-export-directory').click();
  await expect(page.locator('#export-directory-status')).toContainText('Sauvegardes test');
  await page.locator('#btn-export-archive').click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('export-filename')))
    .toMatch(/^locavern-sauvegarde-.*\.zip$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('export-closed'))).toBe('yes');
  expect(await page.evaluate(() => Number(sessionStorage.getItem('export-size')))).toBeGreaterThan(
    0,
  );
  await page.keyboard.press('Escape');

  await page.locator('[data-nav-view="whiteboards"]').click();
  await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
  await page.locator('#whiteboard-dialog-title-input').fill('Plan local');
  await page.locator('#dialog-whiteboard button[type="submit"]').click();
  await page.locator('#btn-export-wb-svg').click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('export-filename')))
    .toMatch(/\.svg$/);
  await page.locator('#btn-export-wb-png').click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('export-filename')))
    .toMatch(/\.png$/);
  expect(downloads).toBe(0);

  await page.locator('#topbar-backup-btn').click();
  await page.locator('#btn-forget-export-directory').click();
  await expect(page.locator('#export-directory-status')).toContainText('Aucun dossier choisi');
  const download = page.waitForEvent('download');
  await page.locator('#btn-export-archive').click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
});

test('explique le téléchargement de repli lorsque le dossier est indisponible', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });
  });
  await page.goto('/');
  await page.locator('#topbar-backup-btn').click();
  await expect(page.locator('#export-directory-status')).toContainText('téléchargement classique');
  await expect(page.locator('#btn-choose-export-directory')).toHaveCount(0);
});
