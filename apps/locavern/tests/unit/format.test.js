// Dates and times in English and in French, from the same calls. The French output is what the
// application always wrote: the names of the days and the months were lists in the code.
import { createTranslator } from '@simple-web-tools/i18n';
import { describe, expect, test } from 'vitest';
import { createFormatters, timeOfDayOptions } from '../../src/core/format.js';
import { catalogs } from '../../src/i18n/index.js';

/** @param {string} locale */
const formatters = (locale) => createFormatters(createTranslator({ locale, catalogs }));
const en = formatters('en-US');
const gb = formatters('en-GB');
const fr = formatters('fr');

describe('time of day', () => {
  test('a 24-hour clock writes two digits, a 12-hour clock none to the hour', () => {
    expect(timeOfDayOptions('fr')).toEqual({ hour: '2-digit', minute: '2-digit' });
    expect(timeOfDayOptions('en-GB')).toEqual({ hour: '2-digit', minute: '2-digit' });
    expect(timeOfDayOptions('en-US')).toEqual({ hour: 'numeric', minute: '2-digit' });
  });

  test('a stored HH:MM reads as 14:30 in French and 2:30 PM in English (US)', () => {
    expect(fr.formatTimeOfDay('14:30')).toBe('14:30');
    expect(fr.formatTimeOfDay('07:05')).toBe('07:05');
    expect(gb.formatTimeOfDay('07:05')).toBe('07:05');
    expect(en.formatTimeOfDay('14:30')).toMatch(/^2:30\sPM$/);
    expect(en.formatTimeOfDay('07:05')).toMatch(/^7:05\sAM$/);
    expect(en.formatTimeOfDay('00:00')).toMatch(/^12:00\sAM$/);
  });

  test('anything that is not a time is given back', () => {
    expect(fr.formatTimeOfDay('25:00')).toBe('25:00');
    expect(fr.formatTimeOfDay('')).toBe('');
    expect(fr.formatTimeOfDay(null)).toBe('');
    expect(fr.formatTimeOfDay(undefined)).toBe('');
  });
});

describe('calendar dates', () => {
  test('French dates are the ones the lists in the code used to write', () => {
    expect(fr.formatShortDate('2026-11-15')).toBe('15 nov.');
    expect(fr.formatShortDate('2026-11-15', true)).toBe('15 nov. 2026');
    expect(fr.formatFullDate('2026-11-15')).toBe('Dimanche 15 novembre 2026');
    expect(fr.formatMonthYear(2026, 11)).toBe('Novembre 2026');
  });

  test('all twelve short months and long months, as they were written in French', () => {
    const shortMonths = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août'];
    shortMonths.push('sept.', 'oct.', 'nov.', 'déc.');
    expect(
      Array.from({ length: 12 }, (_, i) =>
        fr.formatShortDate(`2026-${i + 1 < 10 ? '0' : ''}${i + 1}-09`),
      ),
    ).toEqual(shortMonths.map((month) => `9 ${month}`));
    const longMonths = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août'];
    longMonths.push('Septembre', 'Octobre', 'Novembre', 'Décembre');
    expect(Array.from({ length: 12 }, (_, i) => fr.formatMonthYear(2026, i + 1))).toEqual(
      longMonths.map((month) => `${month} 2026`),
    );
  });

  test('the seven days, in French and in English', () => {
    const days = [0, 1, 2, 3, 4, 5, 6];
    expect(days.map((i) => fr.weekdayName(i))).toEqual([
      'Lun',
      'Mar',
      'Mer',
      'Jeu',
      'Ven',
      'Sam',
      'Dim',
    ]);
    expect(days.map((i) => en.weekdayName(i))).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(fr.weekdayName(0, 'long')).toBe('Lundi');
    expect(en.weekdayName(6, 'long')).toBe('Sunday');
  });

  test('English follows the region: US month first, GB day first', () => {
    expect(en.formatShortDate('2026-11-15')).toBe('Nov 15');
    expect(en.formatShortDate('2026-11-15', true)).toBe('Nov 15, 2026');
    expect(gb.formatShortDate('2026-11-15')).toBe('15 Nov');
    expect(gb.formatShortDate('2026-11-15', true)).toBe('15 Nov 2026');
    expect(en.formatFullDate('2026-11-15')).toBe('Sunday, November 15, 2026');
    expect(gb.formatFullDate('2026-11-15')).toMatch(/^Sunday,? 15 November 2026$/);
    expect(en.formatMonthYear(2026, 11)).toBe('November 2026');
  });

  test('French in Canada keeps the French words', () => {
    const ca = formatters('fr-CA');
    expect(ca.formatFullDate('2026-11-15')).toBe('Dimanche 15 novembre 2026');
    expect(ca.formatMonthYear(2026, 11)).toBe('Novembre 2026');
  });

  test('a date does not move with the time zone, and a bad one is given back', () => {
    expect(en.formatShortDate('2026-03-29')).toBe('Mar 29');
    expect(fr.formatShortDate('not a date')).toBe('not a date');
    expect(fr.formatFullDate('2026-13-45')).toBe('2026-13-45');
    expect(fr.formatMonthYear(2026, 13)).toBe('');
  });
});
