// The tooltips of the small icon buttons: they open in the top layer, so that the sidebar's
// scrolling area does not cut them off, and on the side that has room (above the editor toolbar,
// so that they do not cover the text).
import { expect, test } from '@playwright/test';
import { createNote, openApp } from './support.js';

/**
 * Whether the whole box of an element is what a pointer hits: the middle of each of its four
 * quarters resolves to the element itself (or a child). A box cut off by an overflow fails.
 * @param {import('@playwright/test').Locator} tip
 */
async function isFullyHittable(tip) {
  return tip.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const points = [
      [r.left + 2, r.top + r.height / 2],
      [r.right - 2, r.top + r.height / 2],
      [r.left + r.width / 2, r.top + 2],
      [r.left + r.width / 2, r.bottom - 2],
    ];
    return (
      r.left >= 0 &&
      r.top >= 0 &&
      r.right <= window.innerWidth &&
      r.bottom <= window.innerHeight &&
      points.every(([x, y]) => node.contains(document.elementFromPoint(x ?? 0, y ?? 0)))
    );
  });
}

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

test('the tooltip of a sidebar button is not cut off by the sidebar', async ({ page }) => {
  await openApp(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  const add = nav.getByRole('button', { name: 'Nouvelle note dans Domaines' });

  await add.hover();

  const tip = page.getByRole('tooltip', { name: 'Nouvelle note dans Domaines' });
  await expect(tip).toBeVisible();
  // The text is wider than what is left of the sidebar: it must still be shown in full.
  const sidebar = await nav.boundingBox();
  const box = await tip.boundingBox();
  expect(box && sidebar && box.x + box.width > sidebar.x + sidebar.width).toBe(true);
  expect(await isFullyHittable(tip)).toBe(true);
  // Escape dismisses it (WCAG 1.4.13).
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});

test('the tooltip of the folder menu button is not cut off by the sidebar', async ({ page }) => {
  await openApp(page);
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('1');
  const trigger = page.getByRole('button', { name: 'Actions du dossier « Projets généraux »' });

  await trigger.hover();

  const tip = page.getByRole('tooltip', { name: 'Actions du dossier « Projets généraux »' });
  await expect(tip).toBeVisible();
  expect(await isFullyHittable(tip)).toBe(true);

  // Opening the menu still works with the tooltip in the top layer.
  await trigger.click();
  await expect(
    page.getByRole('menu', { name: 'Actions du dossier « Projets généraux »' }),
  ).toBeVisible();
});

test('a toolbar tooltip opens above its button, so the text stays readable', async ({ page }) => {
  await openApp(page);
  await createNote(page);
  const bold = page.getByRole('toolbar', { name: 'Mise en forme du texte' }).getByRole('button', {
    name: 'Gras',
  });

  await bold.hover();

  const tip = page.getByRole('tooltip', { name: 'Gras' });
  await expect(tip).toBeVisible();
  const button = await bold.boundingBox();
  const tipBox = await tip.boundingBox();
  const surface = await page.getByRole('textbox', { name: 'Contenu de la note' }).boundingBox();
  expect(tipBox && button && tipBox.y + tipBox.height <= button.y).toBe(true);
  expect(tipBox && surface && tipBox.y + tipBox.height <= surface.y).toBe(true);
  expect(await isFullyHittable(tip)).toBe(true);
});

test('a tooltip falls back below its button when there is no room above', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  // The first button of the top bar sits at the top of the window: nothing fits above it.
  const button = page.getByRole('banner').getByRole('button', { name: 'Préférences' });

  await button.hover();

  const tip = page.getByRole('tooltip', { name: 'Préférences' });
  await expect(tip).toBeVisible();
  const anchor = await button.boundingBox();
  const tipBox = await tip.boundingBox();
  expect(tipBox && anchor && tipBox.y >= anchor.y + anchor.height).toBe(true);
});
