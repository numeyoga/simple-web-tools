// Dates, times and durations in English and in French, from the same calls.
import { createTranslator } from '@simple-web-tools/i18n';
import { describe, expect, test } from 'vitest';
import { createFormatters } from '../../src/core/format.js';
import { catalogs } from '../../src/i18n/index.js';

/** @param {string} locale */
const formatters = (locale) => createFormatters(createTranslator({ locale, catalogs }));
const en = formatters('en');
const fr = formatters('fr');
// Wednesday 2026-11-18, 09:05 and 17:30 local time.
const morning = new Date(2026, 10, 18, 9, 5).getTime();
const evening = new Date(2026, 10, 18, 17, 30).getTime();

describe('durations', () => {
  test('HH:MM is the same in every language, with the same figures as before', () => {
    for (const { formatDuration } of [en, fr]) {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(59_999)).toBe('00:00');
      expect(formatDuration(60_000)).toBe('00:01');
      expect(formatDuration(3_900_000)).toBe('01:05');
      expect(formatDuration(100 * 3600_000)).toBe('100:00');
      expect(formatDuration(-5)).toBe('00:00');
    }
  });

  test('seconds and the compact form keep their visual format', () => {
    for (const { formatDuration } of [en, fr]) {
      expect(formatDuration(3_725_000, { withSeconds: true })).toBe('01:02:05');
      expect(formatDuration(3_900_000, { compact: true })).toBe('1h05');
      expect(formatDuration(720_000, { compact: true })).toBe('12m');
      expect(formatDuration(30_000, { compact: true })).toBe('30s');
    }
  });
});

describe('times', () => {
  test('French 24 hours, English 12 hours', () => {
    expect(fr.formatTime(morning)).toBe('09:05');
    expect(fr.formatTime(evening)).toBe('17:30');
    expect(en.formatTime(morning)).toMatch(/^09:05\sAM$/);
    expect(en.formatTime(evening)).toMatch(/^05:30\sPM$/);
  });
});

describe('hours of an axis', () => {
  test('24-hour clocks keep 07:00, 12-hour clocks write 7:00 AM', () => {
    expect([7, 13, 20].map(fr.formatHour)).toEqual(['07:00', '13:00', '20:00']);
    const gb = formatters('en-GB');
    expect([7, 13, 20].map(gb.formatHour)).toEqual(['07:00', '13:00', '20:00']);
    expect(en.formatHour(7)).toMatch(/^7:00\sAM$/);
    expect(en.formatHour(13)).toMatch(/^1:00\sPM$/);
    expect(formatters('en-US').formatHour(20)).toMatch(/^8:00\sPM$/);
  });
});

describe('dates', () => {
  const long = /** @type {const} */ ({ weekday: 'long', day: 'numeric', month: 'long' });
  const short = /** @type {const} */ ({ weekday: 'short', day: 'numeric', month: 'short' });

  test('a region changes the order of the date, not the language', () => {
    const gb = formatters('en-GB');
    expect(gb.formatDay(morning, long)).toBe('Wednesday 18 November');
    expect(formatters('fr-CA').formatDay(morning, long)).toBe('mercredi 18 novembre');
    expect(gb.formatDay(morning, { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe(
      '18/11/2026',
    );
  });

  test('the day of an instant, in the words of the language', () => {
    expect(fr.formatDay(morning, long)).toBe('mercredi 18 novembre');
    expect(en.formatDay(morning, long)).toBe('Wednesday, November 18');
    expect(fr.formatDay(morning, { day: '2-digit', month: 'short', year: 'numeric' })).toBe(
      '18 nov. 2026',
    );
    expect(en.formatDay(morning, { day: '2-digit', month: 'short', year: 'numeric' })).toBe(
      'Nov 18, 2026',
    );
  });

  test('a calendar date does not move with the time zone of the machine', () => {
    expect(fr.formatIsoDate('2026-11-20', short)).toBe('ven. 20 nov.');
    expect(en.formatIsoDate('2026-11-20', short)).toBe('Fri, Nov 20');
    expect(en.formatIsoDate('2026-03-29', long)).toBe('Sunday, March 29');
  });

  test('the late evening and the early morning belong to their own local day', () => {
    const late = new Date(2026, 10, 18, 23, 59).getTime();
    const early = new Date(2026, 10, 19, 0, 1).getTime();
    expect(en.formatDay(late, long)).toBe('Wednesday, November 18');
    expect(en.formatDay(early, long)).toBe('Thursday, November 19');
  });

  test('weekday names come from the language, in order from Monday', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => fr.weekdayName(i, 'short'))).toEqual([
      'lun.',
      'mar.',
      'mer.',
      'jeu.',
      'ven.',
      'sam.',
      'dim.',
    ]);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => en.weekdayName(i, 'short'))).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(fr.capitalize(fr.weekdayName(4))).toBe('Vendredi');
    expect(en.capitalize(en.weekdayName(0))).toBe('Monday');
  });
});
