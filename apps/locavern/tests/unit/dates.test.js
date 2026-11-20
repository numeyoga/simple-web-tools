import { createTranslator } from '@simple-web-tools/i18n';
import { describe, it, expect } from 'vitest';
import {
  buildWeekCalendarGrid,
  classifyDueDateUrgency,
  computeNextRecurrenceDueDate,
  getTodayIsoDate,
  isOffHoursDueTime,
  isOffHoursHour,
} from '../../src/core/dates.js';
import { createFormatters } from '../../src/core/format.js';
import { catalogs } from '../../src/i18n/index.js';

// The labels of the dates are written by the formatters of the language (src/core/format.js).
const french = createFormatters(createTranslator({ locale: 'fr', catalogs }));

// Generic calendar arithmetic (parsing, shifting, grids, weekends) is tested in packages/dates.
describe('dates', () => {
  it('calcule la prochaine échéance récurrente (quotidienne, hebdomadaire, mensuelle)', () => {
    expect(computeNextRecurrenceDueDate('2026-11-15', 'daily', '2026-11-10')).toBe('2026-11-16');
    expect(computeNextRecurrenceDueDate('2026-11-15', 'weekly', '2026-11-10')).toBe('2026-11-22');
    expect(computeNextRecurrenceDueDate('2026-01-31', 'monthly', '2026-01-10')).toBe('2026-02-28');
    expect(computeNextRecurrenceDueDate('2024-01-31', 'monthly', '2024-01-10')).toBe('2024-02-29');
    expect(computeNextRecurrenceDueDate(null, 'daily', '2026-11-15')).toBe('2026-11-16');
    expect(computeNextRecurrenceDueDate(null, 'weekly', '2026-11-15')).toBe('2026-11-22');
    expect(computeNextRecurrenceDueDate('invalid', 'monthly', '2026-11-15')).toBe('2026-12-15');
  });

  it('étiquette la semaine en français et formate les libellés de date', () => {
    const week = buildWeekCalendarGrid('2026-11-15');
    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe('2026-11-09');
    expect(french.weekdayName(week[0]?.weekdayIndex ?? -1)).toBe('Lun');
    expect(french.weekdayName(week[6]?.weekdayIndex ?? -1)).toBe('Dim');
    expect(week.map((c) => c.isWeekend)).toEqual([false, false, false, false, false, true, true]);

    expect(french.formatMonthYear(2026, 11)).toBe('Novembre 2026');
    expect(french.formatShortDate('2026-11-15', true)).toBe('15 nov. 2026');
    expect(french.formatShortDate('2026-11-15')).toBe('15 nov.');
  });

  it('classe l’urgence des échéances et formate la date complète', () => {
    expect(classifyDueDateUrgency('2026-11-14', '2026-11-15', 'todo')).toBe('overdue');
    expect(classifyDueDateUrgency('2026-11-15', '2026-11-15', 'in_progress')).toBe('today');
    expect(classifyDueDateUrgency('2026-11-21', '2026-11-15', 'todo')).toBe('this_week');
    expect(classifyDueDateUrgency('2026-11-25', '2026-11-15', 'todo')).toBe('later');
    expect(classifyDueDateUrgency('2026-11-10', '2026-11-15', 'done')).toBeNull();
    expect(classifyDueDateUrgency(null, '2026-11-15', 'todo')).toBeNull();
    expect(french.formatFullDate('2026-11-15')).toBe('Dimanche 15 novembre 2026');
    // Statut terminal personnalisé supprime la classification d’urgence
    expect(classifyDueDateUrgency('2026-11-10', '2026-11-15', 'validated', true)).toBeNull();
  });

  it('identifie le créneau 18h–7h', () => {
    expect(isOffHoursHour(0)).toBe(true);
    expect(isOffHoursHour(6)).toBe(true);
    expect(isOffHoursHour(7)).toBe(false);
    expect(isOffHoursHour(17)).toBe(false);
    expect(isOffHoursHour(18)).toBe(true);
    expect(isOffHoursHour(23)).toBe(true);
    expect(isOffHoursDueTime('06:59')).toBe(true);
    expect(isOffHoursDueTime('07:00')).toBe(false);
    expect(isOffHoursDueTime('17:59')).toBe(false);
    expect(isOffHoursDueTime('18:00')).toBe(true);
    expect(isOffHoursDueTime(null)).toBe(false);
  });

  it('garde l’horloge par défaut de getTodayIsoDate côté application', () => {
    expect(getTodayIsoDate(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15');
    expect(getTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
