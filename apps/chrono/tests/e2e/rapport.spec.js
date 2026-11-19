import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { creerProjet, ouvrirApp, saisirSession } from './support.js';

test('rapport hebdomadaire : totaux, puis export CSV avec BOM et séparateur ;', async ({
  page,
}) => {
  const { erreurs } = await ouvrirApp(page, { horloge: true });
  await creerProjet(page, 'Alpha');
  await saisirSession(page, { description: 'Rédaction', fin: '09:30' });

  await page.getByRole('button', { name: 'Rapport' }).click();
  const main = page.getByRole('main');

  await expect(main.getByText('Cette semaine').first()).toBeVisible();
  await expect(main.getByText('Total semaine').locator('..')).toContainText('01:30');
  await expect(main.getByText('réparties sur 1 jour')).toBeVisible();
  await expect(main.getByText('Par projet').locator('../..')).toContainText('Alpha');

  const telechargement = page.waitForEvent('download');
  await main.getByRole('button', { name: 'Exporter CSV' }).click();
  const fichier = await telechargement;

  expect(fichier.suggestedFilename()).toBe('rapport-2026-11-16.csv');
  const octets = await readFile(await fichier.path());
  expect([...octets.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
  const lignes = octets.toString('utf8').slice(1).split('\r\n');
  expect(lignes[0]).toBe('"Date";"Projet";"Client";"Description";"Début";"Fin";"Durée (h)"');
  expect(lignes[1]).toBe('"18/11/2026";"Alpha";"";"Rédaction";"08:00";"09:30";"1,50"');

  expect(erreurs).toEqual([]);
});
