// Search over the name, the address and the group of the links, and the two shortcuts that go to
// it: `/` (a single-key shortcut, which the preferences can turn off) and Ctrl+K.
import { expect, test } from '@playwright/test';
import { addGroup, addLink, card, openApp } from './support.js';

/** A board to search: three links in two groups. @param {import('@playwright/test').Page} page */
async function fill(page) {
  await addGroup(page, 'Documentation');
  await addGroup(page, 'Lectures');
  await addLink(page, {
    name: 'MDN Web Docs',
    url: 'developer.mozilla.org',
    group: 'Documentation',
  });
  await addLink(page, { name: 'Hacker News', url: 'news.ycombinator.com', group: 'Lectures' });
  await addLink(page, { name: 'Café du coin', url: 'cafe.example', group: 'Lectures' });
}

const search = (/** @type {import('@playwright/test').Page} */ page) =>
  page.getByRole('searchbox', { name: 'Rechercher dans les liens' });

test('the search filters by name, address and group, without case or accents', async ({ page }) => {
  await openApp(page);
  await fill(page);
  const count = page.getByRole('status').filter({ hasText: /lien|résultat/ });
  await expect(count).toHaveText('3 liens');

  await search(page).fill('hacker');
  await expect(page.getByRole('link', { name: /^Hacker News/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^MDN/ })).toHaveCount(0);
  await expect(count).toHaveText('1 résultat');
  // Only the cards that hold a match are shown.
  await expect(card(page, 'Documentation')).toHaveCount(0);

  await search(page).fill('MOZILLA');
  await expect(page.getByRole('link', { name: /^MDN/ })).toBeVisible();

  await search(page).fill('lectures');
  await expect(card(page, 'Lectures').getByRole('link')).toHaveCount(2);

  await search(page).fill('cafe');
  await expect(page.getByRole('link', { name: /^Café du coin/ })).toBeVisible();

  await search(page).fill('');
  await expect(count).toHaveText('3 liens');
  await expect(card(page, 'Documentation')).toBeVisible();
});

test('a search with no match says so, and offers to change it', async ({ page }) => {
  await openApp(page);
  await fill(page);

  await search(page).fill('zzzzz');

  await expect(page.getByText('Aucun résultat', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Aucun lien ne correspond à « zzzzz »')).toBeVisible();
  await search(page).fill('');
  await expect(page.getByRole('link', { name: /^MDN/ })).toBeVisible();
});

test('the search keeps the focus while the board is drawn again', async ({ page }) => {
  await openApp(page);
  await fill(page);

  await search(page).click();
  await page.keyboard.type('hack');

  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('hack');
});

test('"/" and Ctrl+K go to the search; "/" stays a character while typing', async ({ page }) => {
  await openApp(page);
  await fill(page);
  await page.getByRole('main').click({ position: { x: 5, y: 400 } });

  await page.keyboard.press('/');
  await expect(search(page)).toBeFocused();
  await page.keyboard.type('a/b');
  await expect(search(page)).toHaveValue('a/b');

  await page.getByRole('heading', { level: 1 }).click();
  await expect(search(page)).not.toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(search(page)).toBeFocused();
});

test('the single-key shortcuts can be turned off, and Ctrl+K stays', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Préférences' }).click();
  await page.getByRole('switch', { name: /^Raccourcis à une touche/ }).uncheck();
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { level: 1 }).click();

  await page.keyboard.press('/');
  await page.keyboard.press('n');
  await expect(search(page)).not.toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(search(page)).toBeFocused();
});

test('"n" opens the new link dialog', async ({ page }) => {
  await openApp(page);
  await page.getByRole('heading', { level: 1 }).click();

  await page.keyboard.press('n');

  await expect(page.getByRole('dialog', { name: 'Nouveau lien' })).toBeVisible();
});
