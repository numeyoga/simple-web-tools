import { expect, test } from '@playwright/test';
import { createProject, openApp } from './support.js';

test('manual entry of a session, then editing its end', async ({ page }) => {
  const { errors } = await openApp(page, { clock: true });
  await createProject(page, 'Alpha');
  const main = page.getByRole('main');

  // Manual entry: 08:00 -> 09:30 today
  await main.getByRole('button', { name: 'Nouvelle' }).click();
  const addDialog = page.getByRole('dialog', { name: 'Ajouter un chrono' });
  await addDialog.getByRole('tab', { name: 'Saisir manuellement' }).click();
  await addDialog.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' }).fill('Rattrapage');
  await addDialog.getByLabel('Début').fill('2026-11-18T08:00');
  await addDialog.getByLabel('Fin').fill('2026-11-18T09:30');
  await addDialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const row = main
    .locator('li, div')
    .filter({ hasText: 'Rattrapage' })
    .filter({ hasText: '01:30' });
  await expect(row.first()).toBeVisible();
  await expect(main.getByText('Temps travaillé').locator('..')).toContainText('01:30');

  // Editing: the end becomes 10:00
  await main.getByRole('button', { name: 'Modifier', exact: true }).first().click();
  const editing = page.getByRole('dialog', { name: 'Modifier la session' });
  await editing.getByLabel('Fin').fill('2026-11-18T10:00');
  await editing.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(main.getByText('Temps travaillé').locator('..')).toContainText('02:00');

  expect(errors).toEqual([]);
});
