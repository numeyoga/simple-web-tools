// Export and import. Export: a JSON file. Import: this app's file, or the file the earlier version
// of the dashboard (on GitLab Pages, another origin) exported, wrapped as `{ version, exportedAt,
// data }` or bare. The file is read and checked before anything is asked; three ways in: merge,
// replace, or a new workspace.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { saveDownload } from '@simple-web-tools/test-utils/playwright';
import { expect, test } from '@playwright/test';
import {
  dialogNamed,
  loadSample,
  localDate,
  openAdmin,
  openApp,
  openAppNamed,
  readStore,
  shownLinks,
  waitForWrite,
} from './support.js';

const WRAPPED = fileURLToPath(new URL('../fixtures/legacy-dashboard.json', import.meta.url));
const BARE = fileURLToPath(new URL('../fixtures/legacy-dashboard-bare.json', import.meta.url));

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => {
    throw new Error(`a native ${dialog.type()} dialog opened: ${dialog.message()}`);
  });
});

/** @typedef {import('@playwright/test').Page} Page */

/** Opens the import and export screen. @param {Page} page */
async function openData(page) {
  await openAdmin(page, 'Import et export');
}

/** Chooses a file in the import card. @param {Page} page @param {string | { name: string, mimeType: string, buffer: Buffer }} file */
async function chooseFile(page, file) {
  await page.locator('input[type="file"]').setInputFiles(file);
}

test.describe('export', () => {
  test('downloads a JSON file named after the workspace and the local date, with the counts', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await waitForWrite(page, 'apps', 'name', 'SearchIndex');
    await openData(page);
    const stats = page.locator('.dsh-stats');
    await expect(stats).toContainText('12');
    await expect(stats).toContainText('templates');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger le fichier JSON' }).click();
    const file = await download;

    expect(file.suggestedFilename()).toBe(`dashboard-default-${localDate()}.json`);
    const json = JSON.parse((await readFile(await saveDownload(file))).toString('utf8'));
    expect(json).toMatchObject({ app: 'dashboard', format: 'dashboard-workspace', version: 1 });
    expect(json.data.apps).toHaveLength(12);
    expect(json.data.templates).toHaveLength(4);
    expect(json.data.settings.tags).toHaveLength(9);
    await expect(page.getByText('Sauvegarde téléchargée')).toBeVisible();
  });

  test('a file exported by the app comes back: replace restores a cleared workspace', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await waitForWrite(page, 'apps', 'name', 'SearchIndex');
    await openData(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger le fichier JSON' }).click();
    const path = await saveDownload(await download);
    await openAdmin(page, 'Réglages');
    await page.getByRole('button', { name: 'Vider l’espace de travail' }).click();
    await (
      await dialogNamed(page, 'Vider cet espace de travail ?')
    )
      .getByRole('button', { name: 'Vider l’espace de travail' })
      .click();
    await expect.poll(async () => (await readStore(page, 'apps')).length).toBe(0);

    await openData(page);
    await chooseFile(page, path);
    await expect(
      page.getByText(/12 applications, 4 templates, 28 liens de template/),
    ).toBeVisible();
    await expect(page.getByText('C’est un fichier de la version précédente.')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Remplacer' }).check();
    await page.getByRole('button', { name: 'Importer', exact: true }).click();
    await (
      await dialogNamed(page, 'Remplacer cet espace de travail ?')
    )
      .getByRole('button', { name: 'Tout remplacer' })
      .click();

    await expect(page.getByText('Import terminé', { exact: true })).toBeVisible();
    await expect.poll(async () => (await readStore(page, 'apps')).length).toBe(12);
    await openAppNamed(page, 'AccountPortal');
  });
});

test.describe('the earlier version’s file (GitLab Pages, another origin)', () => {
  for (const [label, path] of /** @type {const} */ ([
    ['wrapped as { version, exportedAt, data }', WRAPPED],
    ['the bare object', BARE],
  ])) {
    test(`${label} is imported into an empty workspace: what is usable comes over, what is not is counted`, async ({
      page,
    }) => {
      const { errors } = await openApp(page);
      await openData(page);

      await chooseFile(page, path);

      await expect(
        page.getByText('3 applications, 2 templates, 8 liens de template.'),
      ).toBeVisible();
      await expect(page.getByText('C’est un fichier de la version précédente.')).toBeVisible();
      // Two records are not applications, an address of an override and of an extra link are not web addresses.
      await expect(
        page.getByText('4 enregistrements sont inutilisables et seront ignorés ; 2 d’entre eux'),
      ).toBeVisible();
      await page.getByRole('radio', { name: 'Remplacer' }).check();
      await page.getByRole('button', { name: 'Importer', exact: true }).click();
      await (
        await dialogNamed(page, 'Remplacer cet espace de travail ?')
      )
        .getByRole('button', { name: 'Tout remplacer' })
        .click();
      await expect(
        page.getByText('Import terminé (fichier de la version précédente)'),
      ).toBeVisible();

      // The dashboard opens on the default application of the file, on its last environment.
      await page.goto('/#/');
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('MonComptePerso');
      await expect(page.locator('.dsh-topbar-name')).toHaveText('Mon Backoffice perso');
      await expect(page.getByRole('tab', { name: /^PROD/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const links = await shownLinks(page);
      // `{cluster}` (the old way of writing a metadata placeholder) is filled in.
      expect(links.find((l) => l.name === 'OpenShift console')?.url).toBe(
        'https://console.ocp-prod-paris.openshift.example.invalid/k8s/ns/mcp-prod/deployments',
      );
      // The `javascript:` override was dropped: the pattern is in charge again.
      expect(links.find((l) => l.name === 'GoCD pipeline')?.url).toBe(
        'https://gocd.example.invalid/go/tab/pipeline/history/mon-compte-perso-prod',
      );
      // A pattern that is not an http or https address is shown with its reason, never opened.
      const trap = page.locator('[role="tabpanel"]:not([hidden]) .dsh-link', {
        hasText: 'Lien piégé',
      });
      await expect(trap).toContainText('Pas une adresse web');
      await expect(trap.getByRole('link')).toHaveCount(0);
      // The extra link with a `data:` address was dropped, the others stay.
      await expect(page.getByRole('link', { name: /^Confluence/ })).toBeVisible();
      await expect(page.getByText('Extra piégé')).toHaveCount(0);
      // An override on TEST came over.
      await page.getByRole('tab', { name: /^TEST/ }).click();
      await expect(page.getByText('https://grafana.example.invalid/d/custom-test')).toBeVisible();
      // Its theme and density are the person's preferences here: left alone.
      expect(await page.evaluate(() => localStorage.getItem('dashboard-theme'))).toBeNull();
      expect(await page.evaluate(() => localStorage.getItem('dashboard-density'))).toBeNull();
      // An application whose template does not exist is kept, and says what to do.
      await openAppNamed(page, 'Orpheline');
      await expect(page.getByText('Template introuvable')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('merged into a workspace, it adds what the workspace lacks and keeps what it has', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openData(page);

    await chooseFile(page, WRAPPED);
    await page.getByRole('button', { name: 'Importer', exact: true }).click();

    await expect(page.getByText(/^Import terminé/).first()).toBeVisible();
    await expect.poll(async () => (await readStore(page, 'apps')).length).toBe(15);
    expect(await readStore(page, 'templates')).toHaveLength(6);
    // The name of the workspace is its own: the merge does not take the file's.
    expect((await readStore(page, 'settings'))[0]?.dashboardName).toBe('Mon backoffice');
    // The same file again adds nothing.
    await chooseFile(page, WRAPPED);
    await page.getByRole('button', { name: 'Importer', exact: true }).click();
    await expect(page.getByText('Rien à fusionner')).toBeVisible();
    expect(await readStore(page, 'apps')).toHaveLength(15);
  });

  test('put in a new workspace, it leaves the current one as it is', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await openData(page);

    await chooseFile(page, BARE);
    await page.getByRole('radio', { name: 'Nouvel espace de travail' }).check();
    await expect(page.getByLabel('Nom du nouvel espace de travail')).toHaveValue(
      'Mon Backoffice perso',
    );
    await page.getByRole('button', { name: 'Importer', exact: true }).click();
    await (
      await dialogNamed(page, 'Passer au nouvel espace de travail ?')
    )
      .getByRole('button', { name: 'Annuler' })
      .click();

    expect(await readStore(page, 'apps', 'default')).toHaveLength(12);
    expect(await readStore(page, 'apps', 'mon-backoffice-perso')).toHaveLength(3);

    await page.getByRole('button', { name: /^Espace de travail/ }).click();
    const dialog = await dialogNamed(page, 'Espaces de travail');
    await dialog.getByRole('button', { name: 'Passer à celui-ci' }).click();
    await (
      await dialogNamed(page, 'Changer d’espace de travail ?')
    )
      .getByRole('button', { name: 'Confirmer' })
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Import et export');
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MonComptePerso');
  });
});

test.describe('a file that cannot be imported', () => {
  for (const [what, buffer, message] of /** @type {const} */ ([
    ['not JSON', '{oops', 'Le fichier n’est pas du JSON valide.'],
    [
      'another app’s file',
      JSON.stringify({
        app: 'favoris',
        format: 'favoris-workspace',
        version: 1,
        exportedAt: '2026-11-22T10:00:00.000Z',
        data: {},
      }),
      'Ce fichier n’a pas été exporté par Dashboard.',
    ],
    [
      'a newer version',
      JSON.stringify({
        app: 'dashboard',
        format: 'dashboard-workspace',
        version: 9,
        exportedAt: '2026-11-22T10:00:00.000Z',
        data: {},
      }),
      'Ce fichier vient d’une version plus récente de Dashboard.',
    ],
    [
      'no lists',
      JSON.stringify({
        app: 'dashboard',
        format: 'dashboard-workspace',
        version: 1,
        exportedAt: '2026-11-22T10:00:00.000Z',
        data: { apps: [] },
      }),
      'Le fichier n’a pas de liste d’applications et de liste de templates.',
    ],
    [
      'an object with no lists',
      JSON.stringify({ hello: 1 }),
      'Ce fichier n’a pas été exporté par Dashboard.',
    ],
  ])) {
    test(`${what} is refused with a reason, and nothing changes`, async ({ page }) => {
      await openApp(page);
      await loadSample(page);
      await openData(page);

      await chooseFile(page, {
        name: 'x.json',
        mimeType: 'application/json',
        buffer: Buffer.from(buffer),
      });

      await expect(page.getByText('Ce fichier ne peut pas être importé')).toBeVisible();
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Importer', exact: true })).toHaveCount(0);
      expect(await readStore(page, 'apps')).toHaveLength(12);
    });
  }

  test('a record that cannot be used is skipped, the rest comes over', async ({ page }) => {
    await openApp(page);
    await openData(page);
    const file = {
      name: 'partial.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          templates: [
            {
              id: 't',
              name: 'T',
              envs: [{ key: 'dev', label: 'DEV' }],
              metaFields: [],
              links: [
                {
                  id: 'l',
                  name: 'x',
                  tag: '',
                  scope: 'env',
                  pattern: 'https://x.example.invalid/{slug}',
                },
              ],
            },
            42,
          ],
          apps: [
            { id: 'a', name: 'Alpha', slug: 'alpha', templateId: 't', envs: {}, extras: [] },
            { id: 'b' },
            null,
          ],
        }),
      ),
    };

    await chooseFile(page, file);
    await expect(page.getByText('1 applications, 1 templates, 1 liens de template.')).toBeVisible();
    await page.getByRole('radio', { name: 'Remplacer' }).check();
    await page.getByRole('button', { name: 'Importer', exact: true }).click();
    await (
      await dialogNamed(page, 'Remplacer cet espace de travail ?')
    )
      .getByRole('button', { name: 'Tout remplacer' })
      .click();

    await expect(
      page.getByText(/^3 enregistrements du fichier étaient inutilisables/),
    ).toBeVisible();
    await expect
      .poll(async () => (await readStore(page, 'apps')).map((a) => a.name))
      .toEqual(['Alpha']);
  });
});

test('the sample replaces a workspace only after a confirmation', async ({ page }) => {
  await openApp(page);
  await loadSample(page);
  await openAdmin(page, 'Réglages');
  await page.getByLabel('Nom de ce dashboard').fill('Mien');
  await page.getByLabel('Nom de ce dashboard').press('Enter');
  await waitForWrite(page, 'settings', 'dashboardName', 'Mien');

  await page.getByRole('button', { name: 'Charger l’exemple' }).click();
  await (
    await dialogNamed(page, 'Remplacer cet espace de travail par l’exemple ?')
  )
    .getByRole('button', { name: 'Charger l’exemple' })
    .click();

  await expect(page.getByText('Exemple chargé').last()).toBeVisible();
  await waitForWrite(page, 'settings', 'dashboardName', 'Mon backoffice');
});
