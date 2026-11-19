import { expect, test } from '@playwright/test';
import { ouvrirApp } from './support.js';

test("l'application démarre : barre latérale et Timeline visibles, aucune erreur", async ({
  page,
}) => {
  const { erreurs, bloquees } = await ouvrirApp(page, { demo: true });

  const nav = page.getByRole('navigation', { name: 'Navigation' });
  await expect(nav.getByRole('button', { name: 'Timeline' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Todos' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Projets' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Rapport' })).toBeVisible();
  await expect(page.getByText('Sessions du jour')).toBeVisible();
  await expect(page.getByText('Temps travaillé')).toBeVisible();

  expect(erreurs).toEqual([]);
  // Today, the only external request is the Google Fonts stylesheet (removed in a later step).
  expect([...new Set(bloquees)]).toEqual(['fonts.googleapis.com']);
});

test('les données de démonstration du premier démarrage sont chargées', async ({ page }) => {
  await ouvrirApp(page, { demo: true });

  await page.getByRole('button', { name: 'Projets' }).click();

  const main = page.getByRole('main');
  await expect(main.getByText('Design system interne')).toBeVisible();
  await expect(main.getByText('Refonte site — Orion SAS')).toBeVisible();
});
