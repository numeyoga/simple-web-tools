import { expect, test } from '@playwright/test';
import { creerProjet, ouvrirApp } from './support.js';

test('espaces de sauvegarde : créer un second espace, basculer, données isolées', async ({
  page,
}) => {
  const { erreurs } = await ouvrirApp(page);
  await creerProjet(page, 'Alpha');
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Alpha')).toBeVisible();

  // Créer l'espace « Perso » (sans données de démonstration)
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  const gestion = page.getByRole('dialog', { name: 'Espaces de sauvegarde' });
  await gestion.getByPlaceholder('Ex. Perso, Freelance, Test, Q4…').fill('Perso');
  await gestion.getByRole('button', { name: 'Créer', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Basculer sur cet espace ?' })
    .getByRole('button', { name: 'Confirmer' })
    .click();

  // Basculer : la page se recharge sur l'espace « Perso », qui est vide
  await expect(page.getByRole('button', { name: 'Espace de sauvegarde Perso' })).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByText('Aucun projet actif.')).toBeVisible();
  await expect(page.getByRole('main').getByText('Alpha')).toHaveCount(0);

  // Les données de « Perso » n'apparaissent pas dans l'espace principal
  await creerProjet(page, 'Beta');
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Beta')).toBeVisible();

  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  await page
    .getByRole('dialog', { name: 'Espaces de sauvegarde' })
    .getByRole('button', { name: 'Basculer' })
    .click();
  await page
    .getByRole('dialog', { name: 'Changer d’espace ?' })
    .getByRole('button', { name: 'Confirmer' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Espace de sauvegarde Espace principal' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Alpha')).toBeVisible();
  await expect(page.getByRole('main').getByText('Beta')).toHaveCount(0);

  expect(erreurs).toEqual([]);
});

test('espaces de sauvegarde : le nom d’un espace est affiché comme texte, jamais comme HTML', async ({
  page,
}) => {
  const nom = '<img src=x onerror="window.__xss=1"><b>bold</b>';
  const { erreurs } = await ouvrirApp(page);

  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  const gestion = page.getByRole('dialog', { name: 'Espaces de sauvegarde' });
  await gestion.getByPlaceholder('Ex. Perso, Freelance, Test, Q4…').fill(nom);
  await gestion.getByRole('button', { name: 'Créer', exact: true }).click();
  // Rester sur l'espace actif : l'espace créé reste donc supprimable
  await page
    .getByRole('dialog', { name: 'Basculer sur cet espace ?' })
    .getByRole('button', { name: 'Annuler' })
    .click();

  await gestion.getByRole('button', { name: 'Supprimer', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Supprimer cet espace ?' });
  await expect(confirmation.getByText(nom)).toBeVisible();
  await expect(confirmation.locator('img, b')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();

  await confirmation.getByRole('button', { name: 'Annuler' }).click();
  await expect(confirmation).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
