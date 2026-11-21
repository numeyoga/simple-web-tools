// Search and sort of the notes list: the `/` shortcut, accent and case insensitive search in the
// title and the text, the counter, the empty result, the three sorts, and the sort that is kept.
import { expect, test } from '@playwright/test';
import { createNote, openApp, readStore, writeNote } from './support.js';

/** @param {import('@playwright/test').Page} page */
const titles = (page) => page.locator('.tn-note-title');
/** @param {import('@playwright/test').Page} page */
const search = (page) => page.getByRole('searchbox', { name: 'Rechercher dans les notes' });

/**
 * Creates notes one after the other, each with its title and body.
 * @param {import('@playwright/test').Page} page
 * @param {{ title: string, body?: string }[]} notes
 */
async function createNotes(page, notes) {
  for (const note of notes) {
    await createNote(page);
    await writeNote(page, note);
    // Distinct timestamps: the sorts compare them.
    await page.waitForTimeout(15);
  }
  await expect.poll(async () => (await readStore(page, 'notes')).length).toBe(notes.length);
}

test('/ focuses the search field, and typing filters by title and text', async ({ page }) => {
  await openApp(page);
  await createNotes(page, [
    { title: 'École de musique', body: 'inscription en septembre' },
    { title: 'Courses', body: 'du pain et du lait' },
    { title: 'Voyage', body: 'billets de train pour la Bretagne' },
  ]);
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  await expect(search(page)).toBeFocused();
  await expect(page.getByText('3 notes')).toBeVisible();

  // Accents and case do not matter, the title is searched.
  await page.keyboard.type('ECOLE');
  await expect(titles(page)).toHaveText(['École de musique']);
  await expect(page.getByText('1 note', { exact: true })).toBeVisible();

  // The text of the note is searched too, with several words (all of them must match).
  await search(page).fill('train bretagne');
  await expect(titles(page)).toHaveText(['Voyage']);

  // Nothing matches: a message, and the field keeps what was typed.
  await search(page).fill('zzz');
  await expect(page.getByText('Aucune note ne correspond')).toBeVisible();
  await expect(search(page)).toHaveValue('zzz');

  await search(page).fill('');
  await expect(titles(page)).toHaveCount(3);
});

test('"/" typed in a text field is a letter, not a shortcut', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  await page.keyboard.type('a/b');
  await expect(page.getByRole('textbox', { name: 'Titre' })).toHaveValue('a/b');
  await expect(search(page)).not.toBeFocused();
});

test('the sorts: last edited, creation date, title', async ({ page }) => {
  await openApp(page);
  await createNotes(page, [{ title: 'Banane' }, { title: 'Cerise' }, { title: 'Ananas' }]);
  const sort = page.getByRole('combobox', { name: 'Trier par' });

  // Last edited first: Ananas was written last.
  await expect(titles(page)).toHaveText(['Ananas', 'Cerise', 'Banane']);

  await sort.selectOption({ label: 'Titre' });
  await expect(titles(page)).toHaveText(['Ananas', 'Banane', 'Cerise']);

  // Edit the oldest note: it comes first by last edit, but stays last by creation date.
  await page
    .getByRole('main')
    .getByRole('button', { name: /^Banane/ })
    .click();
  await page.getByRole('textbox', { name: 'Contenu de la note' }).click();
  await page.keyboard.type('retouchée');
  await sort.selectOption({ label: 'Dernière modification' });
  await expect(titles(page)).toHaveText(['Banane', 'Ananas', 'Cerise']);
  await sort.selectOption({ label: 'Date de création' });
  await expect(titles(page)).toHaveText(['Ananas', 'Cerise', 'Banane']);
});

test('the chosen sort is kept after a reload', async ({ page }) => {
  await openApp(page);
  await createNotes(page, [{ title: 'B' }, { title: 'A' }]);
  await page.getByRole('combobox', { name: 'Trier par' }).selectOption({ label: 'Titre' });
  await expect(titles(page)).toHaveText(['A', 'B']);
  await expect
    .poll(async () => JSON.stringify(await readStore(page, 'meta')))
    .toContain('"sort":"title"');

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Trier par' })).toHaveValue('title');
  await expect(titles(page)).toHaveText(['A', 'B']);
});
