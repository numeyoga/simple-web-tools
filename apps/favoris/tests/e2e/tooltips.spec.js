// The tooltips of the small icon buttons are Covenant's: they open in the top layer, on hover and
// on keyboard focus, and Escape dismisses them (WCAG 1.4.13).
import { expect, test } from '@playwright/test';
import { addLink, openApp } from './support.js';

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

test('an icon button names itself in a tooltip, on hover and on focus, and Escape dismisses it', async ({
  page,
}) => {
  await openApp(page);
  await addLink(page, { name: 'Site', url: 'site.example' });
  const copy = page.getByRole('button', { name: 'Copier l’adresse de « Site »' });

  await copy.hover();
  const tip = page.getByRole('tooltip', { name: 'Copier l’adresse de « Site »' });
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();

  await page.mouse.move(0, 0);
  await copy.focus();
  await expect(tip).toBeVisible();
});

test('the link shows its address in a tooltip', async ({ page }) => {
  await openApp(page);
  await addLink(page, { name: 'Site', url: 'site.example/page' });

  await page.getByRole('link', { name: /^Site/ }).hover();

  await expect(page.getByRole('tooltip', { name: 'https://site.example/page' })).toBeVisible({
    timeout: 3000,
  });
});
