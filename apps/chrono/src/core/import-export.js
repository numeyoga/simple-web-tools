// Import validation and the shape of the export file. Pure: the envelope itself
// (`createExportEnvelope`, `parseExport`) comes from @simple-web-tools/storage and is used by
// adapters/backup.js.
//
// Export format `chrono-workspace`:
//   version 3 (current): envelope { app, format, version, exportedAt, data } with the English
//     `data` { projects, todos, sessions, attendance }; a project has `category` (1 to 16) or
//     `customColor` (`#rrggbb`).
//   version 2: the same envelope, a project has `color` (a hex value). Upgraded on import.
//   version 1 (the files of the GitLab site, imported forever): not an envelope, a bare object
//     { version: 1, exporteLe, workspace, data: { projets, todos, sessions, pointage } }.

import { migrateRelativeDueDates } from './due-dates.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */

export const EXPORT_APP = 'chrono';
export const EXPORT_FORMAT = 'chrono-workspace';
export const EXPORT_VERSION = 3;

const SESSION_STATUSES = ['done', 'running', 'paused'];

/**
 * Keeps "object with a text id" items.
 * @param {unknown} x
 * @returns {boolean}
 */
const isRecordWithId = (x) =>
  !!x &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  typeof (/** @type {{ id?: unknown }} */ (x).id) === 'string';

/**
 * Same, with a known status for sessions.
 * @param {unknown} x
 * @returns {boolean}
 */
const isValidSession = (x) =>
  isRecordWithId(x) &&
  SESSION_STATUSES.includes(/** @type {{ status?: string }} */ (x).status ?? '');

/**
 * Is this parsed file a version 1 export, or bare data? Those files have no `app` field: they
 * are not envelopes.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyExport(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !('app' in value);
}

/**
 * Wrap a version 1 file (or bare data) as a version 1 envelope, ready for `parseExport` and its
 * version 1 to 2 upgrade. The export time is the file's `exporteLe` when it is a valid date,
 * else `now`.
 * @param {object} legacy
 * @param {number} now
 * @returns {{ app: string, format: string, version: number, exportedAt: string, data: unknown }}
 */
export function wrapLegacyExport(legacy, now) {
  const root = /** @type {{ data?: unknown, exporteLe?: unknown }} */ (legacy);
  const exportedAt =
    typeof root.exporteLe === 'string' && !Number.isNaN(Date.parse(root.exporteLe))
      ? root.exporteLe
      : new Date(now).toISOString();
  return {
    app: EXPORT_APP,
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt,
    data: root.data || legacy,
  };
}

/**
 * The `data` of an export from the four collections of the state.
 * @param {ChronoData} data
 * @returns {ChronoData}
 */
export function toExportData(data) {
  return {
    projects: data.projects,
    todos: data.todos,
    sessions: data.sessions,
    attendance: data.attendance,
  };
}

/**
 * Validates and cleans the version 3 `data` of an import. Invalid items are dropped, old due
 * dates are migrated. Throws when the format is wrong or when nothing valid remains.
 * @param {unknown} payload
 * @param {number} now
 * @returns {ChronoData}
 */
export function validateImport(payload, now) {
  const data = /** @type {Partial<Record<keyof ChronoData, unknown>> | null | undefined} */ (
    payload
  );
  if (!data || typeof data !== 'object') throw new Error('format invalide');
  const raw = {
    projects: Array.isArray(data.projects) ? data.projects : [],
    todos: Array.isArray(data.todos) ? data.todos : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    attendance: Array.isArray(data.attendance) ? data.attendance : [],
  };
  const projects = raw.projects.filter(isRecordWithId);
  const todos = migrateRelativeDueDates(raw.todos.filter(isRecordWithId), now).todos;
  const sessions = raw.sessions.filter(isValidSession);
  const attendance = raw.attendance.filter(isRecordWithId);
  const rawCount =
    raw.projects.length + raw.todos.length + raw.sessions.length + raw.attendance.length;
  if (rawCount > 0 && projects.length + todos.length + sessions.length + attendance.length === 0) {
    throw new Error('aucune donnée valide');
  }
  return { projects, todos, sessions, attendance };
}
