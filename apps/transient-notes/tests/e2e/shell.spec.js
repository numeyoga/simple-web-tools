// The app shell: skip link, landmarks, the sidebar and its drawer below 1024 px.
import { expect, test } from '@playwright/test';
import { goToSelection, openApp } from './support.js';

const SELECTIONS = ['Toutes les notes', 'Projets', 'Domaines', 'Ressources', 'Archives'];

test('the skip link is the first stop and moves focus to the main region', async ({ page }) => {
  const { errors } = await openApp(page);
  const skip = page.getByRole('link', { name: 'Aller au contenu' });

  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');

  await expect(page.locator('main#shell-main')).toBeFocused();
  expect(errors).toEqual([]);
});

test('one banner, one navigation, one main region and one h1', async ({ page }) => {
  await openApp(page);

  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('navigation')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('the five selections are visible at 1280 × 720 and the current one follows the clicks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });

  for (const name of SELECTIONS) {
    await expect(nav.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
  }
  for (const name of SELECTIONS) {
    await nav.getByRole('button', { name }).click();
    await expect(nav.getByRole('button', { name })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }
});

test('below 1024 px the sidebar is a drawer: the menu button opens it, Escape closes it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 900 });
  const { errors } = await openApp(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  const menu = page.getByRole('button', { name: 'Menu' });

  await expect(nav).toBeHidden();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(nav).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();

  // Choosing a selection closes the drawer and shows it.
  await goToSelection(page, 'Domaines');
  await expect(nav).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Domaines');
  expect(errors).toEqual([]);
});

test('at 390 px nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(0);
});
