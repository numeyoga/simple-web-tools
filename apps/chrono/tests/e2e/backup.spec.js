import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createProject, openApp, waitForWrite } from './support.js';

test('JSON export then import into an empty workspace: the data is restored', async ({ page }) => {
  const { errors } = await openApp(page);
  await createProject(page, 'Alpha');
  await page.getByRole('button', { name: 'Todos' }).click();
  await page.getByPlaceholder("Qu'est-ce qu'il faut faire ?").fill('Envoyer la facture');
  await page.getByRole('main').getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByRole('main').getByText('Envoyer la facture')).toBeVisible();

  // Export
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  const downloadEvent = page.waitForEvent('download');
  await page
    .getByRole('dialog', { name: 'Espaces de sauvegarde' })
    .getByRole('button', { name: 'Exporter JSON' })
    .click();
  const download = await downloadEvent;
  const content = await readFile(await download.path());
  const exported = JSON.parse(content.toString('utf8'));
  expect(exported).toMatchObject({ app: 'chrono', format: 'chrono-workspace', version: 3 });
  expect(exported.data.projects.map((/** @type {{ name: string }} */ p) => p.name)).toEqual([
    'Alpha',
  ]);
  expect(exported.data.todos.map((/** @type {{ title: string }} */ t) => t.title)).toEqual([
    'Envoyer la facture',
  ]);

  // An empty workspace, where we switch
  const management = page.getByRole('dialog', { name: 'Espaces de sauvegarde' });
  await management.getByPlaceholder('Ex. Perso, Freelance, Test, Q4…').fill('Vide');
  await management.getByRole('button', { name: 'Créer', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Basculer sur cet espace ?' })
    .getByRole('button', { name: 'Confirmer' })
    .click();
  await expect(page.getByRole('button', { name: 'Espace de sauvegarde Vide' })).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByText('Aucun projet actif.')).toBeVisible();

  // Import: the page reloads with the data of the file
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: content,
  });
  await page
    .getByRole('dialog', { name: 'Remplacer les données ?' })
    .getByRole('button', { name: 'Remplacer les données' })
    .click();
  await expect(page.getByRole('button', { name: 'Espace de sauvegarde Vide' })).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Alpha')).toBeVisible();
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByRole('main').getByText('Envoyer la facture')).toBeVisible();

  expect(errors).toEqual([]);
});

test('the data survives a page reload', async ({ page }) => {
  const { errors } = await openApp(page);
  await createProject(page, 'Alpha');
  await page.getByRole('button', { name: 'Todos' }).click();
  await page.getByPlaceholder("Qu'est-ce qu'il faut faire ?").fill('Envoyer la facture');
  await page.getByRole('main').getByRole('button', { name: 'Ajouter' }).click();
  await waitForWrite(page, 'projects', 'name', 'Alpha');
  await waitForWrite(page, 'todos', 'title', 'Envoyer la facture');

  await page.reload();

  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Alpha')).toBeVisible();
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByRole('main').getByText('Envoyer la facture')).toBeVisible();

  expect(errors).toEqual([]);
});
