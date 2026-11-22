// The JSON backup of the active workspace: export, import (the app's own file and the file the
// previous version exported), the confirmation before anything is replaced, and "clear all".
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { saveDownload } from '@simple-web-tools/test-utils/playwright';
import {
  addGroup,
  addLink,
  card,
  dialogNamed,
  linkNames,
  localDate,
  openApp,
  readStore,
  waitForWrite,
} from './support.js';
import { legacyExportFile } from '../unit/support/legacy-fixtures.js';

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => {
    throw new Error(`a native ${dialog.type()} dialog opened: ${dialog.message()}`);
  });
});

/** @param {import('@playwright/test').Page} page @param {string} name */
async function chooseMore(page, name) {
  await page.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('menuitem', { name }).click();
}

/**
 * Gives a file to the import, as the file picker would.
 * @param {import('@playwright/test').Page} page
 * @param {string | object} content
 */
async function importFile(page, content) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'favoris.json',
    mimeType: 'application/json',
    buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)),
  });
}

test('the export is a versioned file with the groups and the links', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Docs');
  await addLink(page, { name: 'MDN', url: 'mdn.example', group: 'Docs' });
  await waitForWrite(page, 'links', 'name', 'MDN');

  const download = page.waitForEvent('download');
  await chooseMore(page, 'Exporter en JSON');
  const file = await saveDownload(await download);

  expect(file).toContain(`favoris-default-${localDate()}.json`);
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup).toMatchObject({ app: 'favoris', format: 'favoris-workspace', version: 1 });
  expect(backup.data.groups).toEqual([
    expect.objectContaining({
      label: 'Docs',
      category: 9,
      featured: false,
      collapsed: false,
      position: 0,
    }),
  ]);
  expect(backup.data.links).toEqual([
    expect.objectContaining({ name: 'MDN', url: 'https://mdn.example', position: 0 }),
  ]);
  await expect(page.getByText('Sauvegarde téléchargée')).toBeVisible();
});

test('a backup is imported after a confirmation, and replaces what the workspace held', async ({
  page,
}) => {
  await openApp(page);
  await addLink(page, { name: 'Avant', url: 'avant.example' });
  const backup = {
    app: 'favoris',
    format: 'favoris-workspace',
    version: 1,
    exportedAt: '2026-11-22T10:00:00.000Z',
    data: {
      groups: [
        { id: 'g', label: 'Importé', category: 5, featured: false, collapsed: false, position: 0 },
      ],
      links: [{ id: 'l', name: 'Après', url: 'https://apres.example', groupId: 'g', position: 0 }],
    },
  };

  await importFile(page, backup);
  const question = await dialogNamed(page, 'Remplacer les favoris ?');
  await expect(question).toContainText('(1 lien)');
  await question.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('link', { name: /^Avant/ })).toBeVisible();

  await importFile(page, backup);
  await (
    await dialogNamed(page, 'Remplacer les favoris ?')
  )
    .getByRole('button', { name: 'Remplacer les favoris' })
    .click();

  await expect(page.getByText('Import terminé')).toBeVisible();
  await expect(card(page, 'Importé')).toHaveAttribute('data-cat', '5');
  expect(await linkNames(page, 'Importé')).toEqual(['Après']);
  await expect(page.getByRole('link', { name: /^Avant/ })).toHaveCount(0);
  await expect
    .poll(async () => (await readStore(page, 'links')).map((l) => l.name))
    .toEqual(['Après']);
});

test('the file exported by the previous version is accepted; an unsafe address is skipped and counted', async ({
  page,
}) => {
  await openApp(page);

  await importFile(page, legacyExportFile());
  await (
    await dialogNamed(page, 'Remplacer les favoris ?')
  )
    .getByRole('button', { name: 'Remplacer les favoris' })
    .click();

  await expect(page.getByText('Import terminé (fichier de la version précédente)')).toBeVisible();
  // The warning stays until it is dismissed: it says what was left out.
  await expect(
    page.getByText(
      '2 enregistrements du fichier étaient inutilisables et ont été ignorés. 1 d’entre eux',
    ),
  ).toBeVisible();
  await expect(card(page, 'Clients')).toHaveAttribute('data-cat', '14');
  await expect(card(page, 'Outils')).toHaveAttribute('data-cat', '6');
  expect(await linkNames(page, 'Clients')).toEqual(['Intranet']);
  expect(await linkNames(page, 'Outils')).toEqual(['Sans id']);
  expect(await page.locator('a[href^="javascript:" i]').count()).toBe(0);
  await expect(page.getByText('Évil')).toHaveCount(0);
});

test('a file that is not a backup is refused with a reason, and nothing is replaced', async ({
  page,
}) => {
  await openApp(page);
  await addLink(page, { name: 'Reste', url: 'reste.example' });

  await importFile(page, 'ceci n’est pas du JSON');
  await expect(page.getByText('Import impossible')).toBeVisible();
  await expect(page.getByText('Le fichier n’est pas un JSON valide.')).toBeVisible();

  await importFile(page, {
    app: 'chrono',
    format: 'chrono-workspace',
    version: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    data: {},
  });
  await expect(page.getByText('Ce fichier n’a pas été exporté par Favoris.')).toBeVisible();

  await importFile(page, {
    app: 'favoris',
    format: 'favoris-workspace',
    version: 9,
    exportedAt: '2026-01-01T00:00:00Z',
    data: {},
  });
  await expect(page.getByText(/vient d’une version plus récente/)).toBeVisible();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Reste/ })).toBeVisible();
});

test('"Tout effacer" empties the workspace after a confirmation', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Docs');
  await addLink(page, { name: 'MDN', url: 'mdn.example', group: 'Docs' });

  await chooseMore(page, 'Tout effacer');
  const question = await dialogNamed(page, 'Effacer cet espace de travail ?');
  await question.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('link', { name: /^MDN/ })).toBeVisible();

  await chooseMore(page, 'Tout effacer');
  await (
    await dialogNamed(page, 'Effacer cet espace de travail ?')
  )
    .getByRole('button', { name: 'Tout effacer' })
    .click();

  await expect(page.getByText('Aucun favori pour le moment')).toBeVisible();
  await expect.poll(async () => (await readStore(page, 'links')).length).toBe(0);
  expect(await readStore(page, 'groups')).toEqual([]);
});
