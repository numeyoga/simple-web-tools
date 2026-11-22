// Groups: create (name and colour), edit, feature (shown first), fold (kept), delete after a
// confirmation. The colour is a Covenant category (`data-cat`), always next to the group's name.
import { expect, test } from '@playwright/test';
import {
  addGroup,
  addLink,
  card,
  cardLabels,
  dialogNamed,
  foldButton,
  openApp,
  readStore,
  setEditMode,
  waitForWrite,
} from './support.js';

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => {
    throw new Error(`a native ${dialog.type()} dialog opened: ${dialog.message()}`);
  });
});

test('a group is created with a name and a colour; the colour is a category, stored as a number', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('menuitem', { name: 'Nouveau groupe' }).click();
  const dialog = await dialogNamed(page, 'Nouveau groupe');

  // The colour picker: 16 named colours, one checked, its name next to the legend.
  await expect(dialog.getByRole('radio')).toHaveCount(16);
  await expect(dialog.getByRole('radio', { name: 'Bleu', exact: true })).toBeChecked(); // the advised first
  await dialog.getByLabel('Nom du groupe').fill('Lectures');
  await dialog.getByRole('radio', { name: 'Violet' }).check();
  await expect(dialog.getByText('Violet', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();

  await expect(card(page, 'Lectures')).toHaveAttribute('data-cat', '11');
  await waitForWrite(page, 'groups', 'label', 'Lectures');
  expect((await readStore(page, 'groups'))[0]).toMatchObject({ label: 'Lectures', category: 11 });
  // The sidebar lists the group, with its dot and its name.
  await expect(
    page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('button', { name: /^Lectures/ }),
  ).toBeVisible();
});

test('new groups get the colours of the advised order, one after the other', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Un');
  await addGroup(page, 'Deux');
  await addGroup(page, 'Trois');

  await expect(card(page, 'Un')).toHaveAttribute('data-cat', '9');
  await expect(card(page, 'Deux')).toHaveAttribute('data-cat', '4');
  await expect(card(page, 'Trois')).toHaveAttribute('data-cat', '14');
});

test('a group needs a name', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('menuitem', { name: 'Nouveau groupe' }).click();
  const dialog = await dialogNamed(page, 'Nouveau groupe');

  await dialog.getByRole('button', { name: 'Créer', exact: true }).click();

  await expect(dialog.getByText('Le nom est vide')).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('a group is renamed and recoloured in edit mode', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Ancien');
  await setEditMode(page, true);

  await page.getByRole('button', { name: 'Actions du groupe « Ancien »' }).click();
  await page.getByRole('menuitem', { name: 'Modifier le groupe' }).click();
  const dialog = await dialogNamed(page, 'Modifier le groupe');
  await dialog.getByLabel('Nom du groupe').fill('Récent');
  await dialog.getByRole('radio', { name: 'Orange' }).check();
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(card(page, 'Récent')).toHaveAttribute('data-cat', '1');
  await expect(card(page, 'Ancien')).toHaveCount(0);
});

test('a featured group is shown first, with its star, and the choice is kept', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Premier');
  await addGroup(page, 'Second');
  expect(await cardLabels(page)).toEqual(['Premier', 'Second']);

  const star = page.getByRole('button', { name: 'Mettre « Second » en avant' });
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();

  await expect(star).toHaveAttribute('aria-pressed', 'true');
  expect(await cardLabels(page)).toEqual(['Second', 'Premier']);
  await expect(card(page, 'Second').getByText('Mis en avant')).toBeAttached();
  // The star keeps the focus after the board is drawn again (a keyboard user is not sent away).
  await expect(star).toBeFocused();
  await waitForWrite(page, 'groups', 'featured', true);
  await page.reload();
  expect(await cardLabels(page)).toEqual(['Second', 'Premier']);
});

test('a group folds and unfolds, and stays folded after a reload', async ({ page }) => {
  await openApp(page);
  await addGroup(page, 'Pliable');
  await addLink(page, { name: 'Dedans', url: 'dedans.example', group: 'Pliable' });
  const fold = foldButton(page, 'Pliable');
  await expect(fold).toHaveAttribute('aria-expanded', 'true');

  await fold.click();

  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('link', { name: /^Dedans/ })).toBeHidden();
  await expect(fold).toBeFocused();
  await waitForWrite(page, 'groups', 'collapsed', true);
  await page.reload();
  await expect(foldButton(page, 'Pliable')).toHaveAttribute('aria-expanded', 'false');
  await foldButton(page, 'Pliable').click();
  await expect(page.getByRole('link', { name: /^Dedans/ })).toBeVisible();
});

test('a group is deleted after a confirmation: its links are kept, with no group', async ({
  page,
}) => {
  await openApp(page);
  await addGroup(page, 'À supprimer');
  await addLink(page, { name: 'Resté', url: 'reste.example', group: 'À supprimer' });
  await setEditMode(page, true);

  await page.getByRole('button', { name: 'Actions du groupe « À supprimer »' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  const question = await dialogNamed(page, 'Supprimer ce groupe ?');
  await expect(question).toContainText('Son lien est conservé, sans groupe');
  await question.getByRole('button', { name: 'Annuler' }).click();
  await expect(card(page, 'À supprimer')).toBeVisible();

  await page.getByRole('button', { name: 'Actions du groupe « À supprimer »' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();
  await (
    await dialogNamed(page, 'Supprimer ce groupe ?')
  )
    .getByRole('button', { name: 'Supprimer', exact: true })
    .click();

  await expect(card(page, 'À supprimer')).toHaveCount(0);
  await expect(card(page, 'Sans groupe').getByRole('link', { name: /^Resté/ })).toBeVisible();
  await waitForWrite(page, 'links', 'groupId', null);
});

test('the sidebar goes to a group: the card scrolls into view and its title takes the focus', async ({
  page,
}) => {
  await openApp(page);
  await addGroup(page, 'Cible');

  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: /^Cible/ })
    .click();

  await expect(foldButton(page, 'Cible')).toBeFocused();
});
