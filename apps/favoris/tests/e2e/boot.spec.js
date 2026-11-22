import { expect, test } from '@playwright/test';
import { addLink, card, openApp, waitForWrite } from './support.js';

test('the application starts: sidebar, one h1, the workspace, an empty board, no error, no request out', async ({
  page,
}) => {
  const { errors, blockedHosts } = await openApp(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes favoris');
  await expect(page).toHaveTitle('Favoris · tes liens en groupes de couleur');
  await expect(page.getByText('Aucun favori pour le moment')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Espace de travail Mes favoris' })).toBeVisible();

  expect(errors).toEqual([]);
  // Fonts and icons are bundled: nothing is requested outside the app's own origin.
  expect([...new Set(blockedHosts)]).toEqual([]);
});

test('a link is added, listed, counted, and still there after a reload', async ({ page }) => {
  const { errors } = await openApp(page);

  await addLink(page, { name: 'MDN', url: 'developer.mozilla.org' });

  await expect(page.getByRole('main').getByRole('link', { name: /^MDN/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /lien/ })).toHaveText('1 lien');
  await waitForWrite(page, 'links', 'name', 'MDN');
  await page.reload();
  await expect(page.getByRole('main').getByRole('link', { name: /^MDN/ })).toBeVisible();
  // A link with no group is in the card of the links with no group.
  await expect(card(page, 'Sans groupe')).toBeVisible();
  expect(errors).toEqual([]);
});

test('every name the app persists starts with the app name (all apps share one origin)', async ({
  page,
}) => {
  await openApp(page);
  await addLink(page, { name: 'MDN', url: 'developer.mozilla.org' });
  await waitForWrite(page, 'links', 'name', 'MDN');
  await page.getByRole('button', { name: 'Préférences' }).click();
  await page.getByRole('radio', { name: 'Sombre' }).check();

  const names = await page.evaluate(async () => ({
    keys: Object.keys(localStorage),
    databases: (await indexedDB.databases()).map((d) => d.name),
  }));

  expect(names.keys.length).toBeGreaterThan(0);
  expect(names.keys.every((key) => key.startsWith('favoris-'))).toBe(true);
  expect(names.databases).toEqual(['favoris__default']);
});
