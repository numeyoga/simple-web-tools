// Todo due dates: relative labels to absolute dates, buckets, migration of the old format.

import { fmtDateISO, startOfDay } from './dates.js';

/** @typedef {import('../types.js').Todo} Todo */

/** @type {Record<string, number>} */
const JOURS_ECHEANCE = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
const RE_DATE_ECHEANCE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Is `v` a real calendar date `AAAA-MM-JJ`? (rejects 2026-02-30 and 2026-13-01)
 * @param {unknown} v
 * @returns {boolean}
 */
export function estDateEcheance(v) {
  const m = typeof v === 'string' ? RE_DATE_ECHEANCE.exec(v) : null;
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
 * `AAAA-MM-JJ` anchored on `ancre` (timestamp). Unknown or empty label: null.
 * For a weekday: the next such day >= anchor (the same day is accepted). 'week': anchor + 6 days.
 * Computed in calendar days (setDate), not in ms: a daylight-saving day is not 24 h long.
 * @param {unknown} label
 * @param {number} ancre
 * @returns {string | null}
 */
export function echeanceRelativeVersDate(label, ancre) {
  if (typeof label !== 'string' || !label) return null;
  const d = new Date(ancre);
  d.setHours(0, 0, 0, 0);
  let decalage;
  if (label === 'today') decalage = 0;
  else if (label === 'tomorrow') decalage = 1;
  else if (label === 'week') decalage = 6;
  else if (Object.prototype.hasOwnProperty.call(JOURS_ECHEANCE, label)) {
    decalage = ((JOURS_ECHEANCE[label] ?? 0) - d.getDay() + 7) % 7;
  } else return null;
  d.setDate(d.getDate() + decalage);
  return fmtDateISO(d);
}

/**
 * Migrates the due dates of a todo list to the `AAAA-MM-JJ` format.
 * - relative label: converted, anchored on `creeLe` (same meaning as before the migration);
 * - null / undefined / valid `AAAA-MM-JJ` date: unchanged;
 * - any other value: null.
 * Unchanged todos keep their reference (the IndexedDB write is differential).
 * @template T
 * @param {T[]} todos
 * @param {number} now used when a todo has no `creeLe`
 * @returns {{ todos: T[], change: boolean }}
 */
export function migrerEcheancesTodos(todos, now) {
  if (!Array.isArray(todos)) return { todos, change: false };
  let change = false;
  const migres = todos.map((t) => {
    if (!t || typeof t !== 'object') return t;
    const e = /** @type {{ echeance?: unknown, creeLe?: number }} */ (t).echeance;
    if (e == null || estDateEcheance(e)) return t;
    change = true;
    return {
      ...t,
      echeance: echeanceRelativeVersDate(e, /** @type {{ creeLe?: number }} */ (t).creeLe || now),
    };
  });
  return { todos: change ? migres : todos, change };
}

/**
 * UI preset ('today', 'tomorrow', 'fri', ...) to a date, relative to `ref`.
 * @param {string} preset
 * @param {number} ref
 * @returns {string | null}
 */
export function presetVersDate(preset, ref) {
  return echeanceRelativeVersDate(preset, ref);
}

/**
 * `AAAA-MM-JJ` to the timestamp of local midnight; null when absent or invalid.
 * @param {unknown} str
 * @returns {number | null}
 */
export function dateEcheanceVersTs(str) {
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
 * @param {Pick<Todo, 'fait' | 'echeance'>} todo
 * @param {number} ref
 * @returns {'overdue' | 'today' | 'tomorrow' | 'week' | 'none' | 'done'}
 */
export function bucket(todo, ref) {
  if (todo.fait) return 'done';
  const due = dateEcheanceVersTs(todo.echeance);
  if (due == null) return 'none';
  const today = startOfDay(new Date(ref));
  const demain = new Date(today);
  demain.setDate(demain.getDate() + 1); // not +24 h: daylight-saving changes
  const apresDemain = new Date(today);
  apresDemain.setDate(apresDemain.getDate() + 2);
  if (due < today) return 'overdue';
  if (due < demain.getTime()) return 'today';
  if (due < apresDemain.getTime()) return 'tomorrow';
  return 'week';
}
