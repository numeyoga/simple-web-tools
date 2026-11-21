// English and French interface: the language follows the browser, can be chosen in the
// preferences, and every text of the shell reads in the language of the page. The other suites
// run in French (playwright.config.js sets the browser locale to fr-FR).
import { readFile } from 'node:fs/promises';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import {
  PNG_BASE64,
  createNote,
  openApp,
  readStore,
  treeRowName,
  waitForStoredText,
  writeNote,
} from './support.js';

test.describe('browser in English (en-US)', () => {
  test.use({ locale: 'en-US', reducedMotion: 'reduce' });

  test('the shell, the dialogs and the notes read in English', async ({ page }) => {
    const { errors } = await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page).toHaveTitle('Transient Notes · notes sorted with PARA');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['All notes', 'Projects', 'Areas', 'Resources', 'Archives']) {
      await expect(nav.getByRole('button', { name: treeRowName(name) })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Workspace Main workspace' })).toBeVisible();
    await expect(page.getByText('No notes here yet')).toBeVisible();

    await createNote(page);
    await expect(page.getByRole('main').getByRole('button', { name: 'Untitled' })).toBeVisible();
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('3');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('General resources');

    await page.getByRole('button', { name: 'Preferences' }).click();
    const prefs = page.getByRole('dialog', { name: 'Preferences' });
    await expect(prefs.getByText('Single-key shortcuts')).toBeVisible();
    await expect(
      prefs.getByText('New note in Projects, Areas, Resources or Archives'),
    ).toBeVisible();
    await expectNoA11yViolations(page, { include: ['dialog[open]'] });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Workspace/ }).click();
    const workspaces = page.getByRole('dialog', { name: 'Workspaces' });
    await expect(workspaces.getByText('Active', { exact: true })).toBeVisible();
    await expect(workspaces.getByRole('button', { name: 'Export JSON' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the tree, the folders, the list, the editor and its dialogs read in English', async ({
    page,
  }) => {
    // A fixed local time: today's notes show their time, older ones their date.
    await page.clock.setFixedTime(new Date(2026, 10, 18, 14, 5));
    const { errors } = await openApp(page);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    // Folders: the dialogs, the default folder of a category, the menu.
    await nav.getByRole('button', { name: 'New folder' }).click();
    const created = page.getByRole('dialog', { name: 'New folder' });
    await created.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(
      created.getByText('The name is empty. Enter a name for the folder.'),
    ).toBeVisible();
    await created.getByLabel('Folder name').fill('Website');
    await created.getByLabel('Category').selectOption({ label: 'Areas' });
    await created.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Website' })).toBeVisible();
    await page.getByRole('button', { name: 'Actions for the folder “Website”' }).click();
    const menu = page.getByRole('menu', { name: 'Actions for the folder “Website”' });
    for (const item of ['Rename', 'Move to another category', 'Delete']) {
      await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
    }
    await menu.getByRole('menuitem', { name: 'Move to another category' }).click();
    await expect(page.getByRole('dialog', { name: 'Move the folder' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    // The list and the editor.
    await page.getByRole('button', { name: 'New note in Areas' }).click();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
    await expect(page.getByRole('combobox', { name: 'Folder' })).toBeVisible();
    await expect(
      page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', { name: 'Bold' }),
    ).toBeVisible();
    await writeNote(page, { title: 'Plan', body: 'First line' });
    await waitForStoredText(page, 'First line');
    const item = page.getByRole('main').getByRole('button', { name: /^Plan/ });
    await expect(item).toContainText('First line');
    await expect(item).toContainText(/2:05\s?PM/);
    await expect(page.getByText('1 note', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Edited Nov 18, 2026, 2:05\s?PM$/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toContainText('Last edited');
    await page.getByRole('searchbox', { name: 'Search notes' }).fill('zzz');
    await expect(page.getByText('No note matches')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search notes' }).fill('');

    // Another day: the list shows the date, not the time.
    await page.clock.setFixedTime(new Date(2026, 10, 20, 9, 30));
    await page.reload();
    await expect(page.getByRole('main').getByRole('button', { name: /^Plan/ })).toContainText(
      'Nov 18, 2026',
    );

    // The delete question and the refused picture.
    await page.getByRole('main').getByRole('button', { name: /^Plan/ }).click();
    await page.getByRole('button', { name: 'Delete note' }).click();
    const question = page.getByRole('dialog', { name: 'Delete this note?' });
    await expect(question).toContainText(
      'The note “Plan” and the images only it uses will be erased.',
    );
    await question.getByRole('button', { name: 'Cancel' }).click();
    await page.locator('.lc-editor input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a picture'),
    });
    await expect(page.getByText('Image not added')).toBeVisible();
    await expect(page.getByText('Only PNG, JPEG, WebP and GIF images are accepted.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the exported files carry their header in English', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 18, 14, 5));
    await openApp(page);
    await createNote(page);
    await writeNote(page, { title: 'Plan', body: 'First line' });
    await page.locator('.lc-editor input[type="file"]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });
    await expect.poll(async () => (await readStore(page, 'assets')).length).toBe(1);
    await waitForStoredText(page, 'First line');
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Export all', exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'All notes as text (.txt)' }).click();
    const file = await pending;
    const text = (await readFile(await file.path())).toString('utf8');

    expect(file.suggestedFilename()).toBe('transient-notes-default-2026-11-18.txt');
    const lines = text.split('\n');
    expect(lines[0]).toBe('TRANSIENT NOTES - Full export');
    expect(lines[1]).toMatch(/^Date: .*2026/);
    expect(lines[2]).toBe('Number of notes: 1');
    expect(text).toContain(`Plan\n${'='.repeat(50)}\n\nFirst line`);

    await page.getByRole('button', { name: 'Export note', exact: true }).click();
    const pendingMd = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'As Markdown (.md)' }).click();
    const markdown = (await readFile(await (await pendingMd).path())).toString('utf8');
    expect(markdown).toMatch(/^# Plan\n\nFirst line/);
    expect(markdown).toContain('![photo.png](local-asset://');
  });

  test('the language of the preferences can be switched to French, and back to automatic', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Preferences' }).click();

    await page.getByRole('dialog').getByLabel('Language / Langue').selectOption('fr');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toutes les notes');
    await page.getByRole('button', { name: 'Préférences' }).click();
    await page.getByRole('dialog').getByLabel('Langue / Language').selectOption('auto');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All notes');
    expect(await page.evaluate(() => localStorage.getItem('transient-notes-locale'))).toBeNull();
  });
});

test.describe('browser in a language the app does not speak', () => {
  test.use({ locale: 'de-DE' });

  test('falls back to English', async ({ page }) => {
    await openApp(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All notes');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('browser in French with a region (fr-CA)', () => {
  test.use({ locale: 'fr-CA' });

  test('reads in French and keeps the region for the dates', async ({ page }) => {
    await openApp(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toutes les notes');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
  });
});
