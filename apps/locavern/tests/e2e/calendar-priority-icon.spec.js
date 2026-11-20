import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';

// A calendar card shows its priority by an icon next to the title (a shape, so the colour is not
// the only cue), with a tooltip for the pointer; the word stays in the card's accessible name.
// The stripe is measured in covenant-colors.spec.js, together with the icon colours.

const PRIORITIES = [
  ['high', 'ph-arrow-up', 'Priorité haute', 'Haute'],
  ['medium', 'ph-equals', 'Priorité moyenne', 'Moyenne'],
  ['low', 'ph-arrow-down', 'Priorité basse', 'Basse'],
];

/** @param {import('@playwright/test').Page} page */
async function seed(page) {
  // Fixed day: the week shown (Mon 16 to Sun 22 Nov 2026) and the month grid depend on it.
  await page.clock.install({ time: new Date('2026-11-20T12:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Créer un projet' }).click();
  await page.locator('#project-name-input').fill('Icônes');
  await page.locator('#modal-project button[type="submit"]').click();
  for (const [priority, , , title] of PRIORITIES) {
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill(title ?? '');
    await page.locator('#task-priority-select').selectOption(priority ?? 'medium');
    await page.locator('#task-due-input').fill('2026-11-18');
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.locator('#drawer-task')).toBeHidden();
  }
  await page.locator('[data-nav-view="calendar"]').click();
}

for (const mode of ['week', 'month']) {
  test(`calendar ${mode} view: each priority has its own icon next to the title, with a tooltip`, async ({
    page,
  }) => {
    await seed(page);
    await page.locator(`input[name="calendar-view-mode"][value="${mode}"]`).check();
    const cards = page.locator('.lc-cal-task');
    await expect(cards).toHaveCount(3);

    for (const [priority, iconClass, , title] of PRIORITIES) {
      const card = page.locator(`.lc-cal-task--${priority}`);
      const row = card.locator('.lc-cal-task__title-row');
      await expect(row.locator('.lc-cal-task__title')).toHaveText(title ?? '');
      const mark = row.locator('.lc-cal-task__prio');
      // The shape is specific to the priority; the other two icons are not there.
      await expect(mark.locator(`i.${iconClass}`)).toHaveCount(1);
      await expect(mark.locator('i.ph-bold')).toHaveCount(1);
      await expect(mark).toHaveAttribute('aria-hidden', 'true');
      // Next to the title, on its first line, left of it.
      const [markBox, titleBox] = await Promise.all([
        mark.boundingBox(),
        row.locator('.lc-cal-task__title').boundingBox(),
      ]);
      expect(markBox && titleBox && markBox.x + markBox.width <= titleBox.x + 1).toBe(true);
      expect(markBox && titleBox && Math.abs(markBox.y - titleBox.y) < 4).toBe(true);
      // Not a tab stop: the card's button is the only focusable element of the title row.
      await expect(mark).not.toHaveAttribute('tabindex', /.*/);
      await expect(mark.locator('[tabindex]')).toHaveCount(0);
      // The accessible name of the card still carries the word.
      await expect(card.locator('.lc-cal-task__btn')).toHaveAttribute(
        'aria-label',
        new RegExp(`Priorité ${title}`),
      );
    }
    await expect(page.locator('.lc-cal-task__prio i')).toHaveCount(3);

    for (const [priority, , tooltip] of PRIORITIES) {
      const mark = page.locator(`.lc-cal-task--${priority} .lc-cal-task__prio`);
      await page.mouse.move(0, 0);
      await expect(page.locator('.lc-tooltip:popover-open')).toHaveCount(0);
      await mark.hover();
      const tip = page.locator('.lc-tooltip:popover-open');
      await expect(tip).toHaveCount(1);
      await expect(tip).toHaveText(tooltip ?? '');
    }

    // Keyboard: the card's button is reached by Tab, the icon never is, and Enter still opens it.
    await page.mouse.move(0, 0);
    const first = page.locator('.lc-cal-task--high .lc-cal-task__btn');
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#drawer-task')).toBeVisible();
    await page.keyboard.press('Escape');

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.locator('#theme-switch').click();
      await expectNoA11yViolations(page);
    }
  });
}
