import { expect, test } from '@playwright/test';
import { creerProjet, ouvrirApp } from './support.js';

test("chrono : démarrer depuis l'ajout rapide, pause, reprise, arrêt", async ({ page }) => {
  const { erreurs } = await ouvrirApp(page, { horloge: true });
  await creerProjet(page, 'Alpha');
  const nav = page.getByRole('navigation', { name: 'Navigation' });

  // Démarrer
  await nav.getByRole('button', { name: 'Démarrer un chrono' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Ajouter un chrono' });
  await dialogue.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' }).fill('Rédaction');
  await dialogue.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await expect(nav.getByText('Rédaction')).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();

  // Pause puis reprise
  await page.clock.runFor('02:00');
  await nav.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(nav.getByRole('button', { name: 'Reprendre' })).toBeVisible();
  await nav.getByRole('button', { name: 'Reprendre' }).click();
  await expect(nav.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();

  // Arrêt : la session apparaît dans la liste du jour avec sa durée
  await page.clock.runFor('03:00');
  await nav.getByRole('button', { name: 'Arrêter & enregistrer' }).click();
  await expect(nav.getByText('Aucun chrono actif')).toBeVisible();
  const ligne = page.getByRole('main').getByText('Rédaction');
  await expect(ligne.first()).toBeVisible();
  await expect(page.getByRole('main').getByText('00:05').first()).toBeVisible();

  expect(erreurs).toEqual([]);
});
