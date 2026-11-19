import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../src/index.js';

/** Zones with DST, west and east of Greenwich, plus UTC and a +13/+14 zone. */
const ZONES = ['UTC', 'Europe/Paris', 'America/New_York', 'Pacific/Auckland', 'Pacific/Kiritimati'];

// The first value of each pair is what a naive `new Date('YYYY-MM-DD')` would get wrong.
/** @type {[string, string, Intl.DateTimeFormatOptions, string][]} */
const CASES = [
  ['2026-03-29', 'en', { day: 'numeric', month: 'numeric', year: 'numeric' }, '3/29/2026'], // Paris spring forward
  ['2026-10-25', 'en', { day: 'numeric', month: 'numeric', year: 'numeric' }, '10/25/2026'], // Paris fall back
  ['2026-03-08', 'en', { day: 'numeric', month: 'numeric', year: 'numeric' }, '3/8/2026'], // New York spring forward
  ['2026-11-01', 'en', { day: 'numeric', month: 'numeric', year: 'numeric' }, '11/1/2026'], // New York fall back
  ['2026-09-27', 'fr', { day: 'numeric', month: 'numeric', year: 'numeric' }, '27/09/2026'], // Auckland spring forward
  ['2026-01-01', 'fr', { day: 'numeric', month: 'long', year: 'numeric' }, '1 janvier 2026'],
  ['2026-12-31', 'fr', { day: 'numeric', month: 'long', year: 'numeric' }, '31 décembre 2026'],
  ['2028-02-29', 'en', { day: 'numeric', month: 'long', year: 'numeric' }, 'February 29, 2028'],
];

afterAll(() => {
  vi.unstubAllEnvs();
});

describe.each(ZONES)('formatDate under TZ=%s', (zone) => {
  beforeAll(() => {
    vi.stubEnv('TZ', zone);
  });

  it('really runs in that zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  });

  it.each(CASES)('keeps %s on the same calendar day (%s)', (iso, locale, options, expected) => {
    expect(createTranslator({ locale, catalogs: {} }).formatDate(iso, options)).toBe(expected);
  });

  it('keeps the weekday of the day, not of its UTC neighbour', () => {
    const { formatDate } = createTranslator({ locale: 'en', catalogs: {} });
    expect(formatDate('2026-11-18', { weekday: 'long' })).toBe('Wednesday');
    expect(formatDate('2026-11-15', { weekday: 'long' })).toBe('Sunday');
  });

  it('is not moved by a timeZone option from the caller', () => {
    const { formatDate } = createTranslator({ locale: 'en', catalogs: {} });
    expect(formatDate('2026-11-18', { day: 'numeric', timeZone: 'Pacific/Kiritimati' })).toBe('18');
    expect(formatDate('2026-11-18', { day: 'numeric', timeZone: 'Pacific/Pago_Pago' })).toBe('18');
  });
});

describe('formatDate', () => {
  const { formatDate } = createTranslator({ locale: 'fr', catalogs: {} });

  it('defaults to a medium date', () => {
    expect(formatDate('2026-11-18')).toBe('18 nov. 2026');
    expect(createTranslator({ locale: 'en', catalogs: {} }).formatDate('2026-11-18')).toBe(
      'Nov 18, 2026',
    );
  });

  it('returns invalid input unchanged instead of throwing', () => {
    expect(formatDate('2026-02-30')).toBe('2026-02-30');
    expect(formatDate('18/11/2026')).toBe('18/11/2026');
    expect(formatDate('')).toBe('');
    expect(formatDate(/** @type {any} */ (null))).toBe('null');
  });

  it('handles far dates', () => {
    expect(formatDate('2099-12-31', { year: 'numeric' })).toBe('2099');
  });
});

describe('formatter caching', () => {
  it('builds one Intl instance per locale and options, across translators', () => {
    const construct = vi.spyOn(Intl, 'DateTimeFormat');
    /** @type {Intl.DateTimeFormatOptions} */
    const options = { weekday: 'narrow', month: 'narrow', era: 'narrow' }; // unique to this test
    const a = createTranslator({ locale: 'sv', catalogs: {} });
    const b = createTranslator({ locale: 'sv', catalogs: {} });
    for (let i = 0; i < 5; i += 1) a.formatDate('2026-11-18', options);
    b.formatDate('2026-11-19', options);
    expect(construct).toHaveBeenCalledTimes(1);
    a.formatDate('2026-11-18', { ...options, era: 'short' });
    expect(construct).toHaveBeenCalledTimes(2);
    construct.mockRestore();
  });

  it('caches number formatters', () => {
    const construct = vi.spyOn(Intl, 'NumberFormat');
    const t = createTranslator({ locale: 'sv', catalogs: {} });
    construct.mockClear();
    const options = { maximumFractionDigits: 7 };
    t.formatNumber(1, options);
    t.formatNumber(2, options);
    expect(construct).toHaveBeenCalledTimes(1);
    construct.mockRestore();
  });
});
