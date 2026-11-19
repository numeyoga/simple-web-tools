import { expect, test } from '@playwright/test';
import { createProject, openApp } from './support.js';

test('workspaces: create a second one, switch, isolated data', async ({ page }) => {
  const { errors } = await openApp(page);
  await createProject(page, 'Alpha');
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByRole('main').getByText('Alpha')).toBeVisible();

  // Create the "Perso" workspace (without demo data)
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  const management = page.getByRole('dialog', { name: 'Espaces de sauvegarde' });
  await management.getByPlaceholder('Ex. Perso, Freelance, Test, Q4…').fill('Perso');
  await management.getByRole('button', { name: 'Créer', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Basculer sur cet espace ?' })
    .getByRole('button', { name: 'Confirmer' })
    .click();

  // Switch: the page reloads on the "Perso" workspace, which is empty
  await expect(page.getByRole('button', { name: 'Espace de sauvegarde Perso' })).toBeVisible();
  await page.getByRole('button', { name: 'Projets' }).click();
  await expect(page.getByText('Aucun projet actif.')).toBeVisible();
  await expect(page.getByRole('main').getByText('Alpha')).toHaveCount(0);

  // The data of "Perso" does not appear in the main workspace
  await createProject(page, 'Beta');
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

  expect(errors).toEqual([]);
});

test('workspaces: the name of a workspace is shown as text, never as HTML', async ({ page }) => {
  const name = '<img src=x onerror="window.__xss=1"><b>bold</b>';
  const { errors } = await openApp(page);

  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  const management = page.getByRole('dialog', { name: 'Espaces de sauvegarde' });
  await management.getByPlaceholder('Ex. Perso, Freelance, Test, Q4…').fill(name);
  await management.getByRole('button', { name: 'Créer', exact: true }).click();
  // Stay on the active workspace: the created one can then be deleted
  await page
    .getByRole('dialog', { name: 'Basculer sur cet espace ?' })
    .getByRole('button', { name: 'Annuler' })
    .click();

  await management.getByRole('button', { name: 'Supprimer', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Supprimer cet espace ?' });
  await expect(confirmation.getByText(name)).toBeVisible();
  await expect(confirmation.locator('img, b')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();

  await confirmation.getByRole('button', { name: 'Annuler' }).click();
  await expect(confirmation).toHaveCount(0);
  expect(errors).toEqual([]);
});
