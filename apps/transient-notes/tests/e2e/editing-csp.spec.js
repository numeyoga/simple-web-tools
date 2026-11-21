// The strict Content Security Policy while editing: formatting, the link bar, a pasted picture,
// the toolbar tooltips and the menus raise no `securitypolicyviolation` (Tiptap's own <style> is
// replaced by editor.css, and nothing sets a `style` attribute through markup).
import { expect, test } from '@playwright/test';
import { createNote, openApp, pasteImage, watchPage, writeNote } from './support.js';

test('editing, pasting a picture and opening the link bar raise no CSP violation', async ({
  page,
}) => {
  const { violations, errors, external } = await watchPage(page);
  await openApp(page);
  await createNote(page);
  await writeNote(page, { title: 'Surveillée', body: 'du texte' });

  const toolbar = page.getByRole('toolbar', { name: 'Mise en forme du texte' });
  await page.keyboard.press('Control+A');
  for (const name of ['Gras', 'Italique', 'Titre 2', 'Liste à puces', 'Liste de tâches']) {
    await toolbar.getByRole('button', { name }).click();
  }
  const surface = page.getByRole('textbox', { name: 'Contenu de la note' });
  await expect(surface.locator('ul[data-type="taskList"]')).toBeVisible();

  // The link bar, refused then accepted.
  await toolbar.getByRole('button', { name: 'Lien', exact: true }).click();
  const address = page.getByLabel('Lien (https://)');
  await address.fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByText('Lien refusé')).toBeVisible();
  await address.fill('https://example.org');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(surface.locator('a[href="https://example.org/"]')).toBeVisible();

  // A picture, and the tooltips and menus around it.
  await pasteImage(page);
  await expect(surface.locator('img')).toHaveAttribute('src', /^blob:/);
  await toolbar.getByRole('button', { name: 'Gras' }).hover();
  await expect(page.getByRole('tooltip', { name: 'Gras' })).toBeVisible();
  await page.getByRole('button', { name: 'Exporter la note' }).click();
  await page.keyboard.press('Escape');

  // The editor must not carry a style attribute written as markup by the app or by Tiptap's
  // injected sheet (the CSSOM is allowed: the task item's hidden checkbox uses it).
  expect(await page.locator('style').count()).toBe(0);

  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
