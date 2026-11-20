// English and French interface: the language follows the browser, can be chosen in the display
// preferences, and every view reads in English. The other suites run in French
// (playwright.config.js sets the browser locale to fr-FR).
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

// Wednesday 2026-11-18, a fixed local clock: dates and relative labels do not depend on the day
// the suite runs.
const NOW = new Date(2026, 10, 18, 10, 0, 0);

/** @param {Page} page */
async function openApp(page) {
  await page.clock.setFixedTime(NOW);
  const externalRequests = /** @type {string[]} */ ([]);
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (
      !['http://127.0.0.1:4173', 'data:', 'blob:'].includes(
        url.origin === 'null' ? url.protocol : url.origin,
      )
    ) {
      externalRequests.push(req.url());
    }
  });
  await page.goto('/');
  await expect(page.locator('#topbar-title')).toBeVisible();
  return externalRequests;
}

/**
 * Creates the data of the English pass through the English interface: a project, three tasks
 * (one overdue, one due today at 2:30 PM, one in three days), a note and a whiteboard.
 * @param {Page} page
 */
async function createData(page) {
  await page.getByRole('button', { name: 'Create a project' }).click();
  await page.locator('#project-name-input').fill('Atlas');
  await page.locator('#modal-project button[type="submit"]').click();

  const tasks = [
    { title: 'Fix the critical bug', due: '2026-11-16', priority: 'high', time: '' },
    { title: 'Ship the milestone', due: '2026-11-18', priority: 'high', time: '14:30' },
    { title: 'Prepare the demo', due: '2026-11-21', priority: 'medium', time: '' },
  ];
  for (const task of tasks) {
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill(task.title);
    await page.locator('#task-priority-select').selectOption(task.priority);
    await page.locator('#task-due-input').fill(task.due);
    if (task.time) await page.locator('#task-due-time-input').fill(task.time);
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.locator('#drawer-task')).toBeHidden();
  }

  await page.locator('[data-nav-view="notes"]').click();
  await page.getByRole('button', { name: 'Create a note' }).click();
  await page.locator('#note-dialog-title-input').fill('Planning notes');
  await page.locator('#dialog-note button[type="submit"]').click();
  await expect(page.locator('#dialog-note')).toBeHidden();

  await page.locator('[data-nav-view="whiteboards"]').click();
  await page.getByRole('button', { name: 'Create a whiteboard' }).click();
  await page.locator('#whiteboard-dialog-title-input').fill('Architecture sketch');
  await page.locator('#dialog-whiteboard button[type="submit"]').click();
  await expect(page.locator('#whiteboard-title-input')).toHaveValue('Architecture sketch');
}

/** The text of a downloaded file. @param {import('@playwright/test').Download} download */
async function readDownload(download) {
  const chunks = /** @type {string[]} */ ([]);
  for await (const chunk of await download.createReadStream()) {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
  }
  return chunks.join('');
}

/** @param {Page} page @param {string} view */
async function goTo(page, view) {
  await page.locator(`[data-nav-view="${view}"]`).click();
}

/** Closes the open dialog with its close button (a first Escape only hides a tooltip). @param {Page} page */
async function closeDialog(page) {
  await page.locator('dialog[open]').getByRole('button', { name: 'Close' }).first().click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

test.describe('browser in English (en-US)', () => {
  test.use({ locale: 'en-US', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

  test('the shell, the navigation and the command palette read in English', async ({ page }) => {
    const external = await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page).toHaveTitle('Tasks · Locavern');
    await expect(page.locator('#topbar-title')).toHaveText('Tasks');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const label of [
      'Today',
      'Tasks',
      'Projects',
      'Calendar',
      'Notes',
      'Whiteboards',
      'Archive',
    ]) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
    for (const label of ['Backups', 'Trash', 'Display']) {
      await expect(nav.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(page.getByRole('switch', { name: 'Dark theme' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Backups and import/export' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Notifications' })).toBeAttached();

    // The title of the document follows the view.
    await goTo(page, 'calendar');
    await expect(page).toHaveTitle('Calendar · Locavern');
    await goTo(page, 'archives');
    await expect(page).toHaveTitle('Archive · Locavern');

    // Command palette
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('combobox', { name: 'Command or search' })).toHaveAttribute(
      'placeholder',
      'Type a command or search',
    );
    for (const option of [
      'Go to Today',
      'Go to tasks',
      'Go to whiteboards',
      'Create a task',
      'Create a note',
      'Configure the Kanban statuses',
      'Open backups',
      'Switch between light and dark theme',
    ]) {
      await expect(palette.getByRole('option', { name: option })).toBeAttached();
    }
    await palette.getByRole('combobox').fill('zzzz');
    await expect(palette.getByText('No results.')).toBeVisible();
    await page.keyboard.press('Escape');

    expect(external).toEqual([]);
  });

  test('Today, tasks, Kanban, calendar, notes and whiteboards read in English', async ({
    page,
  }) => {
    await openApp(page);
    await createData(page);

    // Today: dates in the words and the formats of English (US), the 12-hour clock.
    await goTo(page, 'today');
    await expect(page.locator('#topbar-title')).toHaveText('Today');
    await expect(page.getByText('Wednesday, November 18, 2026')).toBeVisible();
    await expect(page.locator('#today-stat-overdue')).toContainText('Overdue');
    await expect(page.locator('#today-stat-due-today')).toContainText('Due today');
    await expect(page.locator('#today-stat-upcoming')).toContainText('Within 7 days');
    await expect(page.locator('#today-stat-high-prio')).toContainText('High priorities');
    await expect(page.locator('#today-overdue-section')).toContainText('2 days overdue (Nov 16)');
    await expect(page.locator('#today-upcoming-section')).toContainText('Upcoming due dates');
    await expect(page.locator('#today-upcoming-section')).toContainText('2:30 PM');
    await expect(page.locator('#today-recent-section')).toContainText('Recent items');
    await expect(page.locator('#today-recent-section')).toContainText('Whiteboard');
    await expect(
      page
        .locator('#today-overdue-section')
        .getByRole('button', { name: 'Mark “Fix the critical bug” as done' }),
    ).toBeVisible();
    await expectNoA11yViolations(page);

    // Tasks: list
    await goTo(page, 'tasks');
    await expect(page.getByLabel('Quick add a task', { exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Due date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Priority' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Ship the milestone/ })).toContainText('2:30 PM');
    await expect(page.getByRole('button', { name: 'Edit “Ship the milestone”' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete “Ship the milestone”' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveAccessibleName(
      /^Tasks — Atlas \(3\)$|^All tasks \(3\)$/,
    );
    await expectNoA11yViolations(page);

    // Task drawer: view and edit
    await page.getByRole('button', { name: 'View “Ship the milestone”' }).click();
    const drawer = page.locator('#drawer-task');
    await expect(drawer.getByRole('heading', { name: 'View task' })).toBeVisible();
    await expect(drawer).toContainText('Nov 18, 2026 at 2:30 PM');
    await expect(drawer).toContainText('Recurrence');
    await expectNoA11yViolations(page);
    await drawer.getByRole('button', { name: 'Edit' }).click();
    await expect(drawer.getByRole('heading', { name: 'Edit task' })).toBeVisible();
    await expect(drawer.getByLabel('Due time')).toHaveValue('14:30');
    await expect(drawer.getByText('Daily')).toBeAttached();
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');

    // Kanban
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    for (const status of ['To do', 'In progress', 'Done']) {
      await expect(page.locator('.lc-kanban')).toContainText(status);
    }
    await expect(page.getByRole('button', { name: 'Add a task to To do' })).toBeVisible();
    await expect(page.locator('.lc-kanban')).toContainText('2026-11-18 · 2:30 PM');
    await expect(page.getByText('Drag and drop a card')).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByRole('button', { name: 'Actions for “Ship the milestone”' }).click();
    await expect(page.getByRole('menuitem', { name: 'Move to In progress' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Calendar: month grid, weekdays from Monday, week view with the 12-hour clock
    await goTo(page, 'calendar');
    await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
    const weekdays = page.locator('.lc-cal-weekdays .lc-cal-weekday');
    await expect(weekdays).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Export dated tasks as an iCalendar file (.ics)' }),
    ).toBeVisible();
    await expect(page.getByText('Saturday & Sunday (weekend)')).toBeVisible();
    await expect(page.locator('[data-cal-date="2026-11-18"]')).toHaveAttribute(
      'aria-label',
      'Nov 18, 2026',
    );
    await expectNoA11yViolations(page);
    await page.locator('input[name="calendar-view-mode"][value="week"]').check();
    await expect(
      page.getByRole('heading', { name: /^Week of Nov 16 to Nov 22, 2026$/ }),
    ).toBeVisible();
    await expect(
      page
        .locator('.lc-cal-slot__hour')
        .filter({ hasText: /^2:00 PM$/ })
        .first(),
    ).toBeAttached();
    await expect(page.getByText('No time').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Add a task on Nov 18, 2026 at 2:00 PM$/ }),
    ).toBeAttached();
    await expectNoA11yViolations(page);

    // Notes: list, editor and the toolbar of the rich text editor
    await goTo(page, 'notes');
    await expect(page.locator('[aria-label="Notes list"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit note “Planning notes”' })).toBeVisible();
    await expect(page.getByText('Updated on Nov 18, 2026')).toBeVisible();
    await page.getByRole('button', { name: 'Edit note “Planning notes”' }).click();
    const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
    for (const label of [
      'Bold',
      'Italic',
      'Strikethrough',
      'Inline code',
      'Heading 1',
      'Bulleted list',
      'Numbered list',
      'Checklist',
      'Link',
      'Insert a local image',
    ]) {
      await expect(toolbar.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(page.getByLabel('Note title')).toHaveValue('Planning notes');
    await expect(page.getByText('Note templates')).toBeVisible();
    await expectNoA11yViolations(page);

    // Whiteboards: tools and the language of the announcements
    await goTo(page, 'whiteboards');
    await expect(page.getByRole('heading', { name: 'Architecture sketch' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Edit whiteboard “Architecture sketch”' }).click();
    const tools = page
      .getByRole('toolbar', { name: 'Whiteboard tools' })
      .or(page.locator('[aria-label="Whiteboard tools"]'));
    await expect(tools.first()).toBeVisible();
    for (const label of [
      'Select',
      'Select by area',
      'Sticky note',
      'Rectangle',
      'Ellipse',
      'Arrow',
      'Text',
      'Freehand drawing',
    ]) {
      await expect(page.locator(`[aria-label="${label}"]`).first()).toBeAttached();
    }
    await page.locator('[data-wb-tool="sticky"]').click();
    await page.locator('[data-wb-action="add-center"]').click();
    await expect(page.locator('.lc-wb-el[data-el-type="sticky"]').first()).toContainText(
      'Sticky note',
    );
    await expect(page.locator('[data-wb-action="zoom-in"]')).toHaveAccessibleName('Zoom in');
    await expect(page.locator('[data-wb-action="zoom-reset"]')).toHaveAccessibleName(
      'Reset zoom to 100%',
    );
    await expect(page.locator('[data-wb-action="zoom-reset"]')).toHaveText('100%');
    await expectNoA11yViolations(page);
  });

  test('the dialogs: backups, trash, statuses and display preferences', async ({ page }) => {
    await openApp(page);

    // Backups and storage
    await page.getByRole('button', { name: 'Backups and import/export' }).click();
    const backup = page.getByRole('dialog', { name: 'Backups and storage' });
    await expect(backup).toBeVisible();
    for (const heading of [
      'Local storage status',
      'Export folder',
      'Export an archive',
      'Import an archive',
      'Local reset',
    ]) {
      await expect(backup.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expect(backup.getByText('Last ZIP backup')).toBeVisible();
    await expect(backup.locator('#stat-last-backup-age')).toHaveText('No ZIP backup yet');
    await expect(backup.getByText('Space used')).toBeVisible();
    await expect(
      backup
        .locator('.lc-stat__value')
        .filter({ hasText: /(?:KiB|MiB|\d B)$/ })
        .first(),
    ).toBeVisible();
    await expect(backup.getByText('Protect the archive with a password (AES-GCM)')).toBeVisible();
    await expect(backup.getByRole('button', { name: 'Export ZIP archive' })).toBeVisible();
    await expect(backup.getByLabel('Backup file (.zip)')).toBeVisible();
    await expect(backup.getByRole('button', { name: 'Erase all local data' })).toBeVisible();
    await backup.getByText('Protect the archive with a password (AES-GCM)').click();
    await backup.getByRole('button', { name: 'Export ZIP archive' }).click();
    await expect(backup.getByText('Enter a password to encrypt the archive.')).toBeVisible();
    await expectNoA11yViolations(page);
    await closeDialog(page);

    // Trash
    await page.getByRole('button', { name: 'Trash' }).first().click();
    const trash = page.getByRole('dialog', { name: 'Local trash' });
    await expect(trash.getByText('The trash is empty')).toBeVisible();
    await expect(trash.getByText('Retention set to 30 days before permanent purge.')).toBeVisible();
    await expect(trash.getByRole('button', { name: 'Empty trash' })).toBeDisabled();
    await expectNoA11yViolations(page);
    await closeDialog(page);

    // Kanban statuses: the default ones are created in English
    await page.keyboard.press('Control+k');
    await page.getByRole('option', { name: 'Configure the Kanban statuses' }).click();
    const statuses = page.getByRole('dialog', { name: 'Kanban statuses' });
    await expect(statuses.getByLabel('Status label 1')).toHaveValue('To do');
    await expect(statuses.getByLabel('Status label 2')).toHaveValue('In progress');
    await expect(statuses.getByLabel('Status label 3')).toHaveValue('Done');
    await expect(statuses.getByLabel('Status role 3')).toBeVisible();
    await expect(statuses.getByRole('button', { name: 'Restore defaults' })).toBeVisible();
    await expectNoA11yViolations(page);
    await closeDialog(page);

    // Display preferences
    await page.getByRole('button', { name: 'Display' }).click();
    const prefs = page.getByRole('dialog', { name: 'Display preferences' });
    await expect(prefs.getByLabel('Language / Langue')).toHaveValue('auto');
    await expect(prefs.getByRole('radio', { name: 'Comfortable' })).toBeAttached();
    await expect(prefs.getByLabel('Notification duration (seconds)')).toHaveValue('6');
    await expect(prefs.getByLabel('Trash retention (days)')).toHaveValue('30');
    await expect(prefs.getByText('Side drawer').first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('a toast, its region and its dismiss button are named in English', async ({ page }) => {
    await openApp(page);
    await createData(page);
    await goTo(page, 'today');
    await page
      .locator('#today-overdue-section')
      .getByRole('button', { name: 'Mark “Fix the critical bug” as done' })
      .click();
    await expect(page.getByText('Task completed')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss notification' }).first()).toBeVisible();
  });

  test('the exports: iCalendar, Markdown and ZIP names and labels are English', async ({
    page,
  }) => {
    await openApp(page);
    await createData(page);
    await goTo(page, 'calendar');
    await page.getByLabel('Filter the calendar by project').selectOption({ label: 'All projects' });

    const ics = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Export dated tasks as an iCalendar file (.ics)' })
      .click();
    const icsFile = await ics;
    expect(icsFile.suggestedFilename()).toBe('locavern-due-dates-2026-11-18.ics');
    const icsText = await readDownload(icsFile);
    expect(icsText).toContain('X-WR-CALNAME:Locavern — Due dates');
    expect(icsText).toContain('DESCRIPTION:Project: Atlas · Status: To do · Priority: High');
    // The protocol fields are the same as in French.
    expect(icsText).toContain('PRODID:-//Locavern//Locavern PWA//FR');
    expect(icsText).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n');
    expect(icsText).toContain('STATUS:TENTATIVE');
    await expect(page.getByText('iCalendar export complete')).toBeVisible();

    await goTo(page, 'notes');
    const md = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export .Planning notes. to Markdown/ }).click();
    const mdFile = await md;
    expect(mdFile.suggestedFilename()).toBe('planning-notes.md');
    const mdText = await readDownload(mdFile);
    expect(mdText).toContain('# Planning notes');
    expect(mdText).toContain('> Project: Atlas · Updated: 2026-11-18');

    await page.getByRole('button', { name: 'Backups and import/export' }).click();
    const zip = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export ZIP archive' }).click();
    expect((await zip).suggestedFilename()).toBe('locavern-backup-2026-11-18.zip');
    await expect(page.getByText('Archive exported')).toBeVisible();
    await expect(
      page.getByText(/1 project, 3 tasks, 1 note, and 1 whiteboard included\./),
    ).toBeVisible();
    await expect(page.locator('#stat-last-backup-age')).toHaveText('Just now');
  });

  for (const theme of ['light', 'dark']) {
    test(`axe, WCAG 2.2 AA: English interface, ${theme}`, async ({ page }) => {
      await page.addInitScript(
        (value) => localStorage.setItem('locavern-color-scheme', value),
        theme,
      );
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const view of [
        'today',
        'tasks',
        'projects',
        'calendar',
        'notes',
        'whiteboards',
        'archives',
      ]) {
        await goTo(page, view);
        await expectNoA11yViolations(page);
      }
      for (const dialog of ['Backups and import/export', 'Display']) {
        await page.getByRole('button', { name: dialog }).first().click();
        await expectNoA11yViolations(page);
        await closeDialog(page);
      }
    });
  }
});

test.describe('browser in British English (en-GB)', () => {
  test.use({ locale: 'en-GB', viewport: { width: 1280, height: 800 } });

  test('English text, British dates, and <html lang> keeps the region', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await createData(page);
    await goTo(page, 'today');
    await expect(page.getByText(/^Wednesday,? 18 November 2026$/)).toBeVisible();
    await expect(page.locator('#today-overdue-section')).toContainText('2 days overdue (16 Nov)');
    // A 24-hour clock in Great Britain.
    await expect(page.locator('#today-upcoming-section')).toContainText('14:30');
    await goTo(page, 'calendar');
    await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
    await expect(page.locator('[data-cal-date="2026-11-18"]')).toHaveAttribute(
      'aria-label',
      '18 Nov 2026',
    );
  });
});

test.describe('which language the browser gets', () => {
  test.describe('fr-CA', () => {
    test.use({ locale: 'fr-CA' });
    test('is French', async ({ page }) => {
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
      await expect(page.locator('#topbar-title')).toHaveText('Tâches');
      await expect(page.getByRole('button', { name: 'Créer un projet' })).toBeVisible();
    });
  });

  test.describe('de-DE', () => {
    test.use({ locale: 'de-DE' });
    test('is English, the fallback', async ({ page }) => {
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('#topbar-title')).toHaveText('Tasks');
      await expect(page.getByRole('button', { name: 'Create a project' })).toBeVisible();
    });
  });
});

test.describe('choosing the language in the display preferences', () => {
  test.use({ locale: 'en-US' });

  test('French is saved as locavern-locale, survives a reload, and automatic removes it', async ({
    page,
  }) => {
    await openApp(page);
    const stored = () => page.evaluate(() => localStorage.getItem('locavern-locale'));
    expect(await stored()).toBeNull();

    await page.getByRole('button', { name: 'Display' }).click();
    const prefs = page.getByRole('dialog', { name: 'Display preferences' });
    await prefs.getByLabel('Language / Langue').selectOption('fr');
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    expect(await stored()).toBe('fr');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    await page.getByRole('button', { name: 'Affichage' }).click();
    const again = page.getByRole('dialog', { name: 'Préférences d’affichage' });
    await expect(again.getByLabel('Langue / Language')).toHaveValue('fr');

    await again.getByLabel('Langue / Language').selectOption('auto');
    await expect(page.locator('#topbar-title')).toHaveText('Tasks');
    expect(await stored()).toBeNull();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('a saved choice wins over the browser language, and an unknown value is ignored', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('locale-set')) localStorage.setItem('locavern-locale', 'fr');
    });
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');
    await page.evaluate(() => {
      sessionStorage.setItem('locale-set', '1');
      localStorage.setItem('locavern-locale', 'de');
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.locator('#topbar-title')).toHaveText('Tasks');
  });

  test('the data of the user is never renamed: saved French statuses stay French', async ({
    page,
  }) => {
    // A workspace first used in French: its default statuses are saved with their French names.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) localStorage.setItem('locavern-locale', 'fr');
    });
    await openApp(page);
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Ancien projet');
    await page.locator('#modal-project button[type="submit"]').click();
    await goTo(page, 'calendar');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    // Then the same workspace in an English browser.
    await page.evaluate(() => {
      sessionStorage.setItem('seeded', '1');
      localStorage.removeItem('locavern-locale');
    });
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Calendar');
    await goTo(page, 'tasks');
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(page.locator('[data-kanban-status="todo"]')).toContainText('À faire');
    await expect(page.locator('[data-kanban-status="done"]')).toContainText('Terminé');
    // The project the user made is theirs too.
    await goTo(page, 'projects');
    await expect(page.getByRole('heading', { name: 'Ancien projet' })).toBeVisible();
  });
});
