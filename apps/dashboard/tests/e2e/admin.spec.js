// The administration screens: templates (environments and links), the metadata fields, the tags and
// the settings of the workspace. Every field commits when it is left; destructive actions ask
// first, in a Covenant dialog.
import { expect, test } from '@playwright/test';
import {
  dialogNamed,
  loadSample,
  openAdmin,
  openApp,
  openAppNamed,
  readStore,
  shownLinks,
  waitForWrite,
} from './support.js';

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => {
    throw new Error(`a native ${dialog.type()} dialog opened: ${dialog.message()}`);
  });
});

/** The names of the templates of the list. @param {import('@playwright/test').Page} page */
const templateNames = (page) =>
  page
    .getByRole('region', { name: 'Templates', exact: true })
    .locator('.cv-nav-item .dsh-ellipsis')
    .allTextContents();

test.describe('templates', () => {
  test('one is created, named, described and deleted; one that applications use cannot be', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Templates');
    await expect
      .poll(() => templateNames(page))
      .toEqual(['webapp-spring', 'microservice-node', 'batch-java', 'frontend-react']);

    // In use: refused, with the reason.
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(page.getByText('3 applications l’utilisent encore.')).toBeVisible();

    await page.getByRole('button', { name: 'Nouveau template' }).click();
    await expect(page.getByRole('textbox', { name: 'Nom', exact: true })).toHaveValue(
      'Nouveau template 5',
    );
    await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('worker-go');
    await page.getByRole('textbox', { name: 'Nom', exact: true }).press('Enter');
    await page.getByLabel('Description', { exact: true }).fill('Un worker.');
    await page.getByLabel('Description', { exact: true }).press('Tab');
    await expect.poll(() => templateNames(page)).toContain('worker-go');
    await waitForWrite(page, 'templates', 'description', 'Un worker.');

    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await (
      await dialogNamed(page, 'Supprimer ce template ?')
    )
      .getByRole('button', { name: 'Supprimer', exact: true })
      .click();
    await expect.poll(() => templateNames(page)).not.toContain('worker-go');
  });

  test('a template is duplicated, with new ids for its links', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Templates');

    await page.getByRole('button', { name: 'Dupliquer', exact: true }).click();

    await expect(page.getByRole('textbox', { name: 'Nom', exact: true })).toHaveValue(
      'webapp-spring (copie)',
    );
    await expect.poll(async () => (await readStore(page, 'templates')).length).toBe(5);
    const templates = await readStore(page, 'templates');
    const ids = templates.flatMap((t) => t.links.map((/** @type {{ id: string }} */ l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('the environments: add, rename the key (the applications follow), move, delete', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Templates');

    await page
      .getByRole('region', { name: 'Environnements' })
      .getByRole('button', { name: 'Ajouter' })
      .click();
    await expect(page.getByLabel('Libellé de l’environnement 5')).toHaveValue('ENV1');

    // Renaming the key of PROD moves the data of the applications with it.
    await page.getByLabel('Clé de l’environnement 4').fill('production');
    await page.getByLabel('Clé de l’environnement 4').press('Enter');
    await expect
      .poll(async () =>
        (await readStore(page, 'templates'))
          .find((t) => t.name === 'webapp-spring')
          ?.envs.map((/** @type {{ key: string }} */ e) => e.key),
      )
      .toContain('production');
    await page.getByLabel('Clé de l’environnement 3').fill('production');
    await page.getByLabel('Clé de l’environnement 3').press('Enter');
    await expect(page.getByText('Cette clé est vide ou déjà utilisée')).toBeVisible();
    await openAppNamed(page, 'AccountPortal');
    await page.getByRole('tab', { name: /^PROD/ }).click();
    // `{env}` is the key: the address changed, the metadata followed.
    expect((await shownLinks(page)).find((l) => l.name === 'Pipeline')?.url).toBe(
      'https://gocd.example.invalid/pipelines/account-portal-production',
    );
    expect((await shownLinks(page)).find((l) => l.name === 'Console du cluster')?.url).toContain(
      'ocp-prod-1',
    );

    await openAdmin(page, 'Templates');
    await page.getByRole('button', { name: 'Monter « ENV1 »' }).click();
    await expect
      .poll(() =>
        page
          .getByLabel(/^Libellé de l’environnement/)
          .evaluateAll((nodes) => nodes.map((n) => /** @type {HTMLInputElement} */ (n).value)),
      )
      .toEqual(['DEV', 'TEST', 'UAT', 'ENV1', 'PROD']);
    await page.getByRole('button', { name: 'Supprimer l’environnement « ENV1 »' }).click();
    await (
      await dialogNamed(page, 'Supprimer cet environnement ?')
    )
      .getByRole('button', { name: 'Supprimer', exact: true })
      .click();
    await expect(page.getByLabel(/^Libellé de l’environnement/)).toHaveCount(4);
  });

  test('the links: add, change, tag, scope, move and delete', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Templates');

    await page.getByRole('button', { name: 'Ajouter un lien' }).click();
    await page.getByLabel('Nom du lien 10').fill('Statut');
    await page.getByLabel('Nom du lien 10').press('Enter');
    await page.getByLabel('Modèle du lien 10').fill('https://status.example.invalid/{slug}');
    await page.getByLabel('Modèle du lien 10').press('Enter');
    await page.getByLabel('Tag du lien 10').selectOption({ label: 'Docs' });
    await page.getByLabel('Portée du lien 10').selectOption({ label: 'Global' });
    await page.getByRole('button', { name: 'Monter « Statut »' }).click();
    await expect
      .poll(() =>
        page
          .getByLabel(/^Nom du lien/)
          .evaluateAll((n) => n.map((x) => /** @type {HTMLInputElement} */ (x).value).slice(7)),
      )
      .toEqual(['SonarQube', 'Statut', 'Tableau Jira']);

    await openAppNamed(page, 'AccountPortal');
    const docs = page.locator('[role="tabpanel"]:not([hidden]) .dsh-group[data-tag="docs"]');
    await expect(docs).toContainText('Statut');
    await expect(docs).toContainText('https://status.example.invalid/account-portal');

    await openAdmin(page, 'Templates');
    await page.getByRole('button', { name: 'Supprimer le lien « Statut »' }).click();
    await (
      await dialogNamed(page, 'Supprimer ce lien ?')
    )
      .getByRole('button', { name: 'Supprimer', exact: true })
      .click();
    await expect(page.getByLabel(/^Nom du lien/)).toHaveCount(9);
  });

  test('the placeholders of the template are listed', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Templates');

    const note = page.getByText('Variables', { exact: true }).locator('..');
    await expect(note).toContainText('{env}');
    await expect(note).toContainText('{meta.cluster}');
  });
});

test.describe('metadata fields', () => {
  test('a field is added as a list, and its key is renamed without losing the values', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Champs de métadonnées');

    await page.getByRole('button', { name: 'Ajouter un champ' }).click();
    await page.getByLabel('Libellé du champ 6', { exact: true }).fill('Niveau');
    await page.getByLabel('Libellé du champ 6', { exact: true }).press('Enter');
    await page.getByLabel('Type du champ 6').selectOption({ label: 'Liste' });
    await page.getByLabel('Choix du champ 6').fill('bas, haut');
    await page.getByLabel('Choix du champ 6').press('Enter');
    await waitForWrite(page, 'templates', 'name', 'webapp-spring');
    await expect
      .poll(
        async () =>
          (await readStore(page, 'templates')).find((t) => t.name === 'webapp-spring')
            ?.metaFields[5]?.options,
      )
      .toEqual(['bas', 'haut']);

    // A reserved key and a taken key are refused, with the reason.
    await page.getByLabel('Clé du champ 6', { exact: true }).fill('slug');
    await page.getByLabel('Clé du champ 6', { exact: true }).press('Enter');
    await expect(page.getByText('« slug » est une variable à part entière')).toBeVisible();
    await page.getByLabel('Clé du champ 1', { exact: true }).fill('platform');
    await page.getByLabel('Clé du champ 1', { exact: true }).press('Enter');
    await openAppNamed(page, 'AccountPortal');
    // The value is still there under the new key, and `{meta.cluster}` now reads nothing.
    expect(
      (await readStore(page, 'apps')).find((a) => a.name === 'AccountPortal')?.envs.prod.meta,
    ).toMatchObject({ platform: 'ocp-prod-1' });
    await expect(page.getByRole('tab', { name: /^PROD/ })).toContainText('à compléter');
  });

  test('a field is moved and deleted; its values go with it', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Champs de métadonnées');

    await page.getByRole('button', { name: 'Descendre « Cluster »' }).click();
    await expect
      .poll(() =>
        page
          .getByLabel(/^Libellé du champ/)
          .evaluateAll((n) => n.map((x) => /** @type {HTMLInputElement} */ (x).value)),
      )
      .toEqual(['Namespace', 'Cluster', 'Région', 'Responsable', 'Dernier déploiement']);
    await page.getByRole('button', { name: 'Supprimer le champ « Responsable »' }).click();
    await (
      await dialogNamed(page, 'Supprimer ce champ ?')
    )
      .getByRole('button', { name: 'Supprimer', exact: true })
      .click();
    await expect(page.getByLabel(/^Libellé du champ/)).toHaveCount(4);
    await expect
      .poll(
        async () =>
          (await readStore(page, 'apps')).find((a) => a.name === 'AccountPortal')?.envs.prod.meta
            .owner,
      )
      .toBeUndefined();
  });

  test('another template is picked from the list', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Champs de métadonnées');

    await page.getByRole('link', { name: /^batch-java/ }).click();

    await expect(page.getByRole('heading', { name: 'Champs de batch-java' })).toBeVisible();
    await expect(page.getByLabel(/^Libellé du champ/)).toHaveCount(2);
  });
});

test.describe('tags', () => {
  test('a tag is added, renamed (its links follow), given an icon, moved and deleted', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Tags');

    await page.getByRole('button', { name: 'Ajouter un tag' }).click();
    await page.getByLabel('Libellé du tag 10').fill('Sécurité');
    await page.getByLabel('Libellé du tag 10').press('Enter');
    await page.getByLabel('Icône du tag 10').selectOption('shield');
    await expect
      .poll(async () => (await readStore(page, 'settings'))[0]?.tags.at(-1))
      .toMatchObject({ key: 'tag1', label: 'Sécurité', icon: 'shield' });

    // Renaming the key of "CI / CD": the links that carry it follow.
    await page.getByLabel('Clé du tag 1', { exact: true }).fill('delivery');
    await page.getByLabel('Clé du tag 1', { exact: true }).press('Enter');
    await expect
      .poll(async () => (await readStore(page, 'settings'))[0]?.tags[0]?.key)
      .toBe('delivery');
    await page.getByLabel('Clé du tag 2', { exact: true }).fill('delivery');
    await page.getByLabel('Clé du tag 2', { exact: true }).press('Enter');
    await expect(
      page.getByText('Cette clé est vide ou déjà utilisée par un autre tag.'),
    ).toBeVisible();
    await openAppNamed(page, 'AccountPortal');
    await expect(
      page.locator('[role="tabpanel"]:not([hidden]) .dsh-group[data-tag="delivery"]'),
    ).toContainText('CI / CD');

    await openAdmin(page, 'Tags');
    await page.getByRole('button', { name: 'Monter « Sécurité »' }).click();
    await expect
      .poll(() =>
        page
          .getByLabel(/^Libellé du tag/)
          .evaluateAll((n) => n.map((x) => /** @type {HTMLInputElement} */ (x).value).slice(7, 9)),
      )
      .toEqual(['Archi', 'Sécurité']);

    // Deleting a tag keeps its links, under an unknown tag.
    await page.getByRole('button', { name: 'Supprimer le tag « CI / CD »' }).click();
    const ask = await dialogNamed(page, 'Supprimer ce tag ?');
    await expect(ask).toContainText('sont conservés et affichés sous un tag inconnu');
    await ask.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await openAppNamed(page, 'AccountPortal');
    await expect(
      page.locator('[role="tabpanel"]:not([hidden]) .dsh-group[data-tag="delivery"]'),
    ).toContainText('Tag inconnu « delivery »');
  });
});

test.describe('settings', () => {
  test('the name shows at the top of the page, and the sample or the reset ask first', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Réglages');

    await page.getByLabel('Nom de ce dashboard').fill('Équipe Compte');
    await page.getByLabel('Nom de ce dashboard').press('Enter');
    await expect(page.locator('.dsh-topbar-name')).toHaveText('Équipe Compte');
    await waitForWrite(page, 'settings', 'dashboardName', 'Équipe Compte');

    // The default application opens first.
    await page.getByLabel('Application', { exact: true }).selectOption({ label: 'SearchIndex' });
    await page.goto('/#/');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SearchIndex');

    await openAdmin(page, 'Réglages');
    await page.getByRole('button', { name: 'Charger l’exemple' }).click();
    await (
      await dialogNamed(page, 'Remplacer cet espace de travail par l’exemple ?')
    )
      .getByRole('button', { name: 'Annuler' })
      .click();
    await page.getByRole('button', { name: 'Vider l’espace de travail' }).click();
    await (
      await dialogNamed(page, 'Vider cet espace de travail ?')
    )
      .getByRole('button', { name: 'Vider l’espace de travail' })
      .click();

    await expect(page.getByText('Espace de travail vidé')).toBeVisible();
    await expect.poll(async () => (await readStore(page, 'apps')).length).toBe(0);
    // The tags are back to the default ones, the name is gone.
    expect((await readStore(page, 'settings'))[0]).toMatchObject({ dashboardName: '' });
    expect((await readStore(page, 'settings'))[0]?.tags).toHaveLength(9);
  });

  test('the preferences are one click away', async ({ page }) => {
    await openApp(page);
    await openAdmin(page, 'Réglages');

    await page.getByRole('button', { name: 'Ouvrir les préférences' }).click();

    await dialogNamed(page, 'Préférences');
  });
});

test('an application whose template is gone says so, and where to repair it', async ({ page }) => {
  await openApp(page);
  await loadSample(page);
  await page.evaluate(async () => {
    // Another release or a damaged file left an application with no template.
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('dashboard__default');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const store = /** @type {IDBDatabase} */ (db)
      .transaction('apps', 'readwrite')
      .objectStore('apps');
    const all = await new Promise((resolve) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result);
    });
    const first = /** @type {{ templateId: string, name: string }[]} */ (all).find(
      (a) => a.name === 'AccountPortal',
    );
    if (first) store.put({ ...first, templateId: 'gone' });
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  await page.reload();

  await expect(page.getByText('Template introuvable')).toBeVisible();
  await page.getByRole('link', { name: 'Aller dans Templates pour la réparer' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Templates');
});
