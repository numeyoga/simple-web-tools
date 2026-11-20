import { expect, test } from '@playwright/test';
import { createProject, openApp } from './support.js';

test('timer: start from the quick add, pause, resume, stop', async ({ page }) => {
  const { errors } = await openApp(page, { clock: true });
  await createProject(page, 'Alpha');
  // The timers are in the page header of the Timeline (decision F), no longer in the sidebar.
  const timers = page.getByRole('main').getByRole('region', { name: 'Chronos' });

  // Start
  await timers.getByRole('button', { name: 'Démarrer un chrono' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un chrono' });
  await dialog.getByRole('textbox', { name: 'Sur quoi as-tu travaillé ?' }).fill('Rédaction');
  await dialog.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await expect(timers.getByText('Rédaction')).toBeVisible();
  await expect(timers.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();

  // Pause then resume
  await page.clock.runFor('02:00');
  await timers.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(timers.getByRole('button', { name: 'Reprendre' })).toBeVisible();
  await timers.getByRole('button', { name: 'Reprendre' }).click();
  await expect(timers.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();

  // Stop: the session appears in the list of the day with its duration
  await page.clock.runFor('03:00');
  await timers.getByRole('button', { name: 'Arrêter & enregistrer' }).click();
  await expect(timers.getByText('Aucun chrono actif')).toBeVisible();
  const row = page.getByRole('main').getByText('Rédaction');
  await expect(row.first()).toBeVisible();
  await expect(page.getByRole('main').getByText('00:05').first()).toBeVisible();

  expect(errors).toEqual([]);
});
