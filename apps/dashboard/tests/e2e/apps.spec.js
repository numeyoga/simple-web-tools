// An application: its links resolved from the patterns of its template, per environment (copy, open,
// what is missing, what cannot be opened), edit mode (facts, metadata, a different address, extra
// links), the filter, the command menu and the memory of the environment.
import { expect, test } from '@playwright/test';
import {
  createApp,
  dialogNamed,
  loadSample,
  openAdmin,
  openApp,
  openAppNamed,
  readStore,
  setEditMode,
  shownLinks,
  waitForWrite,
} from './support.js';

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => {
    throw new Error(`a native ${dialog.type()} dialog opened: ${dialog.message()}`);
  });
});

/** The row of a link in the environment that is shown. @param {import('@playwright/test').Page} page @param {string} name */
const row = (page, name) =>
  page
    .locator('[role="tabpanel"]:not([hidden]) .dsh-link')
    .filter({ has: page.locator('.dsh-link__name', { hasText: name }) });

test.describe('resolved links', () => {
  test('a pattern is filled in for the environment that is shown, and the environment follows the tabs', async ({
    page,
  }) => {
    const { errors } = await openApp(page);
    await loadSample(page);

    // The last environment of the template opens first.
    await expect(page.getByRole('tab', { name: /^PROD/ })).toHaveAttribute('aria-selected', 'true');
    const prod = await shownLinks(page);
    expect(prod).toContainEqual({
      name: 'Pipeline',
      url: 'https://gocd.example.invalid/pipelines/account-portal-prod',
    });
    expect(prod).toContainEqual({
      name: 'Console du cluster',
      url: 'https://console.ocp-prod-1.example.invalid/k8s/ns/acc-prod/deployments',
    });
    // `{jiraKey}` and the global links are filled in too.
    expect(prod).toContainEqual({
      name: 'Tableau Jira',
      url: 'https://jira.example.invalid/board?projectKey=ACC',
    });

    await page.getByRole('tab', { name: /^TEST/ }).click();
    await expect(page.getByRole('tab', { name: /^TEST/ })).toHaveAttribute('aria-selected', 'true');
    expect(await shownLinks(page)).toContainEqual({
      name: 'Pipeline',
      url: 'https://gocd.example.invalid/pipelines/account-portal-test',
    });
    // The arrow keys move between the tabs.
    await page.getByRole('tab', { name: /^TEST/ }).press('ArrowLeft');
    await expect(page.getByRole('tab', { name: /^DEV/ })).toHaveAttribute('aria-selected', 'true');
    expect((await shownLinks(page))[0]?.url).toContain('-dev');
    expect(errors).toEqual([]);
  });

  test('a link opens in a new tab without a referrer, and its address is copied', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await openApp(page);
    await loadSample(page);

    const open = page.getByRole('link', { name: 'Ouvrir « Dépôt Git »' });
    await expect(open).toHaveAttribute(
      'href',
      'https://git.example.invalid/backoffice/account-portal',
    );
    await expect(open).toHaveAttribute('target', '_blank');
    await expect(open).toHaveAttribute('rel', 'noopener noreferrer');

    await page.getByRole('button', { name: 'Copier l’adresse de « Dépôt Git »' }).click();
    // The clipboard is not always available to a remote browser: either way the person is told.
    await expect(page.getByText(/^(Adresse copiée|Copie impossible)$/)).toBeVisible();
  });

  test('the values still to fill in are counted on the tab and named on the link, which cannot be opened', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAppNamed(page, 'HrBackoffice');

    // UAT of that application is empty: the tab says how many links are to fill in.
    const uat = page.getByRole('tab', { name: /^UAT/ });
    await expect(uat).toContainText('2 liens à compléter');
    await uat.click();

    const console_ = row(page, 'Console du cluster');
    await expect(console_).toContainText('À compléter : {meta.cluster}, {meta.namespace}');
    await expect(console_.getByRole('link')).toHaveCount(0);
    await expect(
      console_.getByRole('img', { name: /« Console du cluster » ne peut pas être ouvert/ }),
    ).toBeVisible();
    // The links that need nothing else are fine.
    await expect(row(page, 'Dépôt Git').getByRole('link', { name: /^Ouvrir/ })).toBeVisible();
  });

  test('a pattern that is not an http or https address is shown, with a reason, and never opened', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Templates');
    await page.getByLabel('Modèle du lien 2').fill('javascript:alert({slug})');
    await page.getByLabel('Modèle du lien 2').press('Enter');
    await openAppNamed(page, 'AccountPortal');

    const git = row(page, 'Dépôt Git');
    await expect(git).toContainText('Pas une adresse web (http ou https uniquement)');
    await expect(git.getByRole('link')).toHaveCount(0);
    await expect(git.getByRole('button', { name: /^Copier/ })).toBeDisabled();
  });
});

test('"Ouvrir tous les liens" opens each openable link of the environment in its own tab', async ({
  page,
  context,
}) => {
  await context.route('**/*.invalid/**', (route) => route.abort());
  await context.route('**/*.invalid', (route) => route.abort());
  await openApp(page);
  await loadSample(page);
  const opened = /** @type {string[]} */ ([]);
  context.on('page', (popup) => opened.push(popup.url()));

  await page.getByRole('button', { name: 'Ouvrir tous les liens' }).click();

  await expect(page.getByText('Ouverture de 9 liens')).toBeVisible();
  await expect.poll(() => opened.length).toBe(9);
  await page.getByRole('button', { name: 'Copier tous les liens' }).click();
  await expect(page.getByText(/^(9 liens copiés|Copie impossible)$/)).toBeVisible();
});

test.describe('edit mode', () => {
  test('the facts of the application are changed in place, and kept', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await setEditMode(page, true);

    await page
      .getByRole('textbox', { name: 'Slug (utilisé dans les adresses)' })
      .fill('Compte Client');
    await page.getByRole('textbox', { name: 'Slug (utilisé dans les adresses)' }).press('Enter');
    await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Compte client');
    await page.getByRole('textbox', { name: 'Nom', exact: true }).press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compte client');
    await waitForWrite(page, 'apps', 'slug', 'compte-client');
    await setEditMode(page, false);

    // The links follow the slug, and the sidebar the name.
    expect((await shownLinks(page))[0]?.url).toBe(
      'https://gocd.example.invalid/pipelines/compte-client-prod',
    );
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Compte client' }),
    ).toBeVisible();
  });

  test('a slug that another application uses is refused', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await setEditMode(page, true);

    const slug = page.getByRole('textbox', { name: 'Slug (utilisé dans les adresses)' });
    await slug.fill('pro-portal');
    await slug.press('Enter');

    await expect(page.getByText('Le slug « pro-portal » est déjà utilisé')).toBeVisible();
    expect((await readStore(page, 'apps')).find((a) => a.name === 'AccountPortal')?.slug).toBe(
      'account-portal',
    );
  });

  test('a metadata value changes the links of its environment, and only that one', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await setEditMode(page, true);

    const cluster = page
      .locator('[role="tabpanel"]:not([hidden])')
      .getByRole('textbox', { name: 'Cluster' });
    await cluster.fill('ocp-new');
    await cluster.press('Tab');
    await waitForWrite(page, 'apps', 'name', 'AccountPortal');
    await expect
      .poll(async () => (await shownLinks(page)).find((l) => l.name === 'Console du cluster')?.url)
      .toBe('https://console.ocp-new.example.invalid/k8s/ns/acc-prod/deployments');
    await page.getByRole('tab', { name: /^TEST/ }).click();
    expect((await shownLinks(page)).find((l) => l.name === 'Console du cluster')?.url).toContain(
      'ocp-test-1',
    );

    // A list field offers its choices.
    await expect(
      page
        .locator('[role="tabpanel"]:not([hidden])')
        .getByRole('combobox', { name: 'Région' })
        .locator('option'),
    ).toHaveText(['–', 'eu-west-3', 'eu-west-1', 'eu-central-1']);
  });

  test('the address of one link is changed for one environment, and put back', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await setEditMode(page, true);

    await page
      .getByRole('button', { name: 'Modifier l’adresse de « Grafana » pour cet environnement' })
      .click();
    const dialog = await dialogNamed(page, 'Modifier l’adresse de « Grafana »');
    await dialog.getByLabel('Adresse pour cet environnement').fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog.getByText('Seules les adresses http et https')).toBeVisible();
    await dialog
      .getByLabel('Adresse pour cet environnement')
      .fill('grafana.example.invalid/custom');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    const grafana = row(page, 'Grafana');
    await expect(grafana).toContainText('https://grafana.example.invalid/custom');
    await expect(grafana).toContainText('Modifié');
    await page.getByRole('tab', { name: /^TEST/ }).click();
    await expect(row(page, 'Grafana')).not.toContainText('Modifié');

    await page.getByRole('tab', { name: /^PROD/ }).click();
    await page.getByRole('button', { name: 'Revenir au modèle pour « Grafana »' }).click();
    await expect(row(page, 'Grafana')).toContainText(
      'https://grafana.example.invalid/d/account-portal-prod',
    );
    await expect(row(page, 'Grafana')).not.toContainText('Modifié');
  });

  test('an environment is added to the template, for every application that uses it', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await setEditMode(page, true);

    await page.getByRole('button', { name: 'Ajouter un environnement' }).click();

    await expect(page.getByRole('tab', { name: /^ENV1/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Environnement ajouté')).toBeVisible();
    await expect
      .poll(
        async () =>
          (await readStore(page, 'templates')).find((t) => t.name === 'webapp-spring')?.envs.length,
      )
      .toBe(5);
    await openAppNamed(page, 'ProPortal');
    await expect(page.getByRole('tab', { name: /^ENV1/ })).toBeVisible();
  });
});

test.describe('extra links', () => {
  test('are added, changed and deleted; only http and https addresses are accepted', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAppNamed(page, 'NotifService');
    await expect(page.getByText('Aucun lien supplémentaire pour cette application.')).toBeVisible();
    await setEditMode(page, true);

    await page.getByRole('button', { name: 'Ajouter un lien' }).click();
    const dialog = await dialogNamed(page, 'Nouveau lien supplémentaire');
    await dialog.getByRole('textbox', { name: 'Nom', exact: true }).fill('Wiki');
    await dialog.getByRole('textbox', { name: 'Adresse' }).fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(dialog.getByText('Seules les adresses http et https')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Adresse' }).fill('wiki.example.invalid/notif');
    await dialog.getByRole('combobox', { name: 'Tag' }).selectOption({ label: 'Docs' });
    await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

    await expect(page.getByRole('link', { name: /^Wiki/ })).toHaveAttribute(
      'href',
      'https://wiki.example.invalid/notif',
    );
    await waitForWrite(page, 'apps', 'name', 'NotifService');
    expect(
      (await readStore(page, 'apps')).find((a) => a.name === 'NotifService')?.extras[0],
    ).toMatchObject({
      name: 'Wiki',
      url: 'https://wiki.example.invalid/notif',
      tag: 'docs',
    });

    await page.getByRole('button', { name: 'Modifier « Wiki »' }).click();
    const edit = await dialogNamed(page, 'Modifier le lien supplémentaire');
    await edit.getByRole('textbox', { name: 'Nom', exact: true }).fill('Wiki produit');
    await edit.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('link', { name: /^Wiki produit/ })).toBeVisible();

    await page.getByRole('button', { name: 'Supprimer « Wiki produit »' }).click();
    await (
      await dialogNamed(page, 'Supprimer ce lien ?')
    )
      .getByRole('button', { name: 'Supprimer', exact: true })
      .click();
    await expect(page.getByText('Aucun lien supplémentaire pour cette application.')).toBeVisible();
  });
});

test.describe('applications', () => {
  test('one is duplicated, with its own extra links, and one is deleted after a confirmation', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);

    await page.getByRole('button', { name: 'Dupliquer' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal (copie)');
    await expect(page.getByRole('link', { name: /^Wiki du produit/ })).toBeVisible();
    await waitForWrite(page, 'apps', 'slug', 'account-portal-copy');
    const apps = await readStore(page, 'apps');
    const [original, copy] = [
      apps.find((a) => a.name === 'AccountPortal'),
      apps.find((a) => a.slug === 'account-portal-copy'),
    ];
    expect(copy.extras.map((/** @type {{ id: string }} */ x) => x.id)).not.toEqual(
      original.extras.map((/** @type {{ id: string }} */ x) => x.id),
    );

    await setEditMode(page, true);
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await (
      await dialogNamed(page, 'Supprimer cette application ?')
    )
      .getByRole('button', { name: 'Supprimer', exact: true })
      .click();

    await expect(page.getByText('Application supprimée')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'AccountPortal (copie)' }),
    ).toHaveCount(0);
  });

  test('a new application asks for a template, and fills its slug from its name', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Nouvelle application' }).first().click();
    // No template yet: the question says what to do first.
    await expect(page.getByRole('dialog', { name: 'Crée d’abord un template' })).toBeVisible();
    await page.keyboard.press('Escape');
    await loadSample(page);

    await page.getByRole('button', { name: 'Nouvelle application' }).first().click();
    const dialog = await dialogNamed(page, 'Nouvelle application');
    await dialog.getByRole('textbox', { name: 'Nom', exact: true }).fill('Mon Compte Pro');
    await expect(dialog.getByRole('textbox', { name: /^Slug/ })).toHaveValue('mon-compte-pro');
    await dialog.getByRole('textbox', { name: /^Slug/ }).fill('pro-portal');
    await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(dialog.getByText('Le slug « pro-portal » est déjà utilisé')).toBeVisible();
    await dialog.getByRole('textbox', { name: /^Slug/ }).fill('compte-pro');
    await dialog.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mon Compte Pro');
  });
});

test.describe('the filter and the command menu', () => {
  test('the filter keeps the applications and the links that match', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const filter = page.getByRole('searchbox', { name: 'Filtrer les applications et les liens' });

    await filter.fill('fraud');
    await expect(nav.getByRole('link', { name: 'FraudCheck' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'ProPortal' })).toHaveCount(0);
    await expect(nav.getByText('1/12')).toBeVisible();

    await filter.fill('accent zzz');
    await expect(nav.getByText('Aucune application ne correspond au filtre.')).toBeVisible();

    // The same words filter the links of the open application: accents and case do not matter.
    await filter.fill('GRAFANA');
    await expect.poll(async () => (await shownLinks(page)).map((l) => l.name)).toEqual(['Grafana']);
    await filter.fill('xyz');
    await expect(
      page
        .locator('[role="tabpanel"]:not([hidden])')
        .getByText('Aucun lien ne correspond au filtre.'),
    ).toBeVisible();
  });

  test('"/" goes to the filter and "N" opens the new application dialog, unless typing or switched off', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);

    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('/');
    await expect(
      page.getByRole('searchbox', { name: 'Filtrer les applications et les liens' }),
    ).toBeFocused();
    await page.keyboard.type('n');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Filtrer les applications et les liens' }).fill('');

    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('n');
    await dialogNamed(page, 'Nouvelle application');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Préférences' }).click();
    await page.getByRole('switch', { name: /^Raccourcis à une touche/ }).uncheck();
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Ctrl+K opens the command menu: go to an application or a screen, run an action', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);

    await page.keyboard.press('Control+k');
    const menu = page.getByRole('dialog', { name: 'Menu de commandes' });
    await expect(menu).toBeVisible();
    await menu.getByRole('combobox', { name: 'Commande' }).fill('fraud');
    await expect(menu.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FraudCheck');

    await page.keyboard.press('Control+k');
    await menu.getByRole('combobox', { name: 'Commande' }).fill('tags');
    await menu.getByRole('option', { name: 'Aller à Tags' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tags');

    await page.getByRole('button', { name: 'Rechercher une commande' }).click();
    await menu.getByRole('combobox', { name: 'Commande' }).fill('nouvelle');
    await page.keyboard.press('Enter');
    await dialogNamed(page, 'Nouvelle application');
  });

  test('the menu lists the applications that were created since', async ({ page }) => {
    await openApp(page);
    await loadSample(page);
    await createApp(page, { name: 'Zeta Service' });

    await page.keyboard.press('Control+k');
    const menu = page.getByRole('dialog', { name: 'Menu de commandes' });
    await menu.getByRole('combobox', { name: 'Commande' }).fill('zeta');

    await expect(menu.getByRole('option', { name: /Aller à Zeta Service/ })).toBeVisible();
  });
});

test.describe('environment and application at the start', () => {
  test('the environment chosen stays while the page is open, and with "Mémoriser" after a reload', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await page.getByRole('tab', { name: /^UAT/ }).click();
    await openAppNamed(page, 'ProPortal');
    await expect(page.getByRole('tab', { name: /^PROD/ })).toHaveAttribute('aria-selected', 'true');
    await openAppNamed(page, 'AccountPortal');
    await expect(page.getByRole('tab', { name: /^UAT/ })).toHaveAttribute('aria-selected', 'true');
    // Without "Mémoriser" a reload goes back to the setting.
    await page.reload();
    await expect(page.getByRole('tab', { name: /^PROD/ })).toHaveAttribute('aria-selected', 'true');

    await openAdmin(page, 'Réglages');
    await page.getByRole('radio', { name: 'Mémoriser' }).check();
    await openAppNamed(page, 'AccountPortal');
    await page.getByRole('tab', { name: /^UAT/ }).click();
    await page.reload();
    await expect(page.getByRole('tab', { name: /^UAT/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('the first environment can open first, and the last application looked at opens again', async ({
    page,
  }) => {
    await openApp(page);
    await loadSample(page);
    await openAdmin(page, 'Réglages');
    await page.getByRole('radio', { name: 'Premier' }).check();
    await page
      .getByLabel('Application', { exact: true })
      .selectOption({ label: 'La dernière consultée' });
    await openAppNamed(page, 'PaymentCore');
    await expect(page.getByRole('tab', { name: /^DEV/ })).toHaveAttribute('aria-selected', 'true');

    await page.goto('/#/');
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PaymentCore');
  });
});
