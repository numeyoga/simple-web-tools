import { expect, test } from '@playwright/test';
import { openApp } from './support.js';

test('todo: add, then mark as done', async ({ page }) => {
  const { errors } = await openApp(page, { clock: true });
  await page.getByRole('button', { name: 'Todos' }).click();
  const main = page.getByRole('main');
  await expect(main.getByText('0 en cours · 0 terminées')).toBeVisible();

  await main.getByPlaceholder("Qu'est-ce qu'il faut faire ?").fill('Envoyer la facture');
  await main.getByRole('button', { name: 'Ajouter' }).click();

  await expect(main.getByText('Envoyer la facture')).toBeVisible();
  await expect(main.getByText('1 en cours · 0 terminées')).toBeVisible();

  await main.getByRole('checkbox', { name: 'Envoyer la facture' }).check();

  await expect(main.getByText('0 en cours · 1 terminées')).toBeVisible();
  await expect(
    main.getByRole('checkbox', { name: 'Envoyer la facture', checked: true }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});
