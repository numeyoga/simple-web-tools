// Runs the tests of a describe block in a given time zone (Node re-reads the `TZ` variable
// whenever it is assigned), then restores the previous one.
import { afterAll, beforeAll, vi } from 'vitest';

/** Zones of the DST tests, with a spring-forward day (23 h) and a fall-back day (25 h). */
export const DST_CASES = /** @type {const} */ ([
  { zone: 'Europe/Paris', short: '2026-03-29', long: '2026-10-25' },
  { zone: 'America/New_York', short: '2026-03-08', long: '2026-11-01' },
  { zone: 'Pacific/Auckland', short: '2026-09-27', long: '2026-04-05' },
  { zone: 'UTC', short: null, long: null },
]);

/** @param {string} zone */
export function useTimeZone(zone) {
  beforeAll(() => {
    vi.stubEnv('TZ', zone);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
}

/**
 * Local timestamp in the current zone.
 * @param {string} isoDate `YYYY-MM-DD`
 * @param {number} hours
 * @param {number} [minutes]
 */
export function local(isoDate, hours, minutes = 0) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(
    /** @type {number} */ (y),
    /** @type {number} */ (m) - 1,
    d,
    hours,
    minutes,
  ).getTime();
}
