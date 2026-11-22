// The presenter window: the same app opened with `?view=presenter`, kept in step with the main window
// through a BroadcastChannel. Two pages of one browser context share the origin, as two windows do.
import { expect, test } from '@playwright/test';
import { chooseFolder, expectSlide, loadExample, openApp, slide, watchNetwork } from './support.js';

/** @typedef {import('@playwright/test').BrowserContext} BrowserContext */

/**
 * Opens the presenter window next to the main page.
 * @param {BrowserContext} context
 */
async function openPresenter(context) {
  const presenter = await context.newPage();
  const watch = await watchNetwork(presenter);
  await presenter.goto('/?view=presenter');
  return { presenter, ...watch };
}

test('the presenter window shows what the main window shows, and follows it', async ({
  context,
  page,
}) => {
  await openApp(page);
  await loadExample(page);
  const { presenter, errors } = await openPresenter(context);

  await expect(presenter.locator('h1.sl-presenter__heading')).toHaveText('Vue présentateur');
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');
  await expect(presenter.getByTestId('slide').getByRole('heading', { level: 1 })).toHaveText(
    'Architecture hexagonale',
  );
  await expect(presenter).toHaveTitle('Présentateur · Atelier - Architecture hexagonale en Java');
  // Both kinds of notes, and the next slide.
  await expect(presenter.getByTestId('notes-presenter')).toContainText("Slide d'ouverture");
  await expect(presenter.getByTestId('notes-public')).toContainText("Support de l'atelier");
  await expect(presenter.getByRole('region', { name: 'Diapositive suivante' })).toContainText(
    'Le découpage en couches',
  );

  // The main window moves: the presenter follows.
  await page.keyboard.press('ArrowRight');
  await expect(presenter.getByTestId('counter')).toHaveText('2 / 6');
  await expect(presenter.getByTestId('slide').getByRole('heading', { level: 2 })).toHaveText(
    'Le découpage en couches',
  );
  await expect(presenter.getByTestId('notes-presenter')).toContainText('Insister');
  await expect(presenter.getByTestId('notes-public')).toContainText('Aucune note publique');
  // The image of the folder is shown in the other window too (the object URL is of the origin).
  const picture = presenter.getByTestId('slide').getByRole('img');
  await expect
    .poll(() => picture.evaluate((image) => /** @type {HTMLImageElement} */ (image).naturalWidth))
    .toBe(320);

  await page.keyboard.press('End');
  await expect(presenter.getByTestId('counter')).toHaveText('6 / 6');
  await expect(presenter.getByRole('region', { name: 'Diapositive suivante' })).toContainText(
    'Fin de la présentation',
  );
  expect(errors).toEqual([]);
});

test('the presenter window drives the main window: buttons and keys', async ({ context, page }) => {
  await openApp(page);
  await loadExample(page);
  const { presenter } = await openPresenter(context);
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');

  await presenter.getByRole('button', { name: 'Suivante' }).click();
  await expectSlide(page, 2);
  await expect(presenter.getByTestId('counter')).toHaveText('2 / 6');

  await presenter.getByRole('button', { name: 'Précédente' }).click();
  await expectSlide(page, 1);

  // Space belongs to the button that has the focus: put the focus on the slide.
  await presenter.getByTestId('slide').focus();
  await presenter.keyboard.press('ArrowRight');
  await presenter.keyboard.press('Space');
  await expectSlide(page, 3);
  await presenter.keyboard.press('End');
  await expectSlide(page, 6);
  await presenter.keyboard.press('Home');
  await expectSlide(page, 1);
  await presenter.keyboard.press('ArrowLeft');
  await expectSlide(page, 1);
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');
});

test('a presenter window opened before the presentation waits, then gets it', async ({
  context,
  page,
}) => {
  await openApp(page);
  const { presenter } = await openPresenter(context);

  await expect(presenter.getByTestId('waiting')).toContainText('En attente de la présentation');

  await chooseFolder(page, 'plain');
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 4');
  await expect(presenter.getByTestId('waiting')).toBeHidden();
  await expect(presenter.getByTestId('notes-presenter')).toContainText('Say hello.');
  await expect(presenter).toHaveTitle('Présentateur · Plain talk');

  // A second presentation replaces the first one in the presenter window.
  await page.getByRole('button', { name: 'Fermer la présentation' }).click();
  await loadExample(page);
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');
});

test('the timers are local to the presenter window: the total runs on demand, the slide timer restarts at every slide', async ({
  context,
  page,
}) => {
  await openApp(page);
  await loadExample(page);
  const { presenter } = await openPresenter(context);
  await presenter.clock.install();
  await presenter.reload();
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');
  const total = presenter.getByTestId('timer-total');
  const slideTimer = presenter.getByTestId('timer-slide');

  await expect(total).toHaveText('00:00');
  await presenter.clock.runFor(5000);
  await expect(slideTimer).toHaveText('00:05');
  await expect(total).toHaveText('00:00');

  await presenter.getByRole('button', { name: 'Démarrer le minuteur' }).click();
  await presenter.clock.runFor(3000);
  await expect(total).toHaveText('00:03');
  await expect(
    presenter.getByRole('button', { name: 'Mettre le minuteur en pause' }),
  ).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(presenter.getByTestId('counter')).toHaveText('2 / 6');
  await presenter.clock.runFor(1000);
  await expect(slideTimer).toHaveText('00:01');
  await expect(total).toHaveText('00:04');

  await presenter.getByRole('button', { name: 'Mettre le minuteur en pause' }).click();
  await presenter.clock.runFor(10_000);
  await expect(total).toHaveText('00:04');
  await presenter.getByRole('button', { name: 'Remettre le minuteur total à zéro' }).click();
  await expect(total).toHaveText('00:00');
  // The main window has no timer.
  await expect(page.getByTestId('timer-total')).toHaveCount(0);
});

test('the presenter button of the main window opens the window, and the key S does the same', async ({
  context,
  page,
}) => {
  await openApp(page);
  await loadExample(page);

  const popup = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Vue présentateur' }).click();
  const presenter = await popup;
  await presenter.waitForLoadState();

  expect(new URL(presenter.url()).searchParams.get('view')).toBe('presenter');
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');
  await expect(slide(page)).toBeVisible();

  // The window has a name, so the key reuses it instead of opening another one.
  await page.bringToFront();
  await page.keyboard.press('s');
  await expect(presenter.getByTestId('counter')).toHaveText('1 / 6');
  expect(context.pages().filter((p) => p.url().includes('view=presenter'))).toHaveLength(1);
});
