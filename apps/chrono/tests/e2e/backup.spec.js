import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { creerProjet, ouvrirApp, attendreEcriture } from './support.js';

test('export JSON puis import dans un espace vide : les données sont restaurées', async ({
  page,
}) => {
  const { erreurs } = await ouvrirApp(page);
  await creerProjet(page, 'Alpha');
  await page.getByRole('button', { name: 'Todos' }).click();
  await page.getByPlaceholder("Qu'est-ce qu'il faut faire ?").fill('Envoyer la facture');
  await page.getByRole('main').getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByRole('main').getByText('Envoyer la facture')).toBeVisible();

  // Export
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  const telechargement = page.waitForEvent('download');
  await page
    .getByRole('dialog', { name: 'Espaces de sauvegarde' })
    .getByRole('button', { name: 'Exporter JSON' })
    .click();
  const fichier = await telechargement;
  const contenu = await readFile(await fichier.path());
  const export_ = JSON.parse(contenu.toString('utf8'));
  expect(export_.version).toBe(1);
  expect(export_.data.projets.map((/** @type {{ nom: string }} */ p) => p.nom)).toEqual(['Alpha']);
  expect(export_.data.todos.map((/** @type {{ titre: string }} */ t) => t.titre)).toEqual([
    'Envoyer la facture',
  ]);

  // Un espace vide, où l'on bascule
  const gestion = page.getByRole('dialog', { name: 'Espaces de sauvegarde' });
  await gestion.getByPlaceholder('Ex. Perso, Freelance, Test, Q4…').fill('Vide');
  await gestion.getByRole('button', { name: 'Créer', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Basculer sur cet espace ?' })
    .getByRole('button', { name: 'Confirmer' })
    .click();
  await expect(page.getByRole('button', { name: 'Espace de sauvegarde Vide' })).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByText('Aucun projet actif.')).toBeVisible();

  // Import : la page se recharge avec les données du fichier
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: contenu,
  });
  await page
    .getByRole('dialog', { name: 'Remplacer les données ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByRole('button', { name: 'Espace de sauvegarde Vide' })).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Alpha')).toBeVisible();
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByRole('main').getByText('Envoyer la facture')).toBeVisible();

  expect(erreurs).toEqual([]);
});

test('les données survivent au rechargement de la page', async ({ page }) => {
  const { erreurs } = await ouvrirApp(page);
  await creerProjet(page, 'Alpha');
  await page.getByRole('button', { name: 'Todos' }).click();
  await page.getByPlaceholder("Qu'est-ce qu'il faut faire ?").fill('Envoyer la facture');
  await page.getByRole('main').getByRole('button', { name: 'Ajouter' }).click();
  await attendreEcriture(page, 'projets', 'nom', 'Alpha');
  await attendreEcriture(page, 'todos', 'titre', 'Envoyer la facture');

  await page.reload();

  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Alpha')).toBeVisible();
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByRole('main').getByText('Envoyer la facture')).toBeVisible();

  expect(erreurs).toEqual([]);
});
