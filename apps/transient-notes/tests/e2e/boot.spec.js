import { expect, test } from '@playwright/test';
import { createNote, goToSelection, openApp, waitForWrite } from './support.js';

test('the application starts: sidebar, one h1, the workspace, no error and no request out', async ({
  page,
}) => {
  const { errors, blockedHosts } = await openApp(page);

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const name of ['Toutes les notes', 'Projets', 'Domaines', 'Ressources', 'Archives']) {
    await expect(nav.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toutes les notes');
  await expect(nav.getByRole('button', { name: 'Toutes les notes' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // The workspace is visible in the sidebar, with its name.
  await expect(
    page.getByRole('button', { name: 'Espace de travail Espace principal' }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Transient Notes · notes classées avec PARA');
  await expect(page.getByRole('main').getByText('Aucune note ici pour le moment')).toBeVisible();

  expect(errors).toEqual([]);
  // Fonts and icons are bundled: nothing is requested outside the app's own origin.
  expect([...new Set(blockedHosts)]).toEqual([]);
});

test('a note is created, listed, counted, and still there after a reload', async ({ page }) => {
  const { errors } = await openApp(page);
  const main = page.getByRole('main');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });

  await createNote(page);

  await expect(main.getByRole('button', { name: 'Sans titre' })).toBeVisible();
  await expect(nav.getByRole('button', { name: /^Toutes les notes/ })).toContainText('1');
  await waitForWrite(page, 'notes', 'title', '');
  await page.reload();
  await expect(main.getByRole('button', { name: 'Sans titre' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a category with no folder gets its default folder when a note is created in it', async ({
  page,
}) => {
  await openApp(page);
  await goToSelection(page, 'Ressources');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ressources');

  await createNote(page);

  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toBeVisible();
  await waitForWrite(page, 'folders', 'name', 'Ressources générales');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ressources');
  // The note is counted in its category, and in "All notes".
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('button', { name: /^Ressources/ })).toContainText('1');
  await expect(nav.getByRole('button', { name: /^Projets/ })).toContainText('0');
  await goToSelection(page, 'Archives');
  await expect(page.getByRole('main').getByText('Aucune note ici pour le moment')).toBeVisible();
});

test('a selection shows the notes of its category only', async ({ page }) => {
  await openApp(page);
  await goToSelection(page, 'Projets');
  await createNote(page);
  await goToSelection(page, 'Domaines');
  await expect(page.getByRole('main').getByText('Aucune note ici pour le moment')).toBeVisible();
  await goToSelection(page, 'Toutes les notes');
  await expect(page.getByRole('main').getByRole('button', { name: 'Sans titre' })).toHaveCount(1);
});
