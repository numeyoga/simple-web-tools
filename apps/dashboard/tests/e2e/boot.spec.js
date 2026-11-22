import { expect, test } from '@playwright/test';
import { createApp, loadSample, openApp, readStore, waitForWrite } from './support.js';

test('the application starts: sidebar, one h1, an empty dashboard, the default tags, no error, no request out', async ({
  page,
}) => {
  const { errors, blockedHosts } = await openApp(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Applications');
  await expect(page).toHaveTitle('Applications · Dashboard');
  await expect(page.getByText('Aucune application pour le moment', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Espace de travail Mon dashboard' })).toBeVisible();
  // A new workspace starts with the default tags, written at the first start.
  await waitForWrite(page, 'settings', 'key', 'settings');
  expect(((await readStore(page, 'settings'))[0]?.tags ?? []).length).toBe(9);

  expect(errors).toEqual([]);
  // Fonts and icons are bundled: nothing is requested outside the app's own origin.
  expect([...new Set(blockedHosts)]).toEqual([]);
});

test('the sample is loaded from the empty state, and is still there after a reload', async ({
  page,
}) => {
  const { errors } = await openApp(page);

  await loadSample(page);

  await expect(
    page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', {
      name: 'SearchIndex',
    }),
  ).toBeVisible();
  await waitForWrite(page, 'apps', 'name', 'SearchIndex');
  expect(await readStore(page, 'templates')).toHaveLength(4);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AccountPortal');
  expect(errors).toEqual([]);
});

test('an application is created from a template, and opened', async ({ page }) => {
  const { errors } = await openApp(page);
  await loadSample(page);

  await createApp(page, { name: 'Billing Hub', template: 'batch-java', jira: 'BILL' });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Billing Hub');
  await expect(page).toHaveURL(/#\/app\//);
  await waitForWrite(page, 'apps', 'slug', 'billing-hub');
  // It opens on the last environment of its template, with its metadata still to fill in.
  await expect(page.getByRole('tab', { name: /^PROD/ })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('every name the app persists starts with the app name (all apps share one origin)', async ({
  page,
}) => {
  await openApp(page);
  await loadSample(page);
  await waitForWrite(page, 'apps', 'name', 'SearchIndex');
  await page.getByRole('button', { name: 'Préférences' }).click();
  await page.getByRole('radio', { name: 'Sombre' }).check();

  const names = await page.evaluate(async () => ({
    keys: Object.keys(localStorage),
    databases: (await indexedDB.databases()).map((d) => d.name),
  }));

  expect(names.keys.length).toBeGreaterThan(0);
  expect(names.keys.every((key) => key.startsWith('dashboard-'))).toBe(true);
  expect(names.databases).toEqual(['dashboard__default']);
});
