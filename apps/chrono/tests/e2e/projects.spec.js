import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

test('project: creation then archiving', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();
  const main = page.getByRole('main');

  await main.getByRole('button', { name: 'Nouveau projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialog.getByRole('textbox', { name: 'Nom du projet' }).fill('Projet Alpha');
  await dialog.getByRole('textbox', { name: 'Client' }).fill('Acme');
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();

  await expect(main.getByText('Projet Alpha')).toBeVisible();
  await expect(main.getByText('1 actifs · 0 archivés')).toBeVisible();

  await main.getByRole('button', { name: 'Archiver' }).click();

  await expect(main.getByText('Aucun projet actif.')).toBeVisible();
  await expect(main.getByText('0 actifs · 1 archivés')).toBeVisible();
  await main.getByRole('button', { name: 'Actifs' }).click(); // switches to the list of the archived ones
  await expect(main.getByText('Projet Alpha')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Désarchiver' })).toBeVisible();

  expect(errors).toEqual([]);
});
