// Dates and durations. Pure: nothing here reads the clock, callers pass the date in.

import { toLocalIsoDate } from '@simple-web-tools/dates';

/**
 * Start of the local day (00:00:00.000) as a timestamp.
 * @param {Date | number} d
 * @returns {number}
 */
export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Local date as `YYYY-MM-DD`. Never use toISOString(), which converts to UTC: in France,
 * Monday 00:00 would become "Sunday".
 * @param {Date | number} d
 * @returns {string}
 */
export function formatLocalDate(d) {
  return toLocalIsoDate(new Date(d));
}

/**
 * Formats a duration in milliseconds as `HH:MM`, `HH:MM:SS` or a compact form.
 * @param {number} ms
 * @param {{ withSeconds?: boolean, compact?: boolean }} [opts]
 * @returns {string}
 */
export function formatDuration(ms, opts = {}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (opts.withSeconds) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (opts.compact) {
    if (h === 0 && m === 0) return `${s}s`;
    if (h === 0) return `${m}m`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
