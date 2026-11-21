// The exports: one note and every note of the workspace, as text and as Markdown. The downloads
// are read back: the file names (a safe name from the title, the local date) and the contents.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createNote, localDate, openApp, pasteImage, readStore, writeNote } from './support.js';

/**
 * Clicks a menu item and returns the downloaded file.
 * @param {import('@playwright/test').Page} page
 * @param {string} button name of the menu button
 * @param {string} item name of the menu item
 */
async function download(page, button, item) {
  await page.getByRole('button', { name: button, exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: item }).click();
  const file = await pending;
  return {
    name: file.suggestedFilename(),
    text: (await readFile(await file.path())).toString('utf8'),
  };
}

/** @param {import('@playwright/test').Page} page */
async function twoNotes(page) {
  await createNote(page);
  await writeNote(page, { title: 'Liste: courses/semaine', body: 'du pain' });
  await createNote(page);
  await writeNote(page, { title: 'Idées', body: 'une idée' });
  await expect.poll(async () => (await readStore(page, 'notes')).length).toBe(2);
  await page.waitForTimeout(400);
}

test('a note is exported as text, with a file name made from its title', async ({ page }) => {
  await openApp(page);
  await twoNotes(page);
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Liste:/ })
    .click();

  const file = await download(page, 'Exporter la note', 'En texte (.txt)');
  // `:` and `/` are not allowed in a file name.
  expect(file.name).toBe('Liste courses semaine.txt');
  expect(file.text).toBe(`Liste: courses/semaine\n${'='.repeat(50)}\n\ndu pain\n`);
});

test('a note is exported as Markdown, and a picture is a local reference', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  await writeNote(page, { title: 'Avec image', body: 'texte' });
  await pasteImage(page, 'photo.png');
  await expect.poll(async () => (await readStore(page, 'assets')).length).toBe(1);
  const [asset] = await readStore(page, 'assets');

  const file = await download(page, 'Exporter la note', 'En Markdown (.md)');
  expect(file.name).toBe('Avec image.md');
  expect(file.text).toContain('# Avec image\n\ntexte');
  expect(file.text).toContain(`![photo.png](local-asset://${asset.id})`);
});

test('a note without a title is exported as "Sans titre"', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  await writeNote(page, { body: 'corps' });
  const file = await download(page, 'Exporter la note', 'En Markdown (.md)');
  expect(file.name).toBe('Sans titre.md');
  expect(file.text).toBe('# Sans titre\n\ncorps\n');
});

test('every note of the workspace is exported as text, most recent first', async ({ page }) => {
  await openApp(page);
  await twoNotes(page);

  const file = await download(page, 'Exporter tout', 'Toutes les notes en texte (.txt)');
  expect(file.name).toBe(`transient-notes-default-${localDate()}.txt`);
  const lines = file.text.split('\n');
  expect(lines[0]).toBe('TRANSIENT NOTES - Export complet');
  expect(lines[1]).toMatch(/^Date : /);
  expect(lines[2]).toBe('Nombre de notes : 2');
  expect(file.text).toContain(`Idées\n${'='.repeat(50)}\n\nune idée`);
  expect(file.text).toContain(`Liste: courses/semaine\n${'='.repeat(50)}\n\ndu pain`);
  expect(file.text.indexOf('Idées')).toBeLessThan(file.text.indexOf('Liste: courses'));
});

test('every note is exported as Markdown, whatever the selection shows', async ({ page }) => {
  await openApp(page);
  await twoNotes(page);
  // A filter that shows one note only: the export holds them all.
  await page.getByRole('searchbox', { name: 'Rechercher dans les notes' }).fill('pain');

  const file = await download(page, 'Exporter tout', 'Toutes les notes en Markdown (.md)');
  expect(file.name).toBe(`transient-notes-default-${localDate()}.md`);
  expect(file.text).toBe('# Idées\n\nune idée\n\n---\n\n# Liste: courses/semaine\n\ndu pain\n');
});

test('there is nothing to export in an empty workspace', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Exporter tout', exact: true })).toBeDisabled();
});
