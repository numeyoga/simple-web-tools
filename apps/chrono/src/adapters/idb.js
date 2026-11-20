// IndexedDB helpers. One connection per page, on the active workspace's database, opened with
// `openDatabase` of @simple-web-tools/storage.
//
// Schema (version 3, English names; the table of the version 1 fields is in README.md):
//   projects   : { id, name, category, customColor, client, archived }
//                  category: 1..16 (Covenant palette) or null; customColor: '#rrggbb' or null;
//                  exactly one of the two is set.
//   todos      : { id, title, done, projectId, dueDate, createdAt, description }
//                  dueDate: null or local date 'YYYY-MM-DD' (absolute, independent of createdAt).
//                  Old data: relative labels ('today', 'tomorrow', 'mon'..'sun', 'week')
//                  converted on load by migrateRelativeDueDates().
//   sessions   : { id, projectId, description, start, lastStart, end, duration, status }
//                  status: 'done' | 'running' | 'paused'
//   attendance : { id, type, at, suspendedSessionIds }
//                  type: 'arrival' | 'break_start' | 'break_end' | 'departure'
//   meta       : { key, value }
//
// Migrations (the database version is the number of steps):
//   step 0, version 0 -> 1: the version 1 layout, exactly as the legacy `openDB()` created it
//   step 1, version 1 -> 2: converts the version 1 records (`v1ToV2`) inside the upgrade
//           transaction: `projets` and `pointage` become `projects` and `attendance`,
//           `todos` and `sessions` are rewritten in place.
//   step 2, version 2 -> 3: `v2ToV3` on the projects, inside the upgrade transaction: `color`
//           becomes `category` (a colour of the former palette) or `customColor`.
// A new database runs the three steps, so it converges with an existing older database. Steps 0
// and 1 are never edited: a database that skipped a release goes through each of them.

import { createStoresIfMissing, deleteDatabase, openDatabase } from '@simple-web-tools/storage';
import { v1ToV2, v2ToV3 } from '../core/migrations.js';
import { databaseNameFor, wsActiveId } from './workspace-list.js';

/** @typedef {import('@simple-web-tools/storage').Database} Database */
/** @typedef {import('@simple-web-tools/storage').Migration} Migration */
/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').CollectionName} CollectionName */

/** The version 1 layout. */
const V1_STORES = [
  { name: 'projets', keyPath: 'id' },
  { name: 'todos', keyPath: 'id' },
  { name: 'sessions', keyPath: 'id' },
  { name: 'pointage', keyPath: 'id' },
  { name: 'meta', keyPath: 'key' },
];
const V1_DATA_STORES = ['projets', 'todos', 'sessions', 'pointage'];
const STORES_V2 = /** @type {const} */ (['projects', 'todos', 'sessions', 'attendance']);

/**
 * Step 1: read the version 1 stores, create `projects` and `attendance`, delete `projets` and
 * `pointage`, rewrite `todos` and `sessions`. It only awaits requests of the upgrade transaction,
 * so the transaction stays alive until the last write. It returns its promise: the runner of
 * `openDatabase` starts step 2 after it, and aborts the upgrade if it rejects (nothing is
 * half-applied).
 * @type {Migration}
 */
function convertToV2(db, tx) {
  /** @param {string} name */
  const readAll = (name) =>
    db.objectStoreNames.contains(name) ? tx.objectStore(name).getAll() : Promise.resolve([]);
  const convert = async () => {
    const [projets, todos, sessions, pointage] = await Promise.all(V1_DATA_STORES.map(readAll));
    const v2 = /** @type {ChronoData} */ (v1ToV2({ projets, todos, sessions, pointage }));
    for (const name of ['projets', 'pointage']) {
      if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
    }
    for (const name of ['projects', 'attendance']) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
    }
    /** @type {Promise<unknown>[]} */
    const writes = [];
    for (const name of STORES_V2) {
      const store = tx.objectStore(name);
      for (const record of v2[name]) writes.push(store.put(record));
    }
    await Promise.all(writes);
  };
  // The runner of openDatabase waits for this promise before step 2, and aborts the upgrade
  // transaction when it rejects.
  return convert();
}

/**
 * Step 2: rewrite the projects with `v2ToV3`. Same pattern as step 1: only requests of the
 * upgrade transaction are awaited, and a rejection aborts it, so the database stays as it was.
 * The runner of openDatabase starts it once step 1 (when it runs) has settled, so `projects`
 * exists and holds the version 2 records.
 * @type {Migration}
 */
function convertToV3(_db, tx) {
  const convert = async () => {
    const store = tx.objectStore('projects');
    const v2 = await store.getAll();
    const v3 = /** @type {ChronoData} */ (v2ToV3({ projects: v2 }));
    await Promise.all(v3.projects.map((record) => store.put(record)));
  };
  return convert();
}

/** @type {readonly Migration[]} */
export const migrations = [(db) => createStoresIfMissing(db, V1_STORES), convertToV2, convertToV3];

/**
 * The database cannot be used: the page shows an error screen and writes nothing anywhere.
 * `blocked`: an older tab keeps a connection that prevents the upgrade of the database.
 * `unavailable`: IndexedDB is missing, refuses to open or does not answer.
 */
export class StorageError extends Error {
  /**
   * @param {'unavailable' | 'blocked'} code
   * @param {unknown} [cause]
   */
  constructor(code, cause) {
    super(code === 'blocked' ? 'IndexedDB blocked by another tab' : 'IndexedDB unavailable', {
      cause,
    });
    this.name = 'StorageError';
    this.code = code;
  }
}

/** How long an open may take before it counts as unavailable. */
const OPEN_TIMEOUT_MS = 8000;

/**
 * Open the database of a workspace, with the migrations. Rejects with a `StorageError` when
 * IndexedDB is missing or fails, when the open is blocked by another connection, or after
 * `timeoutMs` (0: no timeout).
 * @param {string} name
 * @param {number} timeoutMs
 * @returns {Promise<Database>}
 */
function openGuarded(name, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new StorageError('unavailable'));
      return;
    }
    let settled = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeout;
    /** @param {(value: never) => void} outcome @param {unknown} value */
    const settle = (outcome, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      outcome(/** @type {never} */ (value));
    };
    if (timeoutMs > 0) {
      timeout = setTimeout(() => settle(reject, new StorageError('unavailable')), timeoutMs);
    }
    /** @type {Promise<Database>} */
    let opening;
    try {
      opening = openDatabase({
        name,
        migrations,
        onBlocked: () => settle(reject, new StorageError('blocked')),
        // Another tab upgrades or deletes this database: the package closed our connection.
        onVersionChange: () => {
          dbPromise = null;
          location.reload();
        },
      });
    } catch (error) {
      settle(reject, new StorageError('unavailable', error));
      return;
    }
    opening.then(
      (db) => {
        if (settled)
          db.close(); // the caller gave up (timeout, blocked): do not leak it
        else settle(resolve, db);
      },
      (error) => settle(reject, new StorageError('unavailable', error)),
    );
  });
}

/** @type {Promise<Database> | null} */
let dbPromise = null;

/**
 * Opens (once) the active workspace's database. Rejects with a `StorageError`; a failed open
 * is not remembered.
 * @returns {Promise<Database>}
 */
export function openDB() {
  if (dbPromise) return dbPromise;
  const opening = openGuarded(databaseNameFor(wsActiveId()), OPEN_TIMEOUT_MS);
  dbPromise = opening;
  opening.catch(() => {
    if (dbPromise === opening) dbPromise = null;
  });
  return opening;
}

/**
 * Closes the shared connection (if any) and forgets it, so the next openDB() reopens.
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  if (db) db.close();
  dbPromise = null;
}

/**
 * All the records of a store of the active workspace.
 * @param {CollectionName} store
 * @returns {Promise<ChronoData[CollectionName]>}
 */
export async function idbAll(store) {
  const db = await openDB();
  return db.getAll(store);
}

/**
 * Differential write of a store: `put` the objects whose reference differs from the snapshot
 * `seen` (Map id -> object already written or read), `delete` the snapshot ids absent from
 * `items`. One transaction; does not touch objects added by another tab. Resolves to true
 * when something was written.
 * @param {CollectionName} store
 * @param {{ id: string }[]} items
 * @param {Map<string, unknown>} seen
 * @returns {Promise<boolean>}
 */
export async function idbSync(store, items, seen) {
  const db = await openDB();
  const ids = new Set(items.map((it) => it.id));
  const toWrite = items.filter((it) => seen.get(it.id) !== it);
  const toDelete = [...seen.keys()].filter((id) => !ids.has(id));
  if (!toWrite.length && !toDelete.length) return false;
  const tx = db.transaction(store, 'readwrite');
  await Promise.all([
    ...toWrite.map((it) => tx.store.put(it)),
    ...toDelete.map((id) => tx.store.delete(id)),
    tx.done,
  ]);
  return true;
}

/**
 * @param {CollectionName} store
 * @param {{ id: string }[]} items
 * @returns {Promise<boolean>}
 */
export async function idbBulkPut(store, items) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await Promise.all([...items.map((it) => tx.store.put(it)), tx.done]);
  return true;
}

/**
 * Deletes the whole database of a workspace (workspace removal).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export function idbDeleteDatabase(id) {
  return deleteDatabase(databaseNameFor(id));
}

/**
 * Opens a workspace's database directly (import), migrating it if needed. Rejects with a
 * `StorageError`. The caller closes it.
 * @param {string} id
 * @returns {Promise<Database>}
 */
export function openWorkspaceDatabase(id) {
  return openGuarded(databaseNameFor(id), OPEN_TIMEOUT_MS);
}
