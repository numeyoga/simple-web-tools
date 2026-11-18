import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** @param {Date} d */
function toIsoLocal(d) {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Vue Calendrier mensuelle & hebdomadaire (Todos 5 & 15)', () => {
  test('affiche échéances en mois/semaine, reporte par glisser-déposer et clavier, exporte en .ics, WCAG 2.2 AA', async ({
    page,
  }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day10Iso = toIsoLocal(new Date(year, month, 10));
    const day12Iso = toIsoLocal(new Date(year, month, 12));
    const day13Iso = toIsoLocal(new Date(year, month, 13));
    const day20Iso = toIsoLocal(new Date(year, month, 20));

    await page.goto('/');

    // Créer un projet et une tâche datée au 10 du mois courant
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Calendrier Projet');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Livraison Jalons');
    await page.locator('#task-due-input').fill(day10Iso);
    await page.locator('#drawer-task button[type="submit"]').click();

    // Aller sur la vue Calendrier
    await page.locator('[data-nav-view="calendar"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Calendrier');

    const day10Cell = page.locator(`[data-cal-date="${day10Iso}"]`);
    const day12Cell = page.locator(`[data-cal-date="${day12Iso}"]`);
    await expect(day10Cell).toContainText('Livraison Jalons');

    // Accessibilité en thème clair (vue Mois)
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    // Glisser-déposer de day10Iso vers day12Iso
    const draggableTask = day10Cell.locator('.lc-cal-task').first();
    await draggableTask.dragTo(day12Cell);
    await expect(day12Cell).toContainText('Livraison Jalons');
    await expect(day10Cell).not.toContainText('Livraison Jalons');

    // Report au clavier avec Shift+ArrowRight (+1 jour -> day13Iso) en conservant le focus
    const openTaskBtn = day12Cell.locator('.lc-cal-task__btn').first();
    await openTaskBtn.focus();
    await page.keyboard.press('Shift+ArrowRight');
    const day13Cell = page.locator(`[data-cal-date="${day13Iso}"]`);
    await expect(day13Cell).toContainText('Livraison Jalons');
    await expect(day13Cell.locator('.lc-cal-task__btn').first()).toBeFocused();

    // Report avec Shift+ArrowDown (+7 jours -> day20Iso)
    await page.keyboard.press('Shift+ArrowDown');
    const day20Cell = page.locator(`[data-cal-date="${day20Iso}"]`);
    await expect(day20Cell).toContainText('Livraison Jalons');

    // Export iCalendar (.ics) des tâches datées
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-cal-export-ics').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^locavern-.*\.ics$/);
    const icsStream = await download.createReadStream();
    /** @type {string[]} */
    const icsChunks = [];
    for await (const chunk of icsStream) {
      icsChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    const icsText = icsChunks.join('');
    expect(icsText).toContain('BEGIN:VCALENDAR');
    expect(icsText).toContain('BEGIN:VEVENT');
    expect(icsText).toContain(`DTSTART;VALUE=DATE:${day20Iso.replace(/-/g, '')}`);
    expect(icsText).toContain('SUMMARY:Livraison Jalons');
    expect(icsText).toContain('END:VCALENDAR');

    // Basculer en vue Semaine et vérifier la présence de la tâche
    await page.locator('input[name="calendar-view-mode"][value="week"]').check();
    await expect(page.locator(`[data-cal-date="${day20Iso}"]`)).toContainText('Livraison Jalons');

    // Thème sombre + audit axe-core
    await page.locator('#theme-switch').click();
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Persistance après rechargement
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Calendrier');
    await expect(page.locator(`[data-cal-date="${day20Iso}"]`)).toContainText('Livraison Jalons');

    // Vérifier reflow 320 px sans débordement horizontal
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
  });

  test('différencie samedis/dimanches et créneau 18h–7h distinctement, planifie à l’heure et respecte WCAG 2.2 AA', async ({
    page,
  }) => {
    const now = new Date();
    const todayIso = toIsoLocal(now);

    await page.goto('/');
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Astreintes & Week-end');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('[data-nav-view="calendar"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Calendrier');

    // Vérifier la légende et la différenciation des samedis & dimanches en vue Mois
    await expect(page.locator('.lc-cal-legend')).toContainText('Samedi & dimanche');
    await expect(page.locator('.lc-cal-legend')).toContainText('Créneau 18h–7h');
    const weekendCells = page.locator('.lc-cal-cell[data-cal-weekend="true"]');
    const weekdayCells = page.locator(
      '.lc-cal-cell:not([data-cal-weekend="true"]):not(.is-today):not(.is-outside-month)',
    );
    expect(await weekendCells.count()).toBeGreaterThanOrEqual(8);
    await expect(weekendCells.first()).toContainText('Week-end');

    const weekendStyle = await weekendCells.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderTop: s.borderTopColor };
    });
    const weekdayStyle = await weekdayCells.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderTop: s.borderTopColor };
    });
    expect(weekendStyle.bg).not.toBe(weekdayStyle.bg);
    expect(weekendStyle.borderTop).not.toBe(weekdayStyle.borderTop);

    // Basculer en vue Semaine : créneaux 00..23 et zone "Sans heure"
    await page.locator('input[name="calendar-view-mode"][value="week"]').check();
    const todayCell = page.locator(`[data-cal-date="${todayIso}"]`);
    await expect(todayCell.locator('[data-cal-allday="true"]')).toBeVisible();
    await expect(todayCell.locator('[data-cal-hour]')).toHaveCount(24);

    // Vérifier que 18h–7h (ex: 21h) est stylé différemment des heures ouvrées (ex: 10h) ET du week-end
    const slot21 = todayCell.locator('[data-cal-hour="21"]');
    const slot10 = todayCell.locator('[data-cal-hour="10"]');
    await expect(slot21).toHaveAttribute('data-cal-offhours', 'true');
    await expect(slot10).toHaveAttribute('data-cal-offhours', 'false');
    await expect(todayCell.locator('[data-cal-hour="06"]')).toHaveAttribute(
      'data-cal-offhours',
      'true',
    );
    await expect(todayCell.locator('[data-cal-hour="07"]')).toHaveAttribute(
      'data-cal-offhours',
      'false',
    );
    await expect(todayCell.locator('[data-cal-hour="18"]')).toHaveAttribute(
      'data-cal-offhours',
      'true',
    );

    const offHoursStyle = await slot21.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderLeft: s.borderLeftColor };
    });
    const daytimeStyle = await slot10.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, borderLeft: s.borderLeftColor };
    });
    expect(offHoursStyle.bg).not.toBe(daytimeStyle.bg);
    expect(offHoursStyle.bg).not.toBe(weekendStyle.bg);

    // Créer une tâche dans le créneau de 21:00 puis ajuster à 21:30 dans le tiroir
    await slot21.locator('.lc-cal-slot__add').click();
    await expect(page.locator('#drawer-task')).toBeVisible();
    await expect(page.locator('#task-due-time-input')).toHaveValue('21:00');
    await expect(page.locator('#task-due-offhours-hint')).toBeVisible();

    await page.locator('#task-title-input').fill('Déploiement nocturne');
    await page.locator('#task-due-time-input').fill('21:30');
    await page.locator('#drawer-task button[type="submit"]').click();

    await expect(slot21).toContainText('Déploiement nocturne');
    await expect(slot21).toContainText('21:30');
    await expect(slot21).toContainText('18h–7h');

    // Audit axe-core vue Semaine (thème clair puis thème sombre)
    const weekLightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(weekLightAxe.violations).toEqual([]);

    await page.locator('#theme-switch').click();
    const weekDarkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(weekDarkAxe.violations).toEqual([]);

    // Persistance après rechargement et vérification reflow 320 px
    await page.reload();
    await page.locator('input[name="calendar-view-mode"][value="week"]').check();
    await expect(page.locator(`[data-cal-date="${todayIso}"] [data-cal-hour="21"]`)).toContainText(
      'Déploiement nocturne',
    );
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
  });
});
