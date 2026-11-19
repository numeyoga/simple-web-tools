import { expect, test } from '@playwright/test';
import { ouvrirApp } from './support.js';

test('todo : ajout puis marquage comme terminé', async ({ page }) => {
  const { erreurs } = await ouvrirApp(page, { horloge: true });
  await page.getByRole('button', { name: 'Todos' }).click();
  const main = page.getByRole('main');
  await expect(main.getByText('0 en cours · 0 terminées')).toBeVisible();

  await main.getByPlaceholder("Qu'est-ce qu'il faut faire ?").fill('Envoyer la facture');
  await main.getByRole('button', { name: 'Ajouter' }).click();

  await expect(main.getByText('Envoyer la facture')).toBeVisible();
  await expect(main.getByText('1 en cours · 0 terminées')).toBeVisible();

  await main.getByRole('button', { name: 'Terminer' }).click();

  await expect(main.getByText('0 en cours · 1 terminées')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Rouvrir' })).toBeVisible();

  expect(erreurs).toEqual([]);
});
