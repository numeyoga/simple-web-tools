// The app shell (step 3, lot B): skip link, landmarks, sidebar and drawer, page title, and the
// presence and timers in the page header and in the top bar.
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';
import { expect, test } from '@playwright/test';
import { createProject, goToSection, openApp } from './support.js';

/** @typedef {import('@playwright/test').Page} Page */

const VIEWS = ['Timeline', 'Todos', 'Projets', 'Rapport'];

/**
 * A project, a running timer and an arrival: the state in which the presence and the timers show.
 * @param {Page} page
 */
async function startATimer(page) {
  await createProject(page, 'Alpha');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Pointer arrivée' }).click();
  await main
    .getByRole('region', { name: 'Chronos' })
    .getByRole('button', { name: 'Démarrer un chrono' })
    .click();
  await page
    .getByRole('dialog', { name: 'Ajouter un chrono' })
    .getByRole('button', { name: 'Démarrer', exact: true })
    .click();
  await expect(main.getByRole('region', { name: 'Chronos' }).getByText('En cours')).toBeVisible();
}

test.describe('skip link and landmarks', () => {
  test('the skip link is the first stop and moves focus to the main region', async ({ page }) => {
    const { errors } = await openApp(page);
    const skip = page.getByRole('link', { name: 'Aller au contenu' });

    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');

    await expect(page.locator('main#shell-main')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('one banner, one navigation and one main region', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('navigation')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
  });
});

test.describe('sidebar', () => {
  test('the four sections are visible without scrolling at 1280 × 720, with timers running', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const { errors } = await openApp(page, { clock: true });
    await startATimer(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });

    for (const view of VIEWS) {
      await expect(nav.getByRole('button', { name: view, exact: true })).toBeInViewport({
        ratio: 1,
      });
    }
    // The current section follows the navigation, on the button and nowhere else (the app
    // switcher has its own current link, checked in its own test).
    for (const view of VIEWS) {
      await nav.getByRole('button', { name: view, exact: true }).click();
      await expect(nav.getByRole('button', { name: view, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(nav.locator('button[aria-current="page"]')).toHaveCount(1);
    }
    // The sidebar holds navigation only: no timer, no presence.
    await expect(nav.getByText('Aucun chrono actif')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: /Pause|Reprendre|Arrêter/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the sidebar shows the brand first and the app switcher last', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const { errors } = await openApp(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });

    const brand = nav.locator('.cv-sidebar__brand');
    await expect(brand).toHaveText('Chrono');
    await expect(brand.locator('i[aria-hidden="true"]')).toHaveCount(1);
    await expect(nav.locator(':scope > :first-child')).toHaveClass(/cv-sidebar__brand/);

    // The switcher is the last child, a list of the five apps, Chrono being the current one.
    await expect(nav.locator(':scope > :last-child')).toHaveClass(/swt-switcher/);
    const switcher = nav.getByRole('list', { name: 'Applications' });
    const links = switcher.getByRole('link');
    await expect(links).toHaveText([
      'Chrono',
      'Locavern',
      'Transient Notes',
      'Favoris',
      'Dashboard',
    ]);
    await expect(links).toHaveCount(5);
    await expect(links.nth(0)).toHaveAttribute('href', './');
    await expect(links.nth(1)).toHaveAttribute('href', '../locavern/');
    await expect(links.nth(2)).toHaveAttribute('href', '../transient-notes/');
    await expect(switcher.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(links.nth(0)).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(1)).not.toHaveAttribute('aria-current', 'page');
    await expect(links.nth(2)).not.toHaveAttribute('aria-current', 'page');
    await expect(links.nth(3)).toHaveAttribute('href', '../favoris/');
    await expect(links.nth(4)).toHaveAttribute('href', '../dashboard/');
    await expect(links.nth(3)).not.toHaveAttribute('aria-current', 'page');
    expect(errors).toEqual([]);
  });

  test('below 1024 px the sidebar is a drawer: the menu button opens it, Escape closes it and focus returns', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    const { errors } = await openApp(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const menu = page.getByRole('button', { name: 'Menu' });

    await expect(nav).toBeHidden();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await menu.click();
    await expect(nav).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('button', { name: 'Timeline', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();

    // Choosing a section closes it too, and the focus goes to the content.
    await menu.click();
    await nav.getByRole('button', { name: 'Projets', exact: true }).click();
    await expect(nav).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Projets' })).toBeVisible();
    await expect(page.locator('main#shell-main')).toBeFocused();

    // A click on the scrim closes it as well.
    await menu.click();
    await expect(nav).toBeVisible();
    await page.mouse.click(780, 450);
    await expect(nav).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('widening the window closes a drawer that was left open', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openApp(page);
    await page.getByRole('button', { name: 'Menu' }).click();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeHidden();
  });
});

test.describe('reflow', () => {
  test('no horizontal page scroll at 320 px on the four views', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const { errors } = await openApp(page, { demo: true, clock: true });

    for (const view of VIEWS) {
      await goToSection(page, view);
      await expect(page.getByRole('heading', { level: 1, name: view })).toBeVisible();
      const overflow = await page.evaluate(() => {
        const root = /** @type {HTMLElement} */ (document.scrollingElement);
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
      });
      expect(overflow.scrollWidth, `${view}: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(
        overflow.clientWidth,
      );
    }
    expect(errors).toEqual([]);
  });
});

test.describe('page title', () => {
  test('every view has exactly one h1, the page title in the top bar', async ({ page }) => {
    const { errors } = await openApp(page, { demo: true, clock: true });

    for (const view of VIEWS) {
      await goToSection(page, view);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText(view);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('the storage error screen has one h1 as well', async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.open = () => {
        throw new DOMException('denied', 'SecurityError');
      };
    });
    await page.goto('/');

    await expect(page.getByTestId('storage-error')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(1);
  });
});

test.describe('presence and timers', () => {
  test('the Timeline header shows the presence and the running timers; the top bar summary is for the other views', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const { errors } = await openApp(page, { clock: true });
    await startATimer(page);
    const main = page.getByRole('main');
    const summary = page.getByRole('banner').getByRole('group', { name: 'Présence et chronos' });

    // Timeline, from 1024 px: the full cards are in the page, the summary is not shown.
    await expect(main.getByRole('region', { name: 'Présence' }).getByText('Présent')).toBeVisible();
    await expect(main.getByRole('region', { name: 'Chronos' }).getByText('Alpha')).toBeVisible();
    await expect(summary).toBeHidden();

    // Any other view: the summary shows the presence, the number of timers and the main action.
    await goToSection(page, 'Todos');
    await expect(summary.getByText('Présent')).toBeVisible();
    await expect(summary.getByText('1 chrono en cours')).toBeVisible();
    // The figure and the words are separated by a space, as text and as rendered: the tag is a
    // flex box, so a space at the start of its own item would be dropped (innerText would break
    // the line instead).
    const tag = summary.locator('.cv-tag');
    await expect(tag).toHaveText('1 chrono en cours');
    expect(await tag.evaluate((node) => /** @type {HTMLElement} */ (node).innerText)).toBe(
      '1 chrono en cours',
    );
    await summary.getByRole('button', { name: 'Tout mettre en pause' }).click();
    await expect(summary.getByText('1 chrono en pause')).toBeVisible();
    await summary.getByRole('button', { name: 'Tout reprendre' }).click();
    await expect(summary.getByText('1 chrono en cours')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('at 800 px the top bar summary works on the Timeline too, beside the full cards', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    const { errors } = await openApp(page, { clock: true });
    await startATimer(page);
    const summary = page.getByRole('banner').getByRole('group', { name: 'Présence et chronos' });
    const cards = page.getByRole('main').getByRole('region', { name: 'Chronos' });

    await expect(summary).toBeVisible();
    await expect(summary.getByText('Présent')).toBeVisible();
    await expect(summary.getByText('1 chrono en cours')).toBeVisible();
    await expect(cards.getByText('Alpha')).toBeVisible();

    await summary.getByRole('button', { name: 'Tout mettre en pause' }).click();
    await expect(summary.getByText('1 chrono en pause')).toBeVisible();
    await expect(cards.getByText('En pause')).toBeVisible();
    await summary.getByRole('button', { name: 'Tout reprendre' }).click();
    await expect(cards.getByText('En cours')).toBeVisible();

    await cards.getByRole('button', { name: 'Arrêter & enregistrer' }).click();
    await expect(summary.getByRole('button', { name: 'Nouveau chrono' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('at 390 px the summary keeps its words for assistive technology', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, { clock: true });
    await startATimer(page);
    const summary = page.getByRole('banner').getByRole('group', { name: 'Présence et chronos' });

    await expect(summary.getByText('1 chrono en cours')).toBeAttached();
    const box = await summary.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => {
      const root = /** @type {HTMLElement} */ (document.scrollingElement);
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('in a read-only tab the summary actions are disabled', async ({ context }) => {
    const writer = await context.newPage();
    await openApp(writer);
    const reader = await context.newPage();
    await openApp(reader);
    await goToSection(reader, 'Todos');

    await expect(
      reader
        .getByRole('banner')
        .getByRole('group', { name: 'Présence et chronos' })
        .getByRole('button', { name: 'Nouveau chrono' }),
    ).toBeDisabled();
    // The banner sits under the top bar, in the content.
    await expect(reader.getByTestId('read-only-banner')).toBeVisible();
    await expect(reader.getByRole('main').getByTestId('read-only-banner')).toHaveCount(1);
  });
});

test.describe('quick add targets', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the project radios are 24 px targets once the dialog has settled', async ({ page }) => {
    // The dialog enters with a scale from 0.98 in 180 ms: measured during that entrance, a 24 px
    // radio reads 23.6 to 23.9 px and the text reads a lower contrast. At rest both are fine.
    await openApp(page, { demo: true, clock: true });
    await page.getByRole('main').getByRole('button', { name: 'Nouvelle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter un chrono' });
    await expect(dialog).toBeVisible();

    const radios = dialog.getByRole('group', { name: 'Projet' }).getByRole('radio');
    expect(await radios.count()).toBeGreaterThan(2);
    for (const radio of await radios.all()) {
      const box = await radio.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(24);
      expect(box?.height).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe('accessibility of the shell (axe, WCAG 2.2 AA)', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const theme of ['light', 'dark']) {
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ]) {
      test(`skip link, navigation, top bar and preferences are clean: ${theme}, ${width} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.addInitScript((value) => localStorage.setItem('chrono-theme', value), theme);
        await openApp(page, { clock: true });

        // Skip link, once it shows on the first Tab.
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
        await expectNoA11yViolations(page, { include: ['.cv-skip-link'] });
        // The skip link covers the menu button while it has the focus: leave it first.
        await page.evaluate(() => /** @type {HTMLElement} */ (document.activeElement).blur());
        await startATimer(page);

        // Top bar, with the summary (it is hidden on the Timeline from 1024 px).
        await goToSection(page, 'Todos');
        await expectNoA11yViolations(page, { include: ['header.cv-topbar'] });

        // Navigation: the sidebar from 1024 px, the open drawer below.
        if (width < 1024) await page.getByRole('button', { name: 'Menu' }).click();
        await expect(page.getByRole('navigation')).toBeVisible();
        // The drawer has settled once its left edge is on the screen.
        await expect
          .poll(async () => (await page.getByRole('navigation').boundingBox())?.x)
          .toBe(0);
        await expectNoA11yViolations(page, { include: ['nav.cv-sidebar'] });
        if (width < 1024) await page.keyboard.press('Escape');

        // Preferences dialog.
        await page.getByRole('button', { name: 'Préférences' }).click();
        await expect(page.getByRole('dialog', { name: 'Préférences' })).toBeVisible();
        await expectNoA11yViolations(page, { include: ['dialog[open]'] });
      });
    }
  }
});
