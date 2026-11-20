/**
 * Locavern date module. The generic calendar helpers (parsing, arithmetic, grids) live in
 * `@simple-web-tools/dates` and are re-exported here so that the app keeps one import path.
 * This file adds what is specific to Locavern: off-hours slots, recurrence and due-date urgency.
 * How a date reads in a language is in `format.js`.
 */

import {
  addMonthsClamped,
  diffIsoDays,
  getTodayIsoDate as getTodayIsoDateFor,
  parseIsoDate,
  parseTimeHhMm,
  shiftIsoDate,
} from '@simple-web-tools/dates';

export {
  addMonthsClamped,
  buildMonthCalendarGrid,
  buildWeekCalendarGrid,
  diffIsoDays,
  formatIsoDate,
  getIsoWeekdayMon0,
  getWeekStartIsoDate,
  isWeekendIsoDate,
  isWeekendWeekdayIndex,
  parseIsoDate,
  parseTimeHhMm,
  shiftIsoDate,
} from '@simple-web-tools/dates';

/**
 * Today's local calendar date. Thin wrapper over the package version, which requires `now`:
 * it keeps the default clock for the many call sites in the views and the store.
 * @param {Date} [now]
 * @returns {string}
 */
export function getTodayIsoDate(now = new Date()) {
  return getTodayIsoDateFor(now);
}

/**
 * Return true if an hour (0..23) falls within the 18:00–07:00 off-hours slot
 * (i.e., 18:00..23:59 or 00:00..06:59).
 * @param {number} hour
 * @returns {boolean}
 */
export function isOffHoursHour(hour) {
  return hour >= 18 || hour < 7;
}

/**
 * Return true if a dueTime ("HH:MM") falls within the 18:00–07:00 off-hours slot.
 * @param {string | null | undefined} dueTime
 * @returns {boolean}
 */
export function isOffHoursDueTime(dueTime) {
  const parsed = parseTimeHhMm(dueTime);
  if (!parsed) return false;
  return isOffHoursHour(parsed.hour);
}

/**
 * Compute the next dueDate (YYYY-MM-DD) for a recurring task upon completion.
 * Uses `dueDate` as anchor when valid, falling back to `todayIso`.
 * @param {string | null | undefined} dueDate
 * @param {'daily' | 'weekly' | 'monthly' | null | undefined} recurrence
 * @param {string} [todayIso]
 * @returns {string | null}
 */
export function computeNextRecurrenceDueDate(dueDate, recurrence, todayIso = getTodayIsoDate()) {
  if (recurrence !== 'daily' && recurrence !== 'weekly' && recurrence !== 'monthly') {
    return null;
  }
  const base = parseIsoDate(dueDate)
    ? /** @type {string} */ (dueDate)
    : parseIsoDate(todayIso)
      ? todayIso
      : getTodayIsoDate();
  if (recurrence === 'daily') return shiftIsoDate(base, 1);
  if (recurrence === 'weekly') return shiftIsoDate(base, 7);
  return addMonthsClamped(base, 1);
}

/**
 * Classify a task dueDate relative to todayIso ('overdue' | 'today' | 'this_week' | 'later' | null).
 * Returns null for missing dates or completed/terminal tasks.
 * @param {string | null | undefined} dueDate
 * @param {string} todayIso
 * @param {string | null} [status]
 * @param {boolean} [isTerminal]
 * @returns {'overdue' | 'today' | 'this_week' | 'later' | null}
 */
export function classifyDueDateUrgency(dueDate, todayIso, status = null, isTerminal = false) {
  if (!dueDate || isTerminal || status === 'done') return null;
  if (!parseIsoDate(dueDate) || !parseIsoDate(todayIso)) return null;
  const delta = diffIsoDays(todayIso, dueDate);
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  if (delta <= 6) return 'this_week';
  return 'later';
}
