// Pictures in a note: pasted, picked with the toolbar button and dropped images are stored as
// assets of the workspace, shown from a blob: URL, still there after a reload, refused when they
// are not pictures, and erased with the note that alone uses them.
import { expect, test } from '@playwright/test';
import { PNG_BASE64, createNote, openApp, pasteImage, readStore, writeNote } from './support.js';

/** @param {import('@playwright/test').Page} page */
const pictures = (page) => page.getByRole('textbox', { name: 'Contenu de la note' }).locator('img');

/** Waits until the picture is drawn: loaded from its blob: URL, 1 pixel wide. @param {import('@playwright/test').Locator} picture */
async function expectLoaded(picture) {
  await expect(picture).toHaveAttribute('src', /^blob:/);
  await expect
    .poll(() => picture.evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth))
    .toBe(1);
}

test('a pasted picture is stored, drawn, and still there after a reload', async ({ page }) => {
  const { errors } = await openApp(page);
  await createNote(page);
  await writeNote(page, { title: 'Avec image' });
  await pasteImage(page, 'capture.png');

  await expect(pictures(page)).toHaveCount(1);
  await expectLoaded(pictures(page));
  await expect(pictures(page)).toHaveAttribute('alt', 'capture.png');
  await expect.poll(async () => (await readStore(page, 'assets')).length).toBe(1);
  const [asset] = await readStore(page, 'assets');
  expect(asset).toMatchObject({ mime: 'image/png' });
  // The document holds the id of the picture, never its bytes.
  await expect.poll(async () => JSON.stringify(await readStore(page, 'notes'))).toContain(asset.id);
  expect(JSON.stringify(await readStore(page, 'notes'))).not.toContain(PNG_BASE64);

  await page.reload();
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Avec image/ })
    .click();
  await expectLoaded(pictures(page));
  expect(errors).toEqual([]);
});

test('a picture is picked with the toolbar button, a file that is no picture is refused', async ({
  page,
}) => {
  await openApp(page);
  await createNote(page);
  const input = page.locator('.lc-editor input[type="file"]');
  await expect(input).toBeAttached();

  await input.setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  });
  await expectLoaded(pictures(page));

  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('pas une image'),
  });
  await expect(page.getByText('Image non ajoutée')).toBeVisible();
  await expect(pictures(page)).toHaveCount(1);
});

test('a dropped picture is inserted', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  const editor = page.getByRole('textbox', { name: 'Contenu de la note' });
  await editor.click();
  await editor.evaluate((node, base64) => {
    const bytes = Uint8Array.from(atob(String(base64)), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'depose.png', { type: 'image/png' }));
    const box = node.getBoundingClientRect();
    node.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: data,
        clientX: box.left + 20,
        clientY: box.top + 20,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, PNG_BASE64);
  await expectLoaded(pictures(page));
  await expect(pictures(page)).toHaveAttribute('alt', 'depose.png');
});

test('deleting a note erases the pictures only it uses', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  await pasteImage(page);
  await expectLoaded(pictures(page));
  await expect.poll(async () => (await readStore(page, 'assets')).length).toBe(1);
  await expect
    .poll(async () => JSON.stringify(await readStore(page, 'notes')))
    .toContain('localImage');

  await page.getByRole('button', { name: 'Supprimer la note' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect.poll(async () => (await readStore(page, 'assets')).length).toBe(0);
});
