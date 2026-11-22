// The frame: brand first and the app switcher last in the sidebar, the top bar, the drawer of the
// narrow layout.
import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

test('the sidebar shows the brand first and the app switcher last, with the six apps', async ({
  page,
}) => {
  const { errors } = await openApp(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  const apps = nav.getByRole('list', { name: 'Applications', exact: true });

  const brand = nav.locator('.cv-sidebar__brand');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveText('Dashboard');
  await expect(nav.locator(':scope > :first-child')).toHaveClass(/cv-sidebar__brand/);
  await expect(nav.locator(':scope > :last-child')).toHaveClass(/swt-switcher/);

  const links = apps.getByRole('link');
  await expect(links).toHaveText([
    'Chrono',
    'Locavern',
    'Transient Notes',
    'Favoris',
    'Dashboard',
    'Slides',
  ]);
  await expect(links.nth(0)).toHaveAttribute('href', '../chrono/');
  await expect(links.nth(1)).toHaveAttribute('href', '../locavern/');
  await expect(links.nth(2)).toHaveAttribute('href', '../transient-notes/');
  await expect(links.nth(3)).toHaveAttribute('href', '../favoris/');
  await expect(links.nth(4)).toHaveAttribute('href', './');
  await expect(links.nth(4)).toHaveAttribute('aria-current', 'page');
  await expect(links.nth(5)).toHaveAttribute('href', '../slides/');
  await expect(apps.locator('[aria-current="page"]')).toHaveCount(1);
  // The top bar still ends with the preferences button.
  await expect(
    page.locator('.cv-topbar > :last-child').getByRole('button', { name: 'Préférences' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('below 1024 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the sidebar is a drawer: the menu button opens it, Escape closes it and focus returns', async ({
    page,
  }) => {
    await openApp(page);
    const menu = page.getByRole('button', { name: 'Menu' });
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav).toBeHidden();

    await menu.click();
    await expect(nav).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test('the page does not scroll sideways, and the top bar keeps its buttons named', async ({
    page,
  }) => {
    await openApp(page);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole('button', { name: 'Nouvelle application' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Préférences' })).toBeVisible();
  });
});
