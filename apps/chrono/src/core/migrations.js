// Schema migrations, pure: version 1 (French field names) to version 2 (English field names),
// then version 2 to version 3 (a project colour is a category number or a free colour).
// The same functions serve the IndexedDB upgrade (adapters/idb.js), the JSON import
// (adapters/backup.js), the localStorage fallback and the workspace list. The field table is in
// README.md.
//
// Rules: a field that is not in the tables, and anything that is not a record, is kept as it
// is (the validation of the import drops what is unusable, the migration never loses data).

import { isCategory, nextCategory, normalizeHex } from './categories.js';

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
 * The 16 colours of Chrono's own palette (version 2), in the order of the Covenant categories:
 * the position is the category number minus one. This table is the only place where a colour
 * is written as a hex value.
 * @type {readonly string[]}
 */
export const V2_PALETTE = Object.freeze([
  '#ea580c', // 1 orange
  '#d97706', // 2 amber
  '#ca8a04', // 3 yellow
  '#65a30d', // 4 lime
  '#16a34a', // 5 green
  '#0d9488', // 6 teal
  '#0891b2', // 7 cyan
  '#0284c7', // 8 sky
  '#2563eb', // 9 blue
  '#4f46e5', // 10 indigo
  '#7c3aed', // 11 violet
  '#9333ea', // 12 purple
  '#c026d3', // 13 fuchsia
  '#db2777', // 14 pink
  '#e11d48', // 15 rose
  '#475569', // 16 slate
]);

/**
 * The colour of a version 2 project as a version 3 choice. A palette colour becomes its
 * category number; any other valid hex stays a free colour (never changed to the nearest
 * category); anything else is `null`, left to the caller.
 * @param {unknown} color
 * @returns {{ category: number, customColor: null } | { category: null, customColor: string } | null}
 */
export function colorV2ToV3(color) {
  const hex = normalizeHex(color);
  if (hex === null) return null;
  const index = V2_PALETTE.indexOf(hex);
  return index >= 0
    ? { category: index + 1, customColor: null }
    : { category: null, customColor: hex };
}

/**
 * Convert the data of a workspace from version 2 to version 3: each project loses `color` and
 * gets `category` (1 to 16) or `customColor` (`#rrggbb`), exactly one of them. A project with
 * no usable colour takes the next category of the default order, after the projects that keep
 * theirs (so that it does not repeat the colour of an active project while one is free). A
 * project that already has a category or a free colour and no `color` is left as it is. Only the
 * `projects` collection changes; other keys and non-record projects are kept. Does not mutate
 * its input.
 * @param {unknown} data `{ projects, todos, sessions, attendance }` in version 2
 * @returns {unknown} the same in version 3
 */
export function v2ToV3(data) {
  if (!isRecord(data) || !Array.isArray(data.projects)) return data;
  /** @type {number[]} */
  const pending = [];
  const projects = data.projects.map((project, index) => {
    if (!isRecord(project)) return project;
    const { color, ...rest } = project;
    if (isCategory(rest.category)) return { ...rest, customColor: null };
    const custom = normalizeHex(rest.customColor);
    if (!Object.hasOwn(project, 'color') && custom !== null) {
      return { ...rest, category: null, customColor: custom };
    }
    const choice = colorV2ToV3(color);
    if (choice === null) pending.push(index);
    return { ...rest, ...(choice ?? { category: null, customColor: null }) };
  });
  for (const index of pending) {
    const project = /** @type {Record<string, unknown>} */ (projects[index]);
    project.category = nextCategory(
      /** @type {{ category?: unknown, archived?: unknown }[]} */ (projects).map((p) => ({
        category: isRecord(p) && isCategory(p.category) ? p.category : null,
        archived: isRecord(p) && p.archived === true,
      })),
    );
  }
  return { ...data, projects };
}

/** Longest workspace id the registry of @simple-web-tools/storage accepts. */
const MAX_WORKSPACE_ID_LENGTH = 40;
const VALID_WORKSPACE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A valid workspace id derived from a legacy one that the registry refuses (a trailing hyphen
 * left by the 40-character cut, a `--` before a duplicate suffix, more than 40 characters), and
 * different from every id in `taken`. A valid legacy id is returned as it is.
 * @param {string} legacyId
 * @param {ReadonlySet<string>} taken ids already in use
 * @returns {string}
 */
export function validWorkspaceId(legacyId, taken) {
  if (
    legacyId.length <= MAX_WORKSPACE_ID_LENGTH &&
    VALID_WORKSPACE_ID.test(legacyId) &&
    !taken.has(legacyId)
  ) {
    return legacyId;
  }
  const words = legacyId
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const slug = words
    .join('-')
    .slice(0, MAX_WORKSPACE_ID_LENGTH)
    .split('-')
    .filter(Boolean)
    .join('-');
  const base = slug || 'workspace';
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate =
      base.slice(0, MAX_WORKSPACE_ID_LENGTH - suffix.length).replace(/-+$/, '') + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Convert the version 1 workspace list. An entry whose id the registry would refuse gets a
 * valid, unique id, and is listed in `renames` so that its database `chrono__<from>` can be
 * copied to the new name. Entries without a usable id are skipped.
 * @param {unknown[]} entries version 1 entries `{ id, label, creeLe, seedOnInit? }`
 * @param {number} now used when an entry has no creation time
 * @returns {{
 *   workspaces: { id: string; label: string; createdAt: number }[];
 *   renames: { from: string; to: string }[];
 * }}
 */
export function planLegacyWorkspaces(entries, now) {
  const parsed = entries.map((entry) => workspaceV1ToV2(entry, now)).filter((e) => e !== null);
  // Ids that are fine as they are keep their name: the renames only take the ids that remain.
  const taken = new Set(
    parsed
      .map((w) => w.id)
      .filter((id) => id.length <= MAX_WORKSPACE_ID_LENGTH && VALID_WORKSPACE_ID.test(id)),
  );
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {{ id: string; label: string; createdAt: number }[]} */
  const workspaces = [];
  /** @type {{ from: string; to: string }[]} */
  const renames = [];
  for (const entry of parsed) {
    const valid = taken.has(entry.id);
    if (valid && seen.has(entry.id)) continue; // a duplicate id: the first entry wins
    const id = valid ? entry.id : validWorkspaceId(entry.id, new Set([...taken, ...seen]));
    seen.add(id);
    if (!valid) renames.push({ from: entry.id, to: id });
    workspaces.push({ ...entry, id });
  }
  return { workspaces, renames };
}

/**
 * Convert an entry of the version 1 workspace list.
 * @param {unknown} entry `{ id, label, creeLe, seedOnInit? }` (`seedOnInit`, the demo data of
 *   a first start, is not read: the demo data is never loaded automatically)
 * @param {number} now used when the entry has no creation time
 * @returns {{ id: string; label: string; createdAt: number } | null} null when the entry has
 *   no usable id
 */
export function workspaceV1ToV2(entry, now) {
  if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id === '') return null;
  const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label : entry.id;
  const createdAt = typeof entry.creeLe === 'number' ? entry.creeLe : now;
  return { id: entry.id, label, createdAt };
}
