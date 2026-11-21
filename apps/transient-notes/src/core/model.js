/** @import { AssetMeta, Folder, Note, ParaCategory, SortKey, WorkspacePreferences } from '../types.d.ts' */

// The data model: the PARA categories, how a folder, a note and an asset are made, and how data
// read from storage or from a backup file is cleaned. Pure: no clock (timestamps are arguments),
// no id generation (ids are arguments), no DOM.

import {
  ALLOWED_IMAGE_MIMES,
  EMPTY_RICH_DOC,
  collectDocAssetIds,
  sanitizeRichTextDoc,
} from '@simple-web-tools/rich-text';

/** The PARA categories, in the order they are shown. A fixed list: users do not add categories. */
export const PARA_CATEGORIES = /** @type {readonly ParaCategory[]} */ (
  Object.freeze(['projects', 'areas', 'resources', 'archives'])
);

export const SORT_KEYS = /** @type {readonly SortKey[]} */ (
  Object.freeze(['updated', 'created', 'title'])
);

export const DEFAULT_PREFERENCES = /** @type {WorkspacePreferences} */ (
  Object.freeze({ sort: 'updated' })
);

/** The timestamp given to a stored record that has no valid date. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

/** The largest picture a note accepts, in bytes (10 MiB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const MAX_FOLDER_NAME_LENGTH = 80;
export const MAX_NOTE_TITLE_LENGTH = 200;

/**
 * @param {unknown} value
 * @returns {value is ParaCategory}
 */
export function isParaCategory(value) {
  return typeof value === 'string' && PARA_CATEGORIES.includes(/** @type {ParaCategory} */ (value));
}

/**
 * @param {unknown} value
 * @returns {SortKey}
 */
export function normalizeSort(value) {
  return SORT_KEYS.includes(/** @type {SortKey} */ (value))
    ? /** @type {SortKey} */ (value)
    : DEFAULT_PREFERENCES.sort;
}

/**
 * A folder name: whitespace collapsed, trimmed and cut to the maximum length. Empty when the
 * input is not a usable name.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeFolderName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_FOLDER_NAME_LENGTH).trim();
}

/**
 * A note title: line breaks become spaces, cut to the maximum length. It may be empty. Spaces
 * are kept as typed (a view that writes the stored title back into a focused field would
 * otherwise eat the space typed after a word); the readers of a title trim it.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeNoteTitle(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\r\n]+/g, ' ').slice(0, MAX_NOTE_TITLE_LENGTH);
}

/**
 * A valid ISO 8601 timestamp, or the fallback.
 * @param {unknown} raw
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeTimestamp(raw, fallback) {
  return typeof raw === 'string' && raw !== '' && !Number.isNaN(Date.parse(raw)) ? raw : fallback;
}

/**
 * @param {{ id: string, name: string, category: ParaCategory, now: string }} input
 * @returns {Folder}
 */
export function createFolder({ id, name, category, now }) {
  return { id, name: normalizeFolderName(name), category, createdAt: now };
}

/**
 * A new, empty note.
 * @param {{ id: string, now: string, folderId: string | null }} input
 * @returns {Note}
 */
export function createNote({ id, now, folderId }) {
  return { id, title: '', doc: EMPTY_RICH_DOC, folderId, createdAt: now, updatedAt: now };
}

/**
 * Clean a folder read from storage or from a file. `null` when it cannot be one.
 * @param {unknown} raw
 * @param {string} fallbackNow timestamp for a missing or invalid `createdAt`
 * @returns {Folder | null}
 */
export function sanitizeFolder(raw, fallbackNow) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, name, category, createdAt } = /** @type {Record<string, unknown>} */ (raw);
  if (typeof id !== 'string' || id === '' || !isParaCategory(category)) return null;
  const cleanName = normalizeFolderName(name);
  if (cleanName === '') return null;
  return { id, name: cleanName, category, createdAt: normalizeTimestamp(createdAt, fallbackNow) };
}

/**
 * Clean a note read from storage or from a file. `null` when it cannot be one. A folder id is
 * kept as is: the caller checks it against the folders it holds.
 * @param {unknown} raw
 * @param {string} fallbackNow timestamp for a missing or invalid date
 * @returns {Note | null}
 */
export function sanitizeNote(raw, fallbackNow) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, title, doc, folderId, createdAt, updatedAt } =
    /** @type {Record<string, unknown>} */ (raw);
  if (typeof id !== 'string' || id === '') return null;
  const created = normalizeTimestamp(createdAt, fallbackNow);
  return {
    id,
    title: normalizeNoteTitle(title),
    doc: sanitizeRichTextDoc(doc),
    folderId: typeof folderId === 'string' && folderId !== '' ? folderId : null,
    createdAt: created,
    updatedAt: normalizeTimestamp(updatedAt, created),
  };
}

/**
 * Clean the metadata of an asset. `null` when it cannot be one: only the raster image types of
 * `ALLOWED_IMAGE_MIMES` are accepted.
 * @param {unknown} raw
 * @param {string} fallbackNow
 * @returns {AssetMeta | null}
 */
export function sanitizeAssetMeta(raw, fallbackNow) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, mime, size, createdAt } = /** @type {Record<string, unknown>} */ (raw);
  if (typeof id !== 'string' || id === '') return null;
  if (typeof mime !== 'string' || !ALLOWED_IMAGE_MIMES.has(/** @type {never} */ (mime))) {
    return null;
  }
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return null;
  return {
    id,
    mime,
    size: Math.trunc(size),
    createdAt: normalizeTimestamp(createdAt, fallbackNow),
  };
}

/**
 * Keep the first record of each id.
 * @template {{ id: string }} T
 * @param {readonly (T | null)[]} items
 * @returns {T[]}
 */
export function uniqueById(items) {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {T[]} */
  const out = [];
  for (const item of items) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Cleaned folders, notes and assets from raw records, as `hydrate` and `reload_data` need
 * them: invalid records and duplicate ids are dropped, a note whose folder does not exist is
 * left with no folder, and an asset that no longer has valid metadata is dropped.
 * @param {{ folders?: unknown, notes?: unknown, assets?: unknown }} raw
 * @param {string} fallbackNow
 * @returns {{ folders: Folder[], notes: Note[], assets: AssetMeta[] }}
 */
export function cleanWorkspaceData(raw, fallbackNow) {
  const list = (/** @type {unknown} */ value) => (Array.isArray(value) ? value : []);
  const folders = uniqueById(list(raw.folders).map((f) => sanitizeFolder(f, fallbackNow)));
  const folderIds = new Set(folders.map((f) => f.id));
  const notes = uniqueById(list(raw.notes).map((n) => sanitizeNote(n, fallbackNow))).map((note) =>
    note.folderId !== null && !folderIds.has(note.folderId) ? { ...note, folderId: null } : note,
  );
  const assets = uniqueById(list(raw.assets).map((a) => sanitizeAssetMeta(a, fallbackNow)));
  return { folders, notes, assets };
}

/**
 * The ids of the assets that at least one note references.
 * @param {readonly Note[]} notes
 * @returns {Set<string>}
 */
export function referencedAssetIds(notes) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const note of notes) {
    for (const id of collectDocAssetIds(note.doc)) ids.add(id);
  }
  return ids;
}

/**
 * Why a picture cannot be added to a note, or `null` when it can: only the raster types of
 * `ALLOWED_IMAGE_MIMES`, and at most `MAX_IMAGE_BYTES`.
 * @param {{ type: string, size: number }} file
 * @returns {'unsupported-type' | 'too-large' | null}
 */
export function validateImage({ type, size }) {
  if (!ALLOWED_IMAGE_MIMES.has(/** @type {never} */ (type)) || !(size > 0)) {
    return 'unsupported-type';
  }
  return size > MAX_IMAGE_BYTES ? 'too-large' : null;
}
