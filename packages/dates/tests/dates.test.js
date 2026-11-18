import { describe, it, expect } from 'vitest';
import {
  addMonthsClamped,
  buildMonthCalendarGrid,
  buildWeekCalendarGrid,
  daysInMonth,
  diffIsoDays,
  formatIsoDate,
  getIsoWeekdayMon0,
  getLocalDayBounds,
  getTodayIsoDate,
  getWeekStartIsoDate,
  isWeekendIsoDate,
  isWeekendWeekdayIndex,
  parseIsoDate,
  parseTimeHhMm,
  shiftIsoDate,
  toLocalIsoDate,
} from '../src/index.js';

describe('parseIsoDate', () => {
  it('parses strict YYYY-MM-DD dates', () => {
    expect(parseIsoDate('2026-11-15')).toEqual({ year: 2026, month: 11, day: 15 });
    expect(parseIsoDate(' 2026-11-15 ')).toEqual({ year: 2026, month: 11, day: 15 });
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('rejects impossible and malformed dates', () => {
    expect(parseIsoDate('2025-02-29')).toBeNull();
    expect(parseIsoDate('1900-02-29')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('2026-00-10')).toBeNull();
    expect(parseIsoDate('2026-04-31')).toBeNull();
    expect(parseIsoDate('2026-1-5')).toBeNull();
    expect(parseIsoDate('2026-11-15T00:00:00Z')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
  });
});

describe('parseTimeHhMm', () => {
  it('parses 24-hour times', () => {
    expect(parseTimeHhMm('07:00')).toEqual({ hour: 7, minute: 0, normalized: '07:00' });
    expect(parseTimeHhMm('23:59')).toEqual({ hour: 23, minute: 59, normalized: '23:59' });
    expect(parseTimeHhMm('00:00')).toEqual({ hour: 0, minute: 0, normalized: '00:00' });
  });

  it('rejects out-of-range and malformed times', () => {
    expect(parseTimeHhMm('24:00')).toBeNull();
    expect(parseTimeHhMm('12:60')).toBeNull();
    expect(parseTimeHhMm('7:00')).toBeNull();
    expect(parseTimeHhMm('')).toBeNull();
    expect(parseTimeHhMm(null)).toBeNull();
  });
});

describe('formatting from parts and from a Date', () => {
  it('zero-pads the parts', () => {
    expect(formatIsoDate(2026, 1, 5)).toBe('2026-01-05');
    expect(formatIsoDate(99, 12, 31)).toBe('0099-12-31');
  });

  it('reads the local calendar date of a Date, never the UTC one', () => {
    // Local midnight and one minute before the next midnight are the same local day,
    // whatever the offset from UTC.
    expect(toLocalIsoDate(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
    expect(toLocalIsoDate(new Date(2026, 0, 1, 23, 59, 59))).toBe('2026-01-01');
  });

  it('getTodayIsoDate uses the Date it is given', () => {
    expect(getTodayIsoDate(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15');
    expect(getTodayIsoDate(new Date(2024, 1, 29, 0, 0))).toBe('2024-02-29');
  });
});

describe('shiftIsoDate', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftIsoDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftIsoDate('2024-02-28', 2)).toBe('2024-03-01');
    expect(shiftIsoDate('2025-02-28', 1)).toBe('2025-03-01');
    expect(shiftIsoDate('2026-11-15', -7)).toBe('2026-11-08');
    expect(shiftIsoDate('2026-11-15', 0)).toBe('2026-11-15');
    expect(shiftIsoDate('2026-01-01', 365)).toBe('2027-01-01');
    expect(shiftIsoDate('2024-01-01', 366)).toBe('2025-01-01');
  });

  it('truncates fractional deltas and leaves invalid dates untouched', () => {
    expect(shiftIsoDate('2026-11-15', 1.9)).toBe('2026-11-16');
    expect(shiftIsoDate('2026-11-15', -1.9)).toBe('2026-11-14');
    expect(shiftIsoDate('nope', 3)).toBe('nope');
  });
});

describe('addMonthsClamped', () => {
  it('clamps the day to the length of the target month', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-05-31', 1)).toBe('2026-06-30');
    expect(addMonthsClamped('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonthsClamped('2024-02-29', 48)).toBe('2028-02-29');
  });

  it('crosses years in both directions', () => {
    expect(addMonthsClamped('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonthsClamped('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonthsClamped('2026-01-15', -13)).toBe('2024-12-15');
    expect(addMonthsClamped('2026-01-15', 0)).toBe('2026-01-15');
    expect(addMonthsClamped('bad', 1)).toBe('bad');
  });
});

describe('daysInMonth', () => {
  it('knows the length of every kind of month', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('weekdays and weeks', () => {
  it('numbers weekdays from Monday = 0', () => {
    expect(getIsoWeekdayMon0('2026-11-09')).toBe(0);
    expect(getIsoWeekdayMon0('2026-11-14')).toBe(5);
    expect(getIsoWeekdayMon0('2026-11-15')).toBe(6);
    expect(getIsoWeekdayMon0('invalid')).toBe(0);
  });

  it('finds the Monday of a week', () => {
    expect(getWeekStartIsoDate('2026-11-15')).toBe('2026-11-09');
    expect(getWeekStartIsoDate('2026-11-09')).toBe('2026-11-09');
    expect(getWeekStartIsoDate('2027-01-01')).toBe('2026-12-28');
  });

  it('detects weekends', () => {
    expect(isWeekendWeekdayIndex(4)).toBe(false);
    expect(isWeekendWeekdayIndex(5)).toBe(true);
    expect(isWeekendWeekdayIndex(6)).toBe(true);
    expect(isWeekendIsoDate('2026-11-13')).toBe(false);
    expect(isWeekendIsoDate('2026-11-14')).toBe(true);
    expect(isWeekendIsoDate('2026-11-15')).toBe(true);
    expect(isWeekendIsoDate('invalid')).toBe(false);
    expect(isWeekendIsoDate(null)).toBe(false);
  });
});

describe('diffIsoDays', () => {
  it('returns the signed number of calendar days', () => {
    expect(diffIsoDays('2026-11-15', '2026-11-22')).toBe(7);
    expect(diffIsoDays('2026-11-22', '2026-11-15')).toBe(-7);
    expect(diffIsoDays('2026-11-15', '2026-11-15')).toBe(0);
    expect(diffIsoDays('2024-02-28', '2024-03-01')).toBe(2);
    expect(diffIsoDays('2025-02-28', '2025-03-01')).toBe(1);
    expect(diffIsoDays('2026-01-01', '2027-01-01')).toBe(365);
    expect(diffIsoDays('2024-01-01', '2025-01-01')).toBe(366);
    expect(diffIsoDays('bad', '2026-11-15')).toBe(0);
  });
});

describe('calendar grids', () => {
  it('builds the Monday-to-Sunday week of a date', () => {
    const week = buildWeekCalendarGrid('2026-11-15');
    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe('2026-11-09');
    expect(week[6]?.date).toBe('2026-11-15');
    expect(week.map((c) => c.weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(week.map((c) => c.isWeekend)).toEqual([false, false, false, false, false, true, true]);
    expect(week[0]).toEqual({
      date: '2026-11-09',
      day: 9,
      month: 11,
      year: 2026,
      weekdayIndex: 0,
      isWeekend: false,
    });
  });

  it('builds a six-week month grid (November 2026 starts on a Sunday)', () => {
    const grid = buildMonthCalendarGrid(2026, 11);
    expect(grid).toHaveLength(42);
    expect(grid[0]?.date).toBe('2026-10-26');
    expect(grid[0]?.inCurrentMonth).toBe(false);
    expect(grid[6]?.date).toBe('2026-11-01');
    expect(grid[6]?.inCurrentMonth).toBe(true);
    expect(grid[35]?.date).toBe('2026-11-30');
    expect(grid[35]?.inCurrentMonth).toBe(true);
    expect(grid[41]?.date).toBe('2026-12-06');
    expect(grid[41]?.inCurrentMonth).toBe(false);
    expect(grid[5]?.isWeekend).toBe(true);
    expect(grid[6]?.isWeekend).toBe(true);
    expect(grid[7]?.isWeekend).toBe(false);
  });

  it('builds a four-week grid when February starts on a Monday (February 2027)', () => {
    const grid = buildMonthCalendarGrid(2027, 2);
    expect(grid).toHaveLength(28);
    expect(grid[0]?.date).toBe('2027-02-01');
    expect(grid[27]?.date).toBe('2027-02-28');
    expect(grid.every((c) => c.inCurrentMonth)).toBe(true);
  });

  it('handles a leap February and a year boundary', () => {
    const feb = buildMonthCalendarGrid(2024, 2);
    expect(feb.filter((c) => c.inCurrentMonth)).toHaveLength(29);
    const dec = buildMonthCalendarGrid(2026, 12);
    expect(dec.at(-1)?.date).toBe('2027-01-03');
    expect(dec.at(-1)?.year).toBe(2027);
    expect(dec.at(-1)?.inCurrentMonth).toBe(false);
  });
});

describe('getLocalDayBounds', () => {
  it('returns local midnight and the next local midnight', () => {
    const bounds = getLocalDayBounds('2026-11-15');
    expect(bounds).toEqual({
      startMs: new Date(2026, 10, 15).getTime(),
      endMs: new Date(2026, 10, 16).getTime(),
    });
  });

  it('rolls over month and year ends', () => {
    expect(getLocalDayBounds('2026-12-31')?.endMs).toBe(new Date(2027, 0, 1).getTime());
    expect(getLocalDayBounds('2024-02-29')?.endMs).toBe(new Date(2024, 2, 1).getTime());
  });

  it('returns null for an invalid date', () => {
    expect(getLocalDayBounds('2026-02-30')).toBeNull();
  });
});
