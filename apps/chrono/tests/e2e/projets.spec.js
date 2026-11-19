import { expect, test } from '@playwright/test';
import { ouvrirApp } from './support.js';

test('projet : création puis archivage', async ({ page }) => {
  const { erreurs } = await ouvrirApp(page);
  await page.getByRole('button', { name: 'Projets' }).click();
  const main = page.getByRole('main');

  await main.getByRole('button', { name: 'Nouveau projet' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialogue.getByRole('textbox', { name: 'Nom du projet' }).fill('Projet Alpha');
  await dialogue.getByRole('textbox', { name: 'Client' }).fill('Acme');
  await dialogue.getByRole('button', { name: 'Créer', exact: true }).click();

  await expect(main.getByText('Projet Alpha')).toBeVisible();
  await expect(main.getByText('1 actifs · 0 archivés')).toBeVisible();

  await main.getByRole('button', { name: 'Archiver' }).click();

  await expect(main.getByText('Aucun projet actif.')).toBeVisible();
  await expect(main.getByText('0 actifs · 1 archivés')).toBeVisible();
  await main.getByRole('button', { name: 'Actifs' }).click(); // bascule vers la liste des archivés
  await expect(main.getByText('Projet Alpha')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Désarchiver' })).toBeVisible();

  expect(erreurs).toEqual([]);
});
