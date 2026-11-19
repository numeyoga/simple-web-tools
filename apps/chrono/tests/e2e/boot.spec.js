import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

test('the application starts: sidebar and Timeline visible, no error', async ({ page }) => {
  const { errors, blockedHosts } = await openApp(page, { demo: true });

  const nav = page.getByRole('navigation', { name: 'Navigation' });
  await expect(nav.getByRole('button', { name: 'Timeline' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Todos' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Projets' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Rapport' })).toBeVisible();
  await expect(page.getByText('Sessions du jour')).toBeVisible();
  await expect(page.getByText('Temps travaillé')).toBeVisible();

  expect(errors).toEqual([]);
  // Today, the only external request is the Google Fonts stylesheet (removed in a later step).
  expect([...new Set(blockedHosts)]).toEqual(['fonts.googleapis.com']);
});

test('the demo data of the first start is loaded', async ({ page }) => {
  await openApp(page, { demo: true });

  await page.getByRole('button', { name: 'Projets' }).click();

  const main = page.getByRole('main');
  await expect(main.getByText('Design system interne')).toBeVisible();
  await expect(main.getByText('Refonte site — Orion SAS')).toBeVisible();
});
