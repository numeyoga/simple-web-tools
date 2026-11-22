// Links: add (with https:// added), edit, delete after a confirmation, copy, and the addresses
// that are refused (only http and https are accepted).
import { expect, test } from '@playwright/test';
import {
  addGroup,
  addLink,
  card,
  dialogNamed,
  openApp,
  setEditMode,
  waitForWrite,
} from './support.js';

test.beforeEach(({ page }) => {
  // The native prompt, confirm and alert give way to Covenant dialogs: none may open.
  page.on('dialog', (dialog) => {
    throw new Error(`a native ${dialog.type()} dialog opened: ${dialog.message()}`);
  });
});

test('a bare host gets https://, and the link opens in a new tab without an opener', async ({
  page,
}) => {
  await openApp(page);

  await addLink(page, { name: 'Mon site', url: 'exemple.com' });

  const link = page.getByRole('link', { name: /^Mon site/ });
  await expect(link).toHaveAttribute('href', 'https://exemple.com');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  // The name of the link says it opens a new tab.
  await expect(link).toHaveAccessibleName('Mon site (s’ouvre dans un nouvel onglet)');
  await expect(page.getByText('Lien ajouté')).toBeVisible();
});

test('a link without a name shows its address', async ({ page }) => {
  await openApp(page);

  await addLink(page, { url: 'https://example.org/page' });

  await expect(page.getByRole('link', { name: /^https:\/\/example\.org\/page/ })).toBeVisible();
});

test.describe('only http and https addresses are accepted', () => {
  for (const [input, message] of [
    ['javascript:alert(1)', /Seules les adresses http et https sont acceptées/],
    ['JaVaScRiPt:alert(document.cookie)', /Seules les adresses http et https/],
    ['data:text/html,<script>alert(1)</script>', /Seules les adresses http et https/],
    ['file:///etc/passwd', /Seules les adresses http et https/],
    ['mailto:someone@example.org', /Seules les adresses http et https/],
    ['ftp://example.org/file', /Seules les adresses http et https/],
    ['http://', /n’est pas une adresse web valide/],
    ['', /L’adresse est vide/],
  ]) {
    test(`"${input}" is refused with a message, and nothing is created`, async ({ page }) => {
      await openApp(page);
      await page.getByRole('button', { name: 'Nouveau lien' }).first().click();
      const dialog = await dialogNamed(page, 'Nouveau lien');

      await dialog.getByLabel('Adresse').fill(input);
      await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

      await expect(dialog.getByText(message)).toBeVisible();
      await expect(dialog.getByLabel('Adresse')).toHaveAttribute('aria-invalid', 'true');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Annuler' }).click();
      await expect(page.getByText('Aucun favori pour le moment')).toBeVisible();
      expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
    });
  }

  test('an http address is fine, and a host with a port too', async ({ page }) => {
    await openApp(page);

    await addLink(page, { name: 'Local', url: 'localhost:3000/app' });
    await addLink(page, { name: 'Clair', url: 'http://example.org' });

    await expect(page.getByRole('link', { name: /^Local/ })).toHaveAttribute(
      'href',
      'https://localhost:3000/app',
    );
    await expect(page.getByRole('link', { name: /^Clair/ })).toHaveAttribute(
      'href',
      'http://example.org',
    );
  });
});

test('a link is edited: name, address and group', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Outils');
  await addLink(page, { name: 'Vieux nom', url: 'ancien.example' });

  await page.getByRole('button', { name: 'Modifier « Vieux nom »' }).click();
  const dialog = await dialogNamed(page, 'Modifier le lien');
  await dialog.getByLabel('Nom', { exact: true }).fill('Nouveau nom');
  await dialog.getByLabel('Adresse').fill('nouveau.example/page');
  await dialog.getByLabel('Groupe', { exact: true }).selectOption({ label: 'Outils' });
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  const link = card(page, 'Outils').getByRole('link', { name: /^Nouveau nom/ });
  await expect(link).toHaveAttribute('href', 'https://nouveau.example/page');
  await expect(page.getByRole('link', { name: /^Vieux nom/ })).toHaveCount(0);
  await waitForWrite(page, 'links', 'name', 'Nouveau nom');
});

test('an edit with an unsafe address is refused: the link keeps its address', async ({ page }) => {
  await openApp(page);
  await addLink(page, { name: 'Sûr', url: 'https://sur.example' });

  await page.getByRole('button', { name: 'Modifier « Sûr »' }).click();
  const dialog = await dialogNamed(page, 'Modifier le lien');
  await dialog.getByLabel('Adresse').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(dialog.getByText(/Seules les adresses http et https/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('link', { name: /^Sûr/ })).toHaveAttribute(
    'href',
    'https://sur.example',
  );
});

test('a link is deleted after a confirmation, and kept when the question is cancelled', async ({
  page,
}) => {
  await openApp(page);
  await addLink(page, { name: 'Éphémère', url: 'ephemere.example' });
  await setEditMode(page, true);

  await page.getByRole('button', { name: 'Supprimer « Éphémère »' }).click();
  const question = await dialogNamed(page, 'Supprimer ce lien ?');
  await question.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('link', { name: /^Éphémère/ })).toBeVisible();

  await page.getByRole('button', { name: 'Supprimer « Éphémère »' }).click();
  await (
    await dialogNamed(page, 'Supprimer ce lien ?')
  )
    .getByRole('button', { name: 'Supprimer', exact: true })
    .click();

  await expect(page.getByRole('link', { name: /^Éphémère/ })).toHaveCount(0);
  await expect(page.getByText('Lien supprimé')).toBeVisible();
  await expect(page.getByText('Aucun favori pour le moment')).toBeVisible();
});

test('a link is deleted from its edit dialog too', async ({ page }) => {
  await openApp(page);
  await addLink(page, { name: 'Depuis le dialogue', url: 'dialogue.example' });

  await page.getByRole('button', { name: 'Modifier « Depuis le dialogue »' }).click();
  await (
    await dialogNamed(page, 'Modifier le lien')
  )
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await (
    await dialogNamed(page, 'Supprimer ce lien ?')
  )
    .getByRole('button', { name: 'Supprimer', exact: true })
    .click();

  await expect(page.getByRole('link', { name: /^Depuis le dialogue/ })).toHaveCount(0);
});

test('a new group can be made from the link dialog, with its colour', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Nouveau lien' }).first().click();
  const dialog = await dialogNamed(page, 'Nouveau lien');

  await dialog.getByLabel('Adresse').fill('recette.example');
  await dialog.getByLabel('Groupe', { exact: true }).selectOption({ label: 'Nouveau groupe…' });
  await dialog.getByLabel('Nom du groupe').fill('Recettes');
  await dialog.getByRole('radio', { name: 'Rose vif' }).check();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  const recipes = card(page, 'Recettes');
  await expect(recipes).toHaveAttribute('data-cat', '15');
  await expect(recipes.getByRole('link', { name: /^https:\/\/recette\.example/ })).toBeVisible();
});

test('the address of a link is copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page);
  await addLink(page, { name: 'À copier', url: 'copie.example' });

  await page.getByRole('button', { name: 'Copier l’adresse de « À copier »' }).click();

  await expect(page.getByText('Adresse copiée')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://copie.example');
});

test('an address that the app stored itself is never given to the page unless it is http or https', async ({
  page,
}) => {
  // A record written by hand into the database, as a damaged or older release could have left it.
  await openApp(page);
  await addLink(page, { name: 'Normal', url: 'https://normal.example' });
  await waitForWrite(page, 'links', 'name', 'Normal');
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('favoris__default');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('links', 'readwrite');
          tx.objectStore('links').put({
            id: 'evil',
            name: 'Piégé',
            url: 'javascript:alert(document.domain)',
            groupId: null,
            position: 9,
          });
          tx.oncomplete = () => {
            db.close();
            resolve(undefined);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

  await page.reload();

  await expect(page.getByRole('link', { name: /^Normal/ })).toBeVisible();
  await expect(page.getByText('Piégé')).toHaveCount(0);
  expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
});
