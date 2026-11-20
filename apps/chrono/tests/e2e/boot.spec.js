import { expect, test } from '@playwright/test';
import { createProject, openApp, waitForWrite } from './support.js';

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
  // Fonts and icons are bundled: nothing is requested outside the app's own origin.
  expect([...new Set(blockedHosts)]).toEqual([]);
});

test('the demo data of the first start is loaded', async ({ page }) => {
  await openApp(page, { demo: true });

  await page.getByRole('button', { name: 'Projets' }).click();

  const main = page.getByRole('main');
  await expect(main.getByText('Design system interne')).toBeVisible();
  await expect(main.getByText('Refonte site — Orion SAS')).toBeVisible();
});

test('a fresh install shows the empty state and offers the demo data, which is never loaded on its own', async ({
  page,
}) => {
  const { errors } = await openApp(page);
  const main = page.getByRole('main');

  await expect(main.getByText('Aucune session pour ce jour.')).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(main.getByText('Aucun projet actif.')).toBeVisible();
  await page.getByRole('button', { name: 'Timeline' }).click();

  await main.getByRole('button', { name: 'Charger des données de démonstration' }).click();

  await expect(
    main.getByRole('button', { name: 'Charger des données de démonstration' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(main.getByText('Design system interne')).toBeVisible();
  // The data is stored: it is still there after a reload, and the button does not come back.
  await waitForWrite(page, 'projects', 'name', 'Design system interne');
  await page.reload();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(main.getByText('Design system interne')).toBeVisible();
  await page.getByRole('button', { name: 'Timeline' }).click();
  await expect(
    main.getByRole('button', { name: 'Charger des données de démonstration' }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a workspace that has data does not offer the demo data', async ({ page }) => {
  await openApp(page);
  await createProject(page, 'Alpha');

  await expect(
    page.getByRole('main').getByRole('button', { name: 'Charger des données de démonstration' }),
  ).toHaveCount(0);
});
