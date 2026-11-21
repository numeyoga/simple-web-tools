// The notes journey: create, edit, list with a preview, switch between notes without losing a
// keystroke, still there after a reload, delete with a confirmation, and the stacked layout of a
// narrow screen (list, then editor with a back control).
import { expect, test } from '@playwright/test';
import {
  createNote,
  openApp,
  readStore,
  showNotesList,
  waitForStoredText,
  writeNote,
} from './support.js';

/** @param {import('@playwright/test').Page} page @param {string | RegExp} name */
const noteInList = (page, name) => page.getByRole('main').getByRole('button', { name });

test('a note is created, edited, listed with a preview and still there after a reload', async ({
  page,
}) => {
  const { errors } = await openApp(page);
  await createNote(page);
  // The new note is open and its title field has the focus.
  await expect(page.getByRole('textbox', { name: 'Titre' })).toBeFocused();
  await writeNote(page, { title: 'Plan du projet', body: 'Premier paragraphe' });

  const item = noteInList(page, /^Plan du projet/);
  await expect(item).toContainText('Premier paragraphe');
  await expect(item).toHaveAttribute('aria-current', 'true');
  await waitForStoredText(page, 'Premier paragraphe');

  await page.reload();
  await expect(noteInList(page, /^Plan du projet/)).toContainText('Premier paragraphe');
  // Nothing is open after a reload: the editor invites to choose a note.
  await expect(page.getByText('Aucune note sélectionnée')).toBeVisible();
  await noteInList(page, /^Plan du projet/).click();
  await expect(page.getByRole('textbox', { name: 'Titre' })).toHaveValue('Plan du projet');
  await expect(page.getByRole('textbox', { name: 'Contenu de la note' })).toContainText(
    'Premier paragraphe',
  );
  expect(errors).toEqual([]);
});

test('a note without a title is listed as "Sans titre" and the title field is never rewritten', async ({
  page,
}) => {
  await openApp(page);
  await createNote(page);
  await expect(noteInList(page, /^Sans titre/)).toBeVisible();

  // Spaces are kept as typed: the field does not follow the stored title while it is typed in.
  await page.keyboard.type('Deux  mots ');
  await expect(noteInList(page, /^Deux mots|^Deux {2}mots/)).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByRole('textbox', { name: 'Titre' })).toHaveValue('Deux  mots ');
});

test('switching to another note keeps what was typed, with no wait', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  await writeNote(page, { title: 'Première' });
  await createNote(page);
  await writeNote(page, { title: 'Seconde' });

  // Straight after the last keystroke, before the save delay: open the first note.
  await page.getByRole('textbox', { name: 'Titre' }).pressSequentially('!');
  await noteInList(page, /^Première/).click();
  await expect(page.getByRole('textbox', { name: 'Titre' })).toHaveValue('Première');
  await expect(noteInList(page, /^Seconde!/)).toBeVisible();

  await waitForStoredText(page, 'Seconde!');
  await page.reload();
  await expect(noteInList(page, /^Seconde!/)).toBeVisible();
  await expect(noteInList(page, /^Première/)).toBeVisible();
});

test('what is typed is written as soon as the tab is hidden, before the save delay', async ({
  page,
}) => {
  await openApp(page);
  await createNote(page);
  await writeNote(page, { title: 'Brouillon', body: 'texte tapé à la dernière seconde' });
  // The tab goes to the background: the held change is written now (the delay is 300 ms).
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(async () => JSON.stringify(await readStore(page, 'notes')), {
      timeout: 250,
      intervals: [25],
    })
    .toContain('dernière seconde');
});

test('a note is deleted after a confirmation, and Cancel keeps it', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  await writeNote(page, { title: 'À supprimer' });

  await page.getByRole('button', { name: 'Supprimer la note' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer cette note ?' });
  await expect(dialog).toContainText('À supprimer');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(noteInList(page, /^À supprimer/)).toBeVisible();

  await page.getByRole('button', { name: 'Supprimer la note' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByText('Note supprimée')).toBeVisible();
  await expect(noteInList(page, /^À supprimer/)).toHaveCount(0);
  await expect(page.getByText('Aucune note sélectionnée')).toBeVisible();
  await expect(page.getByText('Aucune note ici pour le moment')).toBeVisible();

  await expect.poll(async () => (await readStore(page, 'notes')).length).toBe(0);
  await page.reload();
  await expect(page.getByText('Aucune note ici pour le moment')).toBeVisible();
});

test.describe('on a 390 px screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the list and the editor take turns, and Back returns to the note that was open', async ({
    page,
  }) => {
    await openApp(page);
    await createNote(page);
    await writeNote(page, { title: 'Mobile' });
    // The editor replaced the list.
    await expect(page.getByRole('textbox', { name: 'Titre' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Rechercher dans les notes' })).toBeHidden();

    await page.getByRole('button', { name: 'Retour aux notes' }).click();
    await expect(page.getByRole('searchbox', { name: 'Rechercher dans les notes' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Titre' })).toBeHidden();
    await expect(noteInList(page, /^Mobile/)).toBeFocused();

    await noteInList(page, /^Mobile/).click();
    await expect(page.getByRole('textbox', { name: 'Titre' })).toHaveValue('Mobile');
    await showNotesList(page);
    await expect(noteInList(page, /^Mobile/)).toBeVisible();
    // No horizontal scroll at 390 px.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
