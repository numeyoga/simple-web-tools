/**
 * Locavern date module. The generic calendar helpers (parsing, arithmetic, grids) live in
 * `@simple-web-tools/dates` and are re-exported here so that the app keeps one import path.
 * This file adds what is specific to Locavern: French labels (until the i18n catalogs of
 * roadmap step 5), off-hours slots, recurrence and due-date urgency.
 */

import {
  addMonthsClamped,
  buildWeekCalendarGrid as buildGenericWeekCalendarGrid,
  diffIsoDays,
  getIsoWeekdayMon0,
  getTodayIsoDate as getTodayIsoDateFor,
  parseIsoDate,
  parseTimeHhMm,
  shiftIsoDate,
} from '@simple-web-tools/dates';

export {
  addMonthsClamped,
  buildMonthCalendarGrid,
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

/** @type {readonly string[]} */
export const WEEKDAY_SHORT_FR = Object.freeze(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);

/** @type {readonly string[]} */
const MONTH_NAMES_FR = Object.freeze([
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]);

/** @type {readonly string[]} */
const MONTH_SHORT_FR = Object.freeze([
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]);

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
 * Build the 7-day Monday-to-Sunday week containing `anchorIsoDate`, with French weekday labels.
 * @param {string} anchorIsoDate
 * @returns {Array<import('@simple-web-tools/dates').WeekGridCell & { weekdayLabel: string }>}
 */
export function buildWeekCalendarGrid(anchorIsoDate) {
  return buildGenericWeekCalendarGrid(anchorIsoDate).map((cell) => ({
    ...cell,
    weekdayLabel: WEEKDAY_SHORT_FR[cell.weekdayIndex] ?? '',
  }));
}

/**
 * Format "Mois AAAA" in French sentence case.
 * @param {number} year
 * @param {number} month 1..12
 * @returns {string}
 */
export function formatMonthYearLabel(year, month) {
  const name = MONTH_NAMES_FR[month - 1] ?? '';
  return `${name} ${year}`;
}

/**
 * Format a compact French date label like "15 nov." or "15 nov. 2026".
 * @param {string} isoDate
 * @param {boolean} [withYear]
 * @returns {string}
 */
export function formatShortDateFr(isoDate, withYear = false) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const monthLabel = MONTH_SHORT_FR[parts.month - 1] ?? String(parts.month);
  return withYear ? `${parts.day} ${monthLabel} ${parts.year}` : `${parts.day} ${monthLabel}`;
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

/** @type {readonly string[]} */
const WEEKDAY_LONG_FR = Object.freeze([
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
]);

/** @type {readonly string[]} */
const MONTH_LOWER_FR = Object.freeze([
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]);

/**
 * Format a full French calendar date like "Dimanche 15 novembre 2026".
 * @param {string} isoDate
 * @returns {string}
 */
export function formatFullDateFr(isoDate) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const weekday = WEEKDAY_LONG_FR[getIsoWeekdayMon0(isoDate)] ?? '';
  const monthName = MONTH_LOWER_FR[parts.month - 1] ?? String(parts.month);
  return `${weekday} ${parts.day} ${monthName} ${parts.year}`;
}
