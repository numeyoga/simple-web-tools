// The print document: one A4 page per slide, the slide in the upper half and its public notes in the
// lower half, in the light theme, with the rest of the app hidden. The print stylesheet is checked
// through `page.emulateMedia({ media: 'print' })`, by layout.
import { expect, test } from '@playwright/test';
import { chooseFolder, expectSlide, loadExample, openApp } from './support.js';

test.use({ reducedMotion: 'reduce' });

/** 1 mm in CSS pixels. */
const MM = 96 / 25.4;

/** Stops the print dialog that `window.print()` would open, and counts its calls. @param {import('@playwright/test').Page} page */
async function stubPrint(page) {
  await page.addInitScript(() => {
    /** @type {any} */ (window).__printed = 0;
    window.print = () => {
      /** @type {any} */ (window).__printed += 1;
    };
  });
}

test('the print button builds one page per slide, draws the diagrams, and prints', async ({
  page,
}) => {
  await stubPrint(page);
  await openApp(page);
  await chooseFolder(page, 'plain');
  await expectSlide(page, 1);

  await page.getByRole('button', { name: 'Imprimer' }).click();

  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__printed)).toBe(1);
  const pages = page.locator('.sl-print__page');
  await expect(pages).toHaveCount(4);
  // The diagram of slide 4 is drawn by the time the dialog opens.
  await expect(pages.nth(3).locator('pre.mermaid[data-drawn] svg')).toHaveCount(1);
  // On screen the document is out of sight and out of the way.
  await expect(page.getByTestId('print')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
});

test('Ctrl+P prints through the app, so that the diagrams are ready', async ({ page }) => {
  await stubPrint(page);
  await openApp(page);
  await chooseFolder(page, 'plain');
  await expectSlide(page, 1);

  await page.keyboard.press('Control+p');

  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__printed)).toBe(1);
  await expect(page.locator('.sl-print__page pre.mermaid[data-drawn]')).toHaveCount(1);
});

test('in print media: only the document is shown, A4 pages, slide above the notes, light theme', async ({
  page,
}) => {
  await stubPrint(page);
  await openApp(page);
  await chooseFolder(page, 'plain'); // a dark presentation
  await expectSlide(page, 1);
  await page.getByRole('button', { name: 'Imprimer' }).click();
  await expect(page.locator('.sl-print__page pre.mermaid[data-drawn]')).toHaveCount(1);

  await page.emulateMedia({ media: 'print' });

  // Everything else is gone.
  await expect(page.locator('#root')).toBeHidden();
  const document_ = page.getByTestId('print');
  await expect(document_).toBeVisible();
  const pages = page.locator('.sl-print__page');
  await expect(pages).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    const box = await pages.nth(i).boundingBox();
    // A4 is 297 mm high with 12 mm of margin on each side.
    expect(box?.height).toBeCloseTo(272 * MM, 0);
    const slideBox = await pages.nth(i).locator('.sl-print__slide').boundingBox();
    const notesBox = await pages.nth(i).locator('.sl-print__notes').boundingBox();
    expect(slideBox?.y).toBeLessThan(notesBox?.y ?? 0);
    expect(slideBox?.height).toBeCloseTo(notesBox?.height ?? 0, -1);
  }
  // The page is light, whatever the theme of the slides: dark ink on a white page.
  const colors = await pages.first().evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, ink: style.color };
  });
  expect(colors.background).toBe('rgb(250, 250, 250)');
  expect(colors.ink).not.toBe('rgb(255, 255, 255)');
  // The public notes are under their slide; the presenter notes are never printed.
  await expect(pages.nth(0).locator('.sl-print__notes')).toContainText('Printed note one.');
  await expect(pages.nth(3).locator('.sl-print__notes')).toContainText('Printed note four.');
  await expect(document_).not.toContainText('Say hello.');
  // Every slide of the presentation is there, once, with its number.
  await expect(pages.nth(1).locator('.sl-print__index')).toHaveText('2 / 4');
  await expect(pages.nth(1).locator('img')).toHaveCount(1);
  // Nothing is cut at the right edge of the page.
  for (let i = 0; i < 4; i += 1) {
    const overflow = await pages
      .nth(i)
      .locator('.sl-slide__content')
      .evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('the print screenshot of the example shows the diagram on a light page', async ({
  page,
}, info) => {
  await stubPrint(page);
  await openApp(page);
  await loadExample(page);
  await page.getByRole('button', { name: 'Imprimer' }).click();
  await expect(page.locator('.sl-print__page pre.mermaid[data-drawn]')).toHaveCount(1);
  await page.emulateMedia({ media: 'print' });

  const diagramPage = page.locator('.sl-print__page').nth(3);
  await diagramPage.scrollIntoViewIfNeeded();
  const shot = await diagramPage.screenshot();
  await info.attach('print-slide-4.png', { body: shot, contentType: 'image/png' });

  // The page is mostly white paper, with ink on it: a dark diagram on white would not print.
  const stats = await diagramPage.evaluate(async (node) => {
    const svg = node.querySelector('pre.mermaid svg');
    const fills = [...(svg?.querySelectorAll('.node rect, .node path, .node polygon') ?? [])].map(
      (shape) => getComputedStyle(shape).fill,
    );
    return { fills, page: getComputedStyle(node).backgroundColor };
  });
  expect(stats.page).toBe('rgb(250, 250, 250)');
  expect(stats.fills.some((fill) => fill === 'rgb(31, 32, 32)')).toBe(false);
  expect(shot.byteLength).toBeGreaterThan(5000);
});

test('the print document is emptied when the presentation is closed, so the home screen prints nothing of it', async ({
  page,
}) => {
  await stubPrint(page);
  await openApp(page);
  await chooseFolder(page, 'plain');
  await page.getByRole('button', { name: 'Imprimer' }).click();
  await expect(page.locator('.sl-print__page')).toHaveCount(4);

  await page.getByRole('button', { name: 'Fermer la présentation' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouvrir une présentation');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));

  await expect(page.locator('.sl-print__page')).toHaveCount(0);
});
