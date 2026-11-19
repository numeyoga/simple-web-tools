import { expect, test } from '@playwright/test';
import { creerProjet, ouvrirApp } from './support.js';

test("saisie manuelle d'une session, puis édition de sa fin", async ({ page }) => {
  const { erreurs } = await ouvrirApp(page, { horloge: true });
  await creerProjet(page, 'Alpha');
  const main = page.getByRole('main');

  // Saisie manuelle : 08:00 -> 09:30 aujourd'hui
  await main.getByRole('button', { name: 'Nouvelle' }).click();
  const ajout = page.getByRole('dialog', { name: 'Ajouter un chrono' });
  await ajout.getByRole('tab', { name: 'Saisir manuellement' }).click();
  await ajout.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' }).fill('Rattrapage');
  await ajout.getByLabel('Début').fill('2026-11-18T08:00');
  await ajout.getByLabel('Fin').fill('2026-11-18T09:30');
  await ajout.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const ligne = main
    .locator('li, div')
    .filter({ hasText: 'Rattrapage' })
    .filter({ hasText: '01:30' });
  await expect(ligne.first()).toBeVisible();
  await expect(main.getByText('Temps travaillé').locator('..')).toContainText('01:30');

  // Édition : la fin passe à 10:00
  await main.getByRole('button', { name: 'Modifier', exact: true }).first().click();
  const edition = page.getByRole('dialog', { name: 'Modifier la session' });
  await edition.getByLabel('Fin').fill('2026-11-18T10:00');
  await edition.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(main.getByText('Temps travaillé').locator('..')).toContainText('02:00');

  expect(erreurs).toEqual([]);
});
