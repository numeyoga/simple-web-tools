import { expect, test } from '@playwright/test';
import { saveDownload } from '@simple-web-tools/test-utils/playwright';
import { readFile } from 'node:fs/promises';
import { createProject, openApp, enterSession } from './support.js';

test('weekly report: totals, then CSV export with a BOM and the ; separator', async ({ page }) => {
  const { errors } = await openApp(page, { clock: true });
  await createProject(page, 'Alpha');
  await enterSession(page, { description: 'Rédaction', end: '09:30' });

  await page.getByRole('button', { name: 'Rapport' }).click();
  const main = page.getByRole('main');

  await expect(main.getByText('Cette semaine').first()).toBeVisible();
  await expect(main.getByText('Total semaine').locator('..')).toContainText('01:30');
  await expect(main.getByText('réparties sur 1 jour')).toBeVisible();
  await expect(main.getByText('Par projet').locator('../..')).toContainText('Alpha');

  const downloadEvent = page.waitForEvent('download');
  await main.getByRole('button', { name: 'Exporter CSV' }).click();
  const download = await downloadEvent;

  expect(download.suggestedFilename()).toBe('rapport-2026-11-16.csv');
  const bytes = await readFile(await saveDownload(download));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
  const rows = bytes.toString('utf8').slice(1).split('\r\n');
  expect(rows[0]).toBe('"Date";"Projet";"Client";"Description";"Début";"Fin";"Durée (h)"');
  expect(rows[1]).toBe('"18/11/2026";"Alpha";"";"Rédaction";"08:00";"09:30";"1,50"');

  expect(errors).toEqual([]);
});
