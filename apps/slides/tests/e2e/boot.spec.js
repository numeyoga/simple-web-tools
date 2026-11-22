import { expect, test } from '@playwright/test';
import { chooseFolder, expectSlide, loadExample, openApp, slide } from './support.js';

test('the application starts on the home screen: sidebar, one h1, the ways to open, no error, no request out', async ({
  page,
}) => {
  const { errors, blockedHosts } = await openApp(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouvrir une présentation');
  await expect(page).toHaveTitle('Slides · présentations en Markdown');
  await expect(page.getByRole('button', { name: 'Choisir un dossier' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Charger l’exemple' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Comment écrire une présentation' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Raccourcis clavier' })).toBeVisible();

  expect(errors).toEqual([]);
  // Fonts and icons are bundled: nothing is requested outside the app's own origin.
  expect([...new Set(blockedHosts)]).toEqual([]);
});

test('the example is loaded from the home screen, and shows its first slide', async ({ page }) => {
  const { errors } = await openApp(page);

  await loadExample(page);

  await expect(page).toHaveTitle('Atelier - Architecture hexagonale en Java · Slides');
  await expect(slide(page).getByRole('heading', { level: 1 })).toHaveText(
    'Architecture hexagonale',
  );
  await expect(page.getByTestId('counter')).toHaveText('1 / 6');
  expect(errors).toEqual([]);
});

test('a folder chosen with the folder picker is read and shown', async ({ page }) => {
  const { errors } = await openApp(page);

  await chooseFolder(page, 'plain');

  await expectSlide(page, 1);
  await expect(page).toHaveTitle('Plain talk · Slides');
  await expect(slide(page).getByRole('heading', { name: 'First' })).toBeVisible();
  // The notes are not on the slide.
  await expect(slide(page)).not.toContainText('Say hello');
  expect(errors).toEqual([]);
});

test('closing the presentation goes back to the home screen, where another folder can be opened', async ({
  page,
}) => {
  await openApp(page);
  await chooseFolder(page, 'plain');
  await expectSlide(page, 1);

  await page.getByRole('button', { name: 'Fermer la présentation' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouvrir une présentation');
  await loadExample(page);
  await expect(page.getByTestId('counter')).toHaveText('1 / 6');
});

test('a folder with no slides.md says so, and keeps the home screen', async ({ page }) => {
  await openApp(page);

  await chooseFolder(page, 'no-main');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Ce dossier ne contient pas de présentation');
  await expect(alert).toContainText('slides.md');
  await expect(page.getByRole('button', { name: 'Choisir un dossier' })).toBeEnabled();
});

test('settings that are not valid YAML are reported with the reason', async ({ page }) => {
  await openApp(page);

  await chooseFolder(page, 'broken-yaml');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Les réglages en haut du fichier ne sont pas valides');
  await expect(alert).toContainText('YAML');
});

test('dropping something that is not a folder reports that slides.md is missing', async ({
  page,
}) => {
  await openApp(page);

  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['# Hello'], 'slides.md', { type: 'text/markdown' }));
    document
      .querySelector('main')
      ?.dispatchEvent(
        new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }),
      );
  });

  await expect(page.getByRole('alert')).toContainText('Ce dossier ne contient pas de présentation');
});
