// The tooltips of the small icon buttons are Covenant's: they open in the top layer, on hover and
// on keyboard focus, and Escape dismisses them (WCAG 1.4.13).
import { expect, test } from '@playwright/test';
import { loadSample, openApp, openAppNamed } from './support.js';

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

test('an icon button names itself in a tooltip, on hover and on focus, and Escape dismisses it', async ({
  page,
}) => {
  await openApp(page);
  await loadSample(page);
  const copy = page.getByRole('button', { name: 'Copier l’adresse de « Pipeline »' }).first();

  await copy.hover();
  const tip = page.getByRole('tooltip', { name: 'Copier l’adresse de « Pipeline »' }).first();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();

  await page.mouse.move(0, 0);
  await copy.focus();
  await expect(tip).toBeVisible();
});

test('the open button of a link names itself in a tooltip', async ({ page }) => {
  await openApp(page);
  await loadSample(page);
  const open = page.getByRole('link', { name: 'Ouvrir « Pipeline »' }).first();

  await open.hover();

  await expect(page.getByRole('tooltip', { name: 'Ouvrir « Pipeline »' }).first()).toBeVisible({
    timeout: 3000,
  });
});

test('a link that cannot be opened says why in its tooltip', async ({ page }) => {
  await openApp(page);
  await loadSample(page);
  await openAppNamed(page, 'HrBackoffice');
  await page.getByRole('tab', { name: /^UAT/ }).click();

  await page.getByRole('img', { name: /« Console du cluster » ne peut pas être ouvert/ }).hover();

  await expect(
    page.getByRole('tooltip', { name: 'À compléter : {meta.cluster}, {meta.namespace}' }),
  ).toBeVisible({ timeout: 3000 });
});
