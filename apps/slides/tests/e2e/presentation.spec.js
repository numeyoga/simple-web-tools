// The presentation: navigation with the keyboard and the controls, the overview, the frame, full
// screen, and what a slide shows (an image of the folder, highlighted code, a table).
import { expect, test } from '@playwright/test';
import { chooseFolder, dialogNamed, expectSlide, loadExample, openApp, slide } from './support.js';

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await loadExample(page);
  });

  test('the arrows, Space, PageUp, PageDown, Home and End move through the slides', async ({
    page,
  }) => {
    await page.keyboard.press('ArrowRight');
    await expectSlide(page, 2);
    await page.keyboard.press('ArrowDown');
    await expectSlide(page, 3);
    await page.keyboard.press(' ');
    await expectSlide(page, 4);
    await page.keyboard.press('PageDown');
    await expectSlide(page, 5);
    await page.keyboard.press('ArrowLeft');
    await expectSlide(page, 4);
    await page.keyboard.press('ArrowUp');
    await expectSlide(page, 3);
    await page.keyboard.press('PageUp');
    await expectSlide(page, 2);
    await page.keyboard.press('End');
    await expectSlide(page, 6);
    await page.keyboard.press('ArrowRight');
    await expectSlide(page, 6);
    await page.keyboard.press('Home');
    await expectSlide(page, 1);
    await page.keyboard.press('ArrowLeft');
    await expectSlide(page, 1);
  });

  test('digits then Enter go to a slide, and the digits are dropped after a second', async ({
    page,
  }) => {
    await page.keyboard.press('4');
    await page.keyboard.press('Enter');
    await expectSlide(page, 4);

    // Digits that wait too long for the Enter are forgotten.
    await page.keyboard.press('2');
    await page.waitForTimeout(1200);
    await page.keyboard.press('Enter');
    await expectSlide(page, 4);

    await page.keyboard.press('9');
    await page.keyboard.press('9');
    await page.keyboard.press('Enter');
    await expectSlide(page, 6);
  });

  test('the buttons, the slider and the "go to" field move too, and the ends are disabled', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: 'Diapositive précédente' })).toBeDisabled();
    await page.getByRole('button', { name: 'Diapositive suivante' }).click();
    await expectSlide(page, 2);

    await page.getByRole('slider', { name: 'Position dans la présentation' }).fill('4');
    await expectSlide(page, 5);

    const goTo = page.getByRole('spinbutton', { name: 'Aller au numéro de diapositive' });
    await goTo.fill('3');
    await goTo.press('Tab');
    await expectSlide(page, 3);
    await goTo.fill('99');
    await goTo.press('Tab');
    await expectSlide(page, 6);
    await expect(goTo).toHaveValue('6');
    await expect(page.getByRole('button', { name: 'Diapositive suivante' })).toBeDisabled();
  });

  test('the keys do not move the slides while a number is typed in the "go to" field', async ({
    page,
  }) => {
    const goTo = page.getByRole('spinbutton', { name: 'Aller au numéro de diapositive' });
    await goTo.focus();
    await page.keyboard.press('Backspace');
    await page.keyboard.type('3');
    await page.keyboard.press('Space');
    await expectSlide(page, 1);
    await expect(goTo).toHaveValue('3');
    await page.keyboard.press('Enter');
    await expectSlide(page, 3);
  });

  test('Space on a focused button presses it, and does not also move to the next slide', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Diapositive suivante' }).focus();
    await page.keyboard.press(' ');
    await expectSlide(page, 2);
  });

  test('Ctrl and Alt combinations are left to the browser', async ({ page }) => {
    await page.keyboard.press('Control+ArrowRight');
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Control+o');
    await expectSlide(page, 1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the slide shows its content: highlighted code, a table, an image of the folder', async ({
    page,
  }) => {
    await page.keyboard.press('ArrowRight');
    const picture = slide(page).getByRole('img', { name: 'Schéma des trois couches' });
    await expect(picture).toBeVisible();
    expect(await picture.getAttribute('src')).toMatch(/^blob:/);
    await expect
      .poll(() => picture.evaluate((image) => /** @type {HTMLImageElement} */ (image).naturalWidth))
      .toBe(320);

    await page.keyboard.press('ArrowRight');
    await expect(slide(page).locator('pre.hljs .hljs-keyword').first()).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slide(page).getByRole('table')).toBeVisible();
    await expect(slide(page).getByRole('columnheader', { name: 'Règle' })).toBeVisible();
    await expect(slide(page).locator('pre.hljs')).toBeVisible();
  });

  test('a ``` fence that holds --- does not cut the slide', async ({ page }) => {
    await page.getByRole('button', { name: 'Fermer la présentation' }).click();
    await chooseFolder(page, 'plain');
    await expect(page.getByTestId('counter')).toHaveText('1 / 4');
    await page.keyboard.press('3');
    await page.keyboard.press('Enter');
    await expect(slide(page)).toContainText('a: 1');
    await expect(slide(page)).toContainText('b: 2');
  });
});

test.describe('overview', () => {
  test.use({ reducedMotion: 'reduce' });

  test('O opens it, a card goes to its slide, Escape and O close it', async ({ page }) => {
    await openApp(page);
    await loadExample(page);

    await page.keyboard.press('o');
    const overview = await dialogNamed(page, 'Vue d’ensemble');
    const cards = overview.getByRole('button', { name: /^\d/ });
    await expect(cards).toHaveCount(6);
    await expect(cards.nth(0)).toContainText('Architecture hexagonale');
    await expect(cards.nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(cards.nth(3)).toContainText("Flux d'une commande");

    await cards.nth(2).click();
    await expect(overview).toBeHidden();
    await expectSlide(page, 3);

    await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
    await expect(await dialogNamed(page, 'Vue d’ensemble')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Focus is back on the button that opened it.
    await expect(page.getByRole('button', { name: 'Vue d’ensemble' })).toBeFocused();

    await page.keyboard.press('o');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('o');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectSlide(page, 3);
  });
});

test('R fits the slide to the window and back to 16:9, F toggles full screen', async ({ page }) => {
  await openApp(page);
  await loadExample(page);
  const frame = page.locator('.sl-slide');
  const ratio = async () => {
    const box = await frame.boundingBox();
    return (box?.width ?? 0) / (box?.height ?? 1);
  };

  expect(await ratio()).toBeCloseTo(16 / 9, 1);
  await page.keyboard.press('r');
  await expect(
    page.getByRole('button', { name: 'Ajuster la diapositive à la fenêtre' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(await ratio()).not.toBeCloseTo(16 / 9, 1);
  await page.keyboard.press('r');
  expect(await ratio()).toBeCloseTo(16 / 9, 1);

  const fullscreen = page.getByRole('button', { name: 'Plein écran' });
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('f');
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('f');
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
});

test('the frontmatter sets the theme of the slides, apart from the theme of the app', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  await chooseFolder(page, 'sanitizer'); // theme: light
  await expectSlide(page, 1);
  expect(await page.locator('.sl-stage').getAttribute('data-theme')).toBe('light');

  await page.getByRole('button', { name: 'Fermer la présentation' }).click();
  await chooseFolder(page, 'plain'); // theme: dark, in a light app
  await expectSlide(page, 1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.sl-stage')).toHaveAttribute('data-theme', 'dark');
  const [slideBackground, barBackground] = await Promise.all([
    page.locator('.sl-slide').evaluate((n) => getComputedStyle(n).backgroundColor),
    page.locator('.sl-nav').evaluate((n) => getComputedStyle(n).backgroundColor),
  ]);
  expect(slideBackground).not.toBe(barBackground);
});
