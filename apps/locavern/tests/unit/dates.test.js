import { describe, it, expect } from 'vitest';
import {
  addMonthsClamped,
  buildMonthCalendarGrid,
  buildWeekCalendarGrid,
  classifyDueDateUrgency,
  computeNextRecurrenceDueDate,
  diffIsoDays,
  formatFullDateFr,
  formatMonthYearLabel,
  formatShortDateFr,
  getIsoWeekdayMon0,
  getWeekStartIsoDate,
  isOffHoursDueTime,
  isOffHoursHour,
  isWeekendIsoDate,
  isWeekendWeekdayIndex,
  parseIsoDate,
  parseTimeHhMm,
  shiftIsoDate,
} from '../../src/core/dates.js';

describe('dates', () => {
  it('valide et analyse strictement les dates ISO YYYY-MM-DD', () => {
    expect(parseIsoDate('2026-11-15')).toEqual({ year: 2026, month: 11, day: 15 });
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseIsoDate('2025-02-29')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });

  it('décale les dates sans dérive de fuseau horaire (changement d’heure, fin d’année, bissextile)', () => {
    // Passages heure d'hiver / été Europe
    expect(shiftIsoDate('2026-03-29', 1)).toBe('2026-03-30');
    expect(shiftIsoDate('2026-10-25', 1)).toBe('2026-10-26');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftIsoDate('2026-11-15', -7)).toBe('2026-11-08');
    expect(diffIsoDays('2026-11-15', '2026-11-22')).toBe(7);
  });

  it('ajoute des mois en bornant le jour à la longueur du mois cible', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('calcule la prochaine échéance récurrente (quotidienne, hebdomadaire, mensuelle)', () => {
    expect(computeNextRecurrenceDueDate('2026-11-15', 'daily', '2026-11-10')).toBe('2026-11-16');
    expect(computeNextRecurrenceDueDate('2026-11-15', 'weekly', '2026-11-10')).toBe('2026-11-22');
    expect(computeNextRecurrenceDueDate('2026-01-31', 'monthly', '2026-01-10')).toBe('2026-02-28');
    expect(computeNextRecurrenceDueDate('2024-01-31', 'monthly', '2024-01-10')).toBe('2024-02-29');
    expect(computeNextRecurrenceDueDate(null, 'daily', '2026-11-15')).toBe('2026-11-16');
    expect(computeNextRecurrenceDueDate(null, 'weekly', '2026-11-15')).toBe('2026-11-22');
    expect(computeNextRecurrenceDueDate('invalid', 'monthly', '2026-11-15')).toBe('2026-12-15');
  });

  it('construit la grille mensuelle et hebdomadaire du lundi au dimanche', () => {
    // 2026-11-15 est un dimanche -> weekday Mon0 = 6, début de semaine = 2026-11-09
    expect(getIsoWeekdayMon0('2026-11-15')).toBe(6);
    expect(getWeekStartIsoDate('2026-11-15')).toBe('2026-11-09');

    const week = buildWeekCalendarGrid('2026-11-15');
    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe('2026-11-09');
    expect(week[6]?.date).toBe('2026-11-15');

    // Novembre 2026 commence un dimanche (6 jours avant : 26..31 oct) et a 30 jours + 6 = 36 -> 42 cases (6 semaines)
    const novGrid = buildMonthCalendarGrid(2026, 11);
    expect(novGrid).toHaveLength(42);
    expect(novGrid[0]?.date).toBe('2026-10-26');
    expect(novGrid[0]?.inCurrentMonth).toBe(false);
    expect(novGrid[6]?.date).toBe('2026-11-01');
    expect(novGrid[6]?.inCurrentMonth).toBe(true);
    expect(novGrid[35]?.date).toBe('2026-11-30');
    expect(novGrid[35]?.inCurrentMonth).toBe(true);

    expect(formatMonthYearLabel(2026, 11)).toBe('Novembre 2026');
    expect(formatShortDateFr('2026-11-15', true)).toBe('15 nov. 2026');
  });

  it('classe l’urgence des échéances et formate la date complète', () => {
    expect(classifyDueDateUrgency('2026-11-14', '2026-11-15', 'todo')).toBe('overdue');
    expect(classifyDueDateUrgency('2026-11-15', '2026-11-15', 'in_progress')).toBe('today');
    expect(classifyDueDateUrgency('2026-11-21', '2026-11-15', 'todo')).toBe('this_week');
    expect(classifyDueDateUrgency('2026-11-25', '2026-11-15', 'todo')).toBe('later');
    expect(classifyDueDateUrgency('2026-11-10', '2026-11-15', 'done')).toBeNull();
    expect(classifyDueDateUrgency(null, '2026-11-15', 'todo')).toBeNull();
    expect(formatFullDateFr('2026-11-15')).toBe('Dimanche 15 novembre 2026');
  });

  it('valide les heures HH:MM, identifie le week-end (Sam/Dim) et le créneau 18h–7h', () => {
    expect(parseTimeHhMm('07:00')).toEqual({ hour: 7, minute: 0, normalized: '07:00' });
    expect(parseTimeHhMm('23:59')).toEqual({ hour: 23, minute: 59, normalized: '23:59' });
    expect(parseTimeHhMm('24:00')).toBeNull();
    expect(parseTimeHhMm('12:60')).toBeNull();
    expect(parseTimeHhMm(null)).toBeNull();

    // Créneau 18h–7h : 18:00..23:59 et 00:00..06:59
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

    // Week-end (Samedi=5, Dimanche=6)
    expect(isWeekendWeekdayIndex(4)).toBe(false);
    expect(isWeekendWeekdayIndex(5)).toBe(true);
    expect(isWeekendWeekdayIndex(6)).toBe(true);
    expect(isWeekendIsoDate('2026-11-13')).toBe(false); // Vendredi
    expect(isWeekendIsoDate('2026-11-14')).toBe(true); // Samedi
    expect(isWeekendIsoDate('2026-11-15')).toBe(true); // Dimanche

    const week = buildWeekCalendarGrid('2026-11-15');
    expect(week.map((c) => c.isWeekend)).toEqual([false, false, false, false, false, true, true]);
    const novGrid = buildMonthCalendarGrid(2026, 11);
    expect(novGrid[5]?.isWeekend).toBe(true); // Samedi 31 oct
    expect(novGrid[6]?.isWeekend).toBe(true); // Dimanche 1 nov
    expect(novGrid[7]?.isWeekend).toBe(false); // Lundi 2 nov

    // Statut terminal personnalisé supprime la classification d’urgence
    expect(classifyDueDateUrgency('2026-11-10', '2026-11-15', 'validated', true)).toBeNull();
  });
});
