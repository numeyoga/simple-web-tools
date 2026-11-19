// Todo due dates: relative labels to absolute dates, buckets, migration of the old format.

import { formatLocalDate, startOfDay } from './dates.js';

/** @typedef {import('../types.js').Todo} Todo */

/** @type {Record<string, number>} */
const WEEKDAY_LABELS = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
const DUE_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Is `v` a real calendar date `YYYY-MM-DD`? (rejects 2026-02-30 and 2026-13-01)
 * @param {unknown} v
 * @returns {boolean}
 */
export function isDueDate(v) {
  const m = typeof v === 'string' ? DUE_DATE_RE.exec(v) : null;
  if (!m) return false;
  const d = new Date(+(m[1] ?? 0), +(m[2] ?? 0) - 1, +(m[3] ?? 0));
  return (
    d.getFullYear() === +(m[1] ?? 0) &&
    d.getMonth() === +(m[2] ?? 0) - 1 &&
    d.getDate() === +(m[3] ?? 0)
  );
}

/**
 * Converts a relative label ('today', 'tomorrow', 'mon'..'sun', 'week') into a local date
 * `YYYY-MM-DD` anchored on `anchor` (timestamp). Unknown or empty label: null.
 * For a weekday: the next such day >= anchor (the same day is accepted). 'week': anchor + 6 days.
 * Computed in calendar days (setDate), not in ms: a daylight-saving day is not 24 h long.
 * @param {unknown} label
 * @param {number} anchor
 * @returns {string | null}
 */
export function relativeLabelToDate(label, anchor) {
  if (typeof label !== 'string' || !label) return null;
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  let shift;
  if (label === 'today') shift = 0;
  else if (label === 'tomorrow') shift = 1;
  else if (label === 'week') shift = 6;
  else if (Object.prototype.hasOwnProperty.call(WEEKDAY_LABELS, label)) {
    shift = ((WEEKDAY_LABELS[label] ?? 0) - d.getDay() + 7) % 7;
  } else return null;
  d.setDate(d.getDate() + shift);
  return formatLocalDate(d);
}

/**
 * Migrates the due dates of a todo list to the `YYYY-MM-DD` format.
 * - relative label: converted, anchored on `createdAt` (same meaning as before the migration);
 * - null / undefined / valid `YYYY-MM-DD` date: unchanged;
 * - any other value: null.
 * Unchanged todos keep their reference (the IndexedDB write is differential).
 * @template T
 * @param {T[]} todos
 * @param {number} now used when a todo has no `createdAt`
 * @returns {{ todos: T[], change: boolean }}
 */
export function migrateRelativeDueDates(todos, now) {
  if (!Array.isArray(todos)) return { todos, change: false };
  let change = false;
  const migrated = todos.map((t) => {
    if (!t || typeof t !== 'object') return t;
    const e = /** @type {{ dueDate?: unknown, createdAt?: number }} */ (t).dueDate;
    if (e == null || isDueDate(e)) return t;
    change = true;
    return {
      ...t,
      dueDate: relativeLabelToDate(e, /** @type {{ createdAt?: number }} */ (t).createdAt || now),
    };
  });
  return { todos: change ? migrated : todos, change };
}

/**
 * UI preset ('today', 'tomorrow', 'fri', ...) to a date, relative to `ref`.
 * @param {string} preset
 * @param {number} ref
 * @returns {string | null}
 */
export function presetToDate(preset, ref) {
  return relativeLabelToDate(preset, ref);
}

/**
 * `YYYY-MM-DD` to the timestamp of local midnight; null when absent or invalid.
 * @param {unknown} str
 * @returns {number | null}
 */
export function dueDateToTimestamp(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return null;
  const d = new Date(+(m[1] ?? 0), +(m[2] ?? 0) - 1, +(m[3] ?? 0));
  // rejects impossible dates (2026-02-30 would become March 2)
  if (
    d.getFullYear() !== +(m[1] ?? 0) ||
    d.getMonth() !== +(m[2] ?? 0) - 1 ||
    d.getDate() !== +(m[3] ?? 0)
  ) {
    return null;
  }
  return d.getTime();
}

/**
 * Category of a todo given its due date and today (`ref`).
 * 'week' groups everything after tomorrow.
 * @param {Pick<Todo, 'done' | 'dueDate'>} todo
 * @param {number} ref
 * @returns {'overdue' | 'today' | 'tomorrow' | 'week' | 'none' | 'done'}
 */
export function bucket(todo, ref) {
  if (todo.done) return 'done';
  const due = dueDateToTimestamp(todo.dueDate);
  if (due == null) return 'none';
  const today = startOfDay(new Date(ref));
  const tomorrowStart = new Date(today);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1); // not +24 h: daylight-saving changes
  const dayAfterTomorrowStart = new Date(today);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 2);
  if (due < today) return 'overdue';
  if (due < tomorrowStart.getTime()) return 'today';
  if (due < dayAfterTomorrowStart.getTime()) return 'tomorrow';
  return 'week';
}
