// Schema migrations, pure: version 1 (French field names) to version 2 (English field names).
// The same functions serve the IndexedDB upgrade (adapters/idb.js), the JSON import
// (adapters/backup.js), the localStorage fallback and the workspace list. The field table is in
// README.md.
//
// Rules: a field that is not in the tables, and anything that is not a record, is kept as it
// is (the validation of the import drops what is unusable, the migration never loses data).

/** @typedef {import('../types.js').ChronoData} ChronoData */

/** @type {Readonly<Record<string, string>>} */
export const PROJECT_FIELDS = { nom: 'name', couleur: 'color', archive: 'archived' };

/** @type {Readonly<Record<string, string>>} */
export const TODO_FIELDS = {
  titre: 'title',
  fait: 'done',
  projetId: 'projectId',
  echeance: 'dueDate',
  creeLe: 'createdAt',
};

/** @type {Readonly<Record<string, string>>} */
export const SESSION_FIELDS = {
  projetId: 'projectId',
  debut: 'start',
  dernierDebut: 'lastStart',
  fin: 'end',
  duree: 'duration',
  statut: 'status',
};

/** @type {Readonly<Record<string, string>>} */
export const ATTENDANCE_FIELDS = { sessionsSuspenduesIds: 'suspendedSessionIds' };

/** @type {Readonly<Record<string, string>>} */
export const SESSION_STATUSES = { terminee: 'done', en_cours: 'running', en_pause: 'paused' };

/** @type {Readonly<Record<string, string>>} */
export const ATTENDANCE_TYPES = {
  arrivee: 'arrival',
  pause_debut: 'break_start',
  pause_fin: 'break_end',
  depart: 'departure',
};

/**
 * Persisted collections: version 1 name, version 2 name, record conversion.
 * @type {readonly [string, string, (record: unknown) => unknown][]}
 */
const COLLECTIONS = [
  ['projets', 'projects', projectV1ToV2],
  ['todos', 'todos', todoV1ToV2],
  ['sessions', 'sessions', sessionV1ToV2],
  ['pointage', 'attendance', attendanceV1ToV2],
];

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Rename the fields of a record. A field is left under its old name when the record already
 * has a field with the new one, so that nothing is overwritten.
 * @param {Record<string, unknown>} record
 * @param {Readonly<Record<string, string>>} fields old name -> new name
 * @returns {Record<string, unknown>}
 */
function renameFields(record, fields) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    const target = Object.hasOwn(fields, key) ? /** @type {string} */ (fields[key]) : key;
    out[target !== key && Object.hasOwn(record, target) ? key : target] = value;
  }
  return out;
}

/**
 * Replace a known version 1 value (status, attendance type); other values are kept.
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} values
 * @returns {unknown}
 */
function mapValue(value, values) {
  return typeof value === 'string' && Object.hasOwn(values, value) ? values[value] : value;
}

/**
 * @param {unknown} record version 1 project
 * @returns {unknown}
 */
export function projectV1ToV2(record) {
  return isRecord(record) ? renameFields(record, PROJECT_FIELDS) : record;
}

/**
 * The due date is only renamed: an old relative label (`today`, `fri`...) stays until the due
 * date migration of the store, which needs the current time, turns it into a date.
 * @param {unknown} record version 1 todo
 * @returns {unknown}
 */
export function todoV1ToV2(record) {
  return isRecord(record) ? renameFields(record, TODO_FIELDS) : record;
}

/**
 * @param {unknown} record version 1 session
 * @returns {unknown}
 */
export function sessionV1ToV2(record) {
  if (!isRecord(record)) return record;
  const out = renameFields(record, SESSION_FIELDS);
  if (Object.hasOwn(out, 'status')) out.status = mapValue(out.status, SESSION_STATUSES);
  return out;
}

/**
 * The legacy singular `sessionSuspendueId` is folded into `suspendedSessionIds`; when both
 * exist the list wins, as it did in version 1.
 * @param {unknown} record version 1 attendance event
 * @returns {unknown}
 */
export function attendanceV1ToV2(record) {
  if (!isRecord(record)) return record;
  const { sessionSuspendueId, ...rest } = record;
  const out = renameFields(rest, ATTENDANCE_FIELDS);
  if (Object.hasOwn(out, 'type')) out.type = mapValue(out.type, ATTENDANCE_TYPES);
  if (!Array.isArray(out.suspendedSessionIds)) {
    if (typeof sessionSuspendueId === 'string' && sessionSuspendueId !== '') {
      out.suspendedSessionIds = [sessionSuspendueId];
    } else if (sessionSuspendueId !== undefined) {
      out.sessionSuspendueId = sessionSuspendueId; // unusable value: kept as it is
    }
  }
  return out;
}

/**
 * Convert the data of a workspace (a database content or the `data` of an export) from
 * version 1 to version 2. Only the collections that are present are converted; other keys are
 * kept. Does not mutate its input.
 * @param {unknown} data `{ projets, todos, sessions, pointage }` in version 1
 * @returns {unknown} `{ projects, todos, sessions, attendance }` in version 2
 */
export function v1ToV2(data) {
  if (!isRecord(data)) return data;
  const out = { ...data };
  for (const [from, to, convert] of COLLECTIONS) {
    if (!Object.hasOwn(data, from)) continue;
    const value = data[from];
    if (from !== to) delete out[from];
    out[to] = Array.isArray(value) ? value.map(convert) : value;
  }
  return out;
}

/**
 * Convert an entry of the version 1 workspace list.
 * @param {unknown} entry `{ id, label, creeLe, seedOnInit? }`
 * @param {number} now used when the entry has no creation time
 * @returns {{ workspace: { id: string; label: string; createdAt: number }; demo: boolean } | null}
 *   `demo` is false for a workspace created without demo data (`seedOnInit: false`);
 *   null when the entry has no usable id
 */
export function workspaceV1ToV2(entry, now) {
  if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id === '') return null;
  const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label : entry.id;
  const createdAt = typeof entry.creeLe === 'number' ? entry.creeLe : now;
  return { workspace: { id: entry.id, label, createdAt }, demo: entry.seedOnInit !== false };
}
