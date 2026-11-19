// The localStorage fallback of the former releases, imported once into IndexedDB.
//
// Releases up to the port wrote the data to localStorage when IndexedDB was unavailable:
// `chrono-fallback-<id>-v2` (version 2 layout) or, before, `chrono.fallback.<id>.v1` (version 1
// layout, French field names). Chrono no longer writes it. When the database of a workspace opens
// and is empty, the data of such a key is copied into it one time, and the fact is recorded in
// the `meta` store so that it never happens again. The keys themselves are never deleted.

import { validateImport } from '../core/import-export.js';
import { v1ToV2 } from '../core/migrations.js';
import { fallbackKey, fallbackSkippedKey, legacyFallbackKey } from './names.js';
import { STORE_NAMES, readLegacyWorkspaces } from './workspace-list.js';

/** @typedef {import('@simple-web-tools/storage').Database} Database */
/** @typedef {import('../types.js').ChronoData} ChronoData */

/**
 * @param {string} key
 * @returns {unknown}
 */
function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

/**
 * The fallback data of a workspace in the version 2 layout; null when there is none. The
 * version 2 key wins; otherwise the version 1 key is converted (the id of a workspace repaired
 * during the migration of the list is looked up under its version 1 id).
 * @param {string} id
 * @returns {unknown}
 */
export function readFallback(id) {
  const current = readJson(fallbackKey(id));
  if (current) return current;
  const legacyId = readLegacyWorkspaces().find((w) => w.to === id)?.from ?? id;
  const legacy = readJson(legacyFallbackKey(legacyId));
  return legacy ? v1ToV2(legacy) : null;
}

/**
 * Remember that a removed workspace must not get its old fallback back if its id is reused.
 * @param {string} id
 */
export function skipFallbackOf(id) {
  try {
    const ids = readJson(fallbackSkippedKey());
    const list = Array.isArray(ids) ? ids : [];
    if (!list.includes(id))
      localStorage.setItem(fallbackSkippedKey(), JSON.stringify([...list, id]));
  } catch {
    /* nothing to remember */
  }
}

/** @param {string} id */
function isSkipped(id) {
  const ids = readJson(fallbackSkippedKey());
  return Array.isArray(ids) && ids.includes(id);
}

/**
 * Imports the fallback of workspace `id` into its (open) database, once.
 * - Nothing happens when `meta` already says the fallback was dealt with, when the workspace
 *   was removed, or when there is no fallback key.
 * - When the database already holds data, the fallback is not imported, and `meta` records
 *   that it was skipped, so that emptying the workspace later does not bring it back.
 * - Otherwise the data is validated, written with the `fallbackImported` record in one
 *   transaction.
 * @param {Database} db
 * @param {string} id
 * @param {number} now
 * @returns {Promise<boolean>} whether data was imported
 */
export async function importFallbackOnce(db, id, now) {
  if (isSkipped(id)) return false;
  const [imported, skipped] = await Promise.all([
    db.get('meta', 'fallbackImported'),
    db.get('meta', 'fallbackSkipped'),
  ]);
  if (imported || skipped) return false;
  const raw = readFallback(id);
  if (!raw) return false;

  const counts = await Promise.all(STORE_NAMES.map((name) => db.count(name)));
  if (counts.some((count) => count > 0)) {
    await db.put('meta', { key: 'fallbackSkipped', value: now });
    return false;
  }
  /** @type {ChronoData} */
  let data;
  try {
    data = validateImport(raw, now);
  } catch (error) {
    console.warn('[db] the localStorage fallback is unusable, not imported', error);
    return false;
  }
  const tx = db.transaction([...STORE_NAMES, 'meta'], 'readwrite');
  for (const name of STORE_NAMES) {
    for (const record of data[name]) tx.objectStore(name).put(record);
  }
  tx.objectStore('meta').put({ key: 'fallbackImported', value: now });
  await tx.done;
  return true;
}
