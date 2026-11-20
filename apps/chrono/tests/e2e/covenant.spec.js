// The Covenant interface (step 3, lot A): nothing is loaded from outside, confirmations are
// native dialogs, no text is smaller than 12 px, and the dark theme renders every view.
import { expect, test } from '@playwright/test';
import { createProject, openApp } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

const VIEWS = ['Timeline', 'Todos', 'Projets', 'Rapport'];

/**
 * Visits the four views, then opens the quick add and the workspaces dialogs.
 * @param {Page} page
 * @param {(label: string) => Promise<void>} [inspect] called on each screen
 */
async function visitScreens(page, inspect = async () => {}) {
  const nav = page.getByRole('navigation', { name: 'Navigation' });
  for (const view of VIEWS) {
    await nav.getByRole('button', { name: view, exact: true }).click();
    await expect(nav.getByRole('button', { name: view, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await inspect(view);
  }
  await nav.getByRole('button', { name: view0() }).click();
  await page.getByRole('main').getByRole('button', { name: 'Nouvelle' }).click();
  await expect(page.getByRole('dialog', { name: 'Ajouter un chrono' })).toBeVisible();
  await inspect('Ajouter un chrono');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Espace de sauvegarde/ }).click();
  await expect(page.getByRole('dialog', { name: 'Espaces de sauvegarde' })).toBeVisible();
  await inspect('Espaces de sauvegarde');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
const view0 = () => 'Timeline';

test('the built app makes no request outside 127.0.0.1', async ({ page }) => {
  /** @type {string[]} */
  const requested = [];
  /** @type {string[]} */
  const failed = [];
  page.on('request', (request) => requested.push(request.url()));
  page.on('requestfailed', (request) => failed.push(request.url()));
  const { errors, blockedHosts } = await openApp(page, { demo: true, clock: true });

  await visitScreens(page);

  const external = requested.filter((url) => {
    const { protocol, hostname } = new URL(url);
    return /^https?:$/.test(protocol) && hostname !== '127.0.0.1';
  });
  expect(external).toEqual([]);
  expect(blockedHosts).toEqual([]);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
  // The fonts and the icons come from the app itself.
  expect(requested.some((url) => /ibm-plex-sans-latin-400.*\.woff2$/.test(url))).toBe(true);
  expect(requested.some((url) => /Phosphor-.*\.woff2$/.test(url))).toBe(true);
});

test('a confirmation is a dialog: it opens, Escape closes it, focus returns to the trigger', async ({
  page,
}) => {
  /** @type {string[]} */
  const browserDialogs = [];
  page.on('dialog', (dialog) => {
    browserDialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const { errors } = await openApp(page, { clock: true });
  await page.getByRole('button', { name: 'Todos' }).click();
  const main = page.getByRole('main');
  await main.getByPlaceholder("Qu'est-ce qu'il faut faire ?").fill('Envoyer la facture');
  await main.getByRole('button', { name: 'Ajouter' }).click();
  await expect(main.getByText('Envoyer la facture')).toBeVisible();

  const trigger = main.getByRole('button', { name: 'Effacer', exact: true });
  await trigger.click();
  const confirmation = page.getByRole('dialog', { name: 'Effacer la tâche ?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText('« Envoyer la facture » sera effacée.')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(main.getByText('Envoyer la facture')).toBeVisible();

  // Confirming does delete it.
  await trigger.click();
  await page
    .getByRole('dialog', { name: 'Effacer la tâche ?' })
    .getByRole('button', { name: 'Effacer la tâche' })
    .click();
  await expect(main.getByText('Envoyer la facture')).toHaveCount(0);

  expect(browserDialogs).toEqual([]);
  expect(errors).toEqual([]);
});

test('deleting a project asks inside the same dialog, and cancelling comes back to the form', async ({
  page,
}) => {
  /** @type {string[]} */
  const browserDialogs = [];
  page.on('dialog', (dialog) => {
    browserDialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const { errors } = await openApp(page, { clock: true });
  await createProject(page, 'Alpha');
  await page.getByRole('button', { name: 'Projets' }).click();
  const main = page.getByRole('main');
  const trigger = main.getByRole('button', { name: 'Modifier', exact: true });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Modifier le projet' });
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  // One dialog only: the question replaces the form (modals are never stacked).
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const question = page.getByRole('dialog', { name: 'Supprimer le projet « Alpha » ?' });
  await expect(question).toBeVisible();
  await question.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog', { name: 'Modifier le projet' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nom du projet' })).toHaveValue('Alpha');

  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(main.getByText('Alpha')).toBeVisible();

  await trigger.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('button', { name: 'Supprimer le projet' }).click();
  await expect(main.getByText('Aucun projet actif.')).toBeVisible();

  expect(browserDialogs).toEqual([]);
  expect(errors).toEqual([]);
});

test('an end before the start is an error next to the field, not a browser alert', async ({
  page,
}) => {
  /** @type {string[]} */
  const browserDialogs = [];
  page.on('dialog', (dialog) => {
    browserDialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const { errors } = await openApp(page, { clock: true });
  await createProject(page, 'Alpha');
  await page.getByRole('main').getByRole('button', { name: 'Nouvelle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un chrono' });
  await dialog.getByRole('radio', { name: 'Saisir manuellement' }).check();
  await dialog.getByLabel('Début').fill('2026-11-18T09:00');
  await dialog.getByLabel('Fin').fill('2026-11-18T08:00');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(dialog.getByLabel('Fin')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toContainText('La fin est avant le début.');
  await expect(dialog.getByLabel('Fin')).toBeFocused();
  expect(browserDialogs).toEqual([]);
  expect(errors).toEqual([]);
});

test('no text is smaller than 12 px on the main views and dialogs', async ({ page }) => {
  await openApp(page, { demo: true, clock: true });

  /** @type {Record<string, string[]>} */
  const tooSmall = {};
  await visitScreens(page, async (label) => {
    tooSmall[label] = await page.evaluate(() => {
      /** @type {string[]} */
      const found = [];
      for (const element of document.querySelectorAll('body *')) {
        const hasText = [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
        );
        if (!hasText) continue;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const size = parseFloat(style.fontSize);
        if (size < 12) {
          found.push(`${element.tagName.toLowerCase()}.${element.className} ${size}px`);
        }
      }
      return found;
    });
  });

  expect(tooSmall).toEqual(Object.fromEntries(Object.keys(tooSmall).map((key) => [key, []])));
  expect(Object.keys(tooSmall)).toHaveLength(VIEWS.length + 2);
});

test('the dark theme renders every view and dialog without an error', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('chrono-theme', 'dark'));
  const { errors } = await openApp(page, { demo: true, clock: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await visitScreens(page, async () => {
    // Dark colours are really applied: the page ground is the dark `--cv-bg`.
    const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(ground).toBe('rgb(21, 23, 28)');
  });
  expect(errors).toEqual([]);
});

test('theme-init: the stored theme wins, otherwise the system preference decides', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.evaluate(() => localStorage.setItem('chrono-theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.evaluate(() => localStorage.removeItem('chrono-theme'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('theme-init: the stored text size scales the whole interface (rem, never px)', async ({
  page,
}) => {
  await openApp(page);
  const rootSize = () =>
    page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(await rootSize()).toBe(16);

  await page.evaluate(() => localStorage.setItem('chrono-text-size', 'large'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  expect(await rootSize()).toBe(20);
  // A control grows with it: the 32 px button is 40 px.
  const button = page.getByRole('button', { name: 'Pointer arrivée' });
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(35);
});
