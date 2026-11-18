import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  addMonthsClamped,
  buildMonthCalendarGrid,
  diffIsoDays,
  getLocalDayBounds,
  getTodayIsoDate,
  getWeekStartIsoDate,
  shiftIsoDate,
} from '../src/index.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Zones with a DST transition in 2026, plus UTC and a zone whose transition falls in the
 * southern spring. Transition days (local calendar dates):
 * - Europe/Paris:        2026-03-29 (23 h), 2026-10-25 (25 h)
 * - America/New_York:    2026-03-08 (23 h), 2026-11-01 (25 h)
 * - Pacific/Auckland:    2026-09-27 (23 h), 2026-04-05 (25 h)
 * - UTC: no transition.
 */
const ZONES = [
  { tz: 'UTC', spring: null, autumn: null },
  { tz: 'Europe/Paris', spring: '2026-03-29', autumn: '2026-10-25' },
  { tz: 'America/New_York', spring: '2026-03-08', autumn: '2026-11-01' },
  { tz: 'Pacific/Auckland', spring: '2026-09-27', autumn: '2026-04-05' },
];

describe.each(ZONES)('in $tz', ({ tz, spring, autumn }) => {
  beforeAll(() => {
    vi.stubEnv('TZ', tz);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('runs under the requested zone', () => {
    // Guards the test itself: if the zone switch silently did nothing, the DST assertions
    // below would pass for the wrong reason.
    const january = new Date(2026, 0, 15, 12).getTimezoneOffset();
    const july = new Date(2026, 6, 15, 12).getTimezoneOffset();
    if (tz === 'UTC') expect([january, july]).toEqual([0, 0]);
    else expect(january).not.toBe(july);
  });

  it('shifts by one day across both transitions', () => {
    for (const day of [spring, autumn]) {
      if (!day) continue;
      expect(shiftIsoDate(shiftIsoDate(day, -1), 1)).toBe(day);
      expect(diffIsoDays(shiftIsoDate(day, -1), day)).toBe(1);
      expect(diffIsoDays(day, shiftIsoDate(day, 1))).toBe(1);
    }
  });

  it('keeps day counts exact over a whole year of transitions', () => {
    expect(diffIsoDays('2026-01-01', '2027-01-01')).toBe(365);
    expect(shiftIsoDate('2026-01-01', 365)).toBe('2027-01-01');
    expect(shiftIsoDate('2026-01-01', 200)).toBe('2026-07-20');
    expect(diffIsoDays('2026-07-20', '2026-01-01')).toBe(-200);
  });

  it('visits every date exactly once when stepping day by day through the year', () => {
    let date = '2026-01-01';
    const seen = new Set([date]);
    for (let i = 0; i < 364; i += 1) {
      const next = shiftIsoDate(date, 1);
      expect(diffIsoDays(date, next)).toBe(1);
      seen.add(next);
      date = next;
    }
    expect(date).toBe('2026-12-31');
    expect(seen.size).toBe(365);
  });

  it('keeps weeks and month grids intact around the transitions', () => {
    for (const day of [spring, autumn]) {
      if (!day) continue;
      const monday = getWeekStartIsoDate(day);
      expect(diffIsoDays(monday, day)).toBeLessThanOrEqual(6);
      const [year, month] = day.split('-').map(Number);
      const grid = buildMonthCalendarGrid(
        /** @type {number} */ (year),
        /** @type {number} */ (month),
      );
      expect(grid.length % 7).toBe(0);
      for (let i = 1; i < grid.length; i += 1) {
        expect(diffIsoDays(grid[i - 1]?.date ?? '', grid[i]?.date ?? '')).toBe(1);
        expect(grid[i]?.weekdayIndex).toBe(i % 7);
      }
      expect(grid.some((cell) => cell.date === day && cell.inCurrentMonth)).toBe(true);
    }
  });

  it('reads the local date of an instant on a transition day', () => {
    for (const day of [spring, autumn]) {
      if (!day) continue;
      const [year, month, dom] = day.split('-').map(Number);
      const y = /** @type {number} */ (year);
      const m = /** @type {number} */ (month) - 1;
      const d = /** @type {number} */ (dom);
      expect(getTodayIsoDate(new Date(y, m, d, 0, 30))).toBe(day);
      expect(getTodayIsoDate(new Date(y, m, d, 23, 30))).toBe(day);
    }
  });

  it('measures a local day as 23, 24 or 25 hours', () => {
    expect(
      (getLocalDayBounds('2026-06-10')?.endMs ?? 0) -
        (getLocalDayBounds('2026-06-10')?.startMs ?? 0),
    ).toBe(24 * HOUR_MS);
    if (spring) {
      const b = getLocalDayBounds(spring);
      expect((b?.endMs ?? 0) - (b?.startMs ?? 0)).toBe(23 * HOUR_MS);
    }
    if (autumn) {
      const b = getLocalDayBounds(autumn);
      expect((b?.endMs ?? 0) - (b?.startMs ?? 0)).toBe(25 * HOUR_MS);
    }
  });

  it('makes consecutive day bounds contiguous across the year', () => {
    let date = '2026-01-01';
    for (let i = 0; i < 365; i += 1) {
      const next = shiftIsoDate(date, 1);
      expect(getLocalDayBounds(date)?.endMs).toBe(getLocalDayBounds(next)?.startMs);
      date = next;
    }
  });
});

describe('month arithmetic with clamping and leap years', () => {
  it('clamps month ends, including February in leap and common years', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-10-31', 1)).toBe('2026-11-30');
    expect(addMonthsClamped('2026-03-29', -1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-10-25', 5)).toBe('2027-03-25');
  });

  it('treats 1900 as common and 2000 as a leap year', () => {
    expect(addMonthsClamped('1900-01-31', 1)).toBe('1900-02-28');
    expect(addMonthsClamped('2000-01-31', 1)).toBe('2000-02-29');
    expect(shiftIsoDate('1900-02-28', 1)).toBe('1900-03-01');
    expect(shiftIsoDate('2000-02-28', 1)).toBe('2000-02-29');
  });
});
