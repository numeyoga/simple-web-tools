/** @import { AssetMeta, Folder, Note, StoreEffect, WorkspacePreferences } from '../types.d.ts' */

// IndexedDB: one database per workspace (`transient-notes__<id>`), opened with `openDatabase`
// of @simple-web-tools/storage.
//
// Schema (the database version is the number of migrations):
//   version 1   meta     { key, value }   key `preferences`: WorkspacePreferences
//               folders  Folder           { id, name, category, createdAt }
//               notes    Note             { id, title, doc, folderId, createdAt, updatedAt }
//               assets   { id, mime, size, createdAt, blob }   the Blob is stored next to its
//                        metadata (an IndexedDB Blob is a handle on a file: reading the records
//                        does not load the pictures)
// Adding a schema change means appending a migration and a test that opens a database written
// by the previous version. Never edit or reorder a step.

import { createStoresIfMissing, openDatabase } from '@simple-web-tools/storage';
import { databaseNameFor } from './names.js';

/** @typedef {import('@simple-web-tools/storage').Database} Database */
/** @typedef {import('@simple-web-tools/storage').Migration} Migration */

/** @type {readonly Migration[]} */
export const migrations = [
  (db) =>
    createStoresIfMissing(db, [
      { name: 'meta', keyPath: 'key' },
      { name: 'folders', keyPath: 'id' },
      { name: 'notes', keyPath: 'id' },
      { name: 'assets', keyPath: 'id' },
    ]),
];

/** The stores of the current schema. */
export const STORE_NAMES = /** @type {const} */ (['meta', 'folders', 'notes', 'assets']);

const PREFERENCES_KEY = 'preferences';

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
 * IndexedDB is missing or fails, when the open is blocked by another connection, or after the
 * timeout.
 * @param {string} workspaceId
 * @param {{ timeoutMs?: number, onVersionChange?: () => void }} [options] `onVersionChange`:
 *   another tab upgrades or deletes this database, the connection was closed (default: reload)
 * @returns {Promise<Database>}
 */
export function openWorkspaceDatabase(
  workspaceId,
  { timeoutMs = OPEN_TIMEOUT_MS, onVersionChange = () => location.reload() } = {},
) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
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
        name: databaseNameFor(workspaceId),
        migrations,
        onBlocked: () => settle(reject, new StorageError('blocked')),
        onVersionChange,
      });
    } catch (error) {
      settle(reject, new StorageError('unavailable', error));
      return;
    }
    opening.then(
      (db) => {
        // The caller gave up (timeout, blocked): do not leak the connection.
        if (settled) db.close();
        else settle(resolve, db);
      },
      (error) => settle(reject, new StorageError('unavailable', error)),
    );
  });
}

/**
 * What a workspace holds, as the state needs it: the records and the metadata of the assets
 * (no picture is read).
 * @param {Database} db
 * @returns {Promise<{ folders: Folder[], notes: Note[], assets: AssetMeta[], preferences: Partial<WorkspacePreferences> | undefined }>}
 */
export async function readWorkspace(db) {
  const tx = db.transaction(['meta', 'folders', 'notes', 'assets'], 'readonly');
  const [preferencesRow, folders, notes, assetRecords] = await Promise.all([
    tx.objectStore('meta').get(PREFERENCES_KEY),
    tx.objectStore('folders').getAll(),
    tx.objectStore('notes').getAll(),
    tx.objectStore('assets').getAll(),
  ]);
  await tx.done;
  const assets = /** @type {(AssetMeta & { blob?: Blob })[]} */ (assetRecords).map(
    ({ id, mime, size, createdAt }) => ({ id, mime, size, createdAt }),
  );
  const value = preferencesRow?.value;
  return {
    folders,
    notes,
    assets,
    preferences: value && typeof value === 'object' ? value : undefined,
  };
}

/**
 * The picture of an asset.
 * @param {Database} db
 * @param {string} id
 * @returns {Promise<Blob | null>}
 */
export async function readAssetBlob(db, id) {
  const record = /** @type {{ blob?: unknown } | undefined} */ (await db.get('assets', id));
  return record?.blob instanceof Blob ? record.blob : null;
}

/**
 * Every asset with its picture, for the backup.
 * @param {Database} db
 * @returns {Promise<{ meta: AssetMeta, blob: Blob }[]>}
 */
export async function readAllAssets(db) {
  const records = /** @type {(AssetMeta & { blob?: unknown })[]} */ (await db.getAll('assets'));
  return records.flatMap(({ id, mime, size, createdAt, blob }) =>
    blob instanceof Blob ? [{ meta: { id, mime, size, createdAt }, blob }] : [],
  );
}

/**
 * Runs the writes of one transaction and waits for it to commit. If building a write throws (a
 * record that cannot be stored), the transaction is aborted: without that, IndexedDB would
 * commit the writes made before the failure, and "all or nothing" would not hold.
 * @param {import('idb').IDBPTransaction<unknown, string[], 'readwrite'>} tx
 * @param {(write: (request: Promise<unknown>) => void) => void} build
 * @returns {Promise<void>}
 */
async function commit(tx, build) {
  /** @type {Promise<unknown>[]} */
  const requests = [];
  try {
    build((request) => {
      // Rejected when the transaction aborts: reported through `tx.done`, not as unhandled.
      request.catch(() => {});
      requests.push(request);
    });
    await Promise.all([...requests, tx.done]);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Already finished or aborted.
    }
    await tx.done.catch(() => {});
    throw error;
  }
}

/**
 * Writes effects in one transaction, in order: all of them or none.
 * @param {Database} db
 * @param {readonly StoreEffect[]} effects
 * @returns {Promise<void>}
 */
export async function applyEffects(db, effects) {
  if (effects.length === 0) return;
  const tx = db.transaction(['meta', 'folders', 'notes', 'assets'], 'readwrite');
  await commit(tx, (write) => {
    for (const effect of effects) {
      switch (effect.type) {
        case 'persist_folder':
          write(tx.objectStore('folders').put(effect.folder));
          break;
        case 'remove_folder':
          write(tx.objectStore('folders').delete(effect.id));
          break;
        case 'persist_note':
          write(tx.objectStore('notes').put(effect.note));
          break;
        case 'remove_note':
          write(tx.objectStore('notes').delete(effect.id));
          break;
        case 'persist_asset':
          write(tx.objectStore('assets').put({ ...effect.asset, blob: effect.blob }));
          break;
        case 'remove_asset':
          write(tx.objectStore('assets').delete(effect.id));
          break;
        case 'persist_preferences':
          write(tx.objectStore('meta').put({ key: PREFERENCES_KEY, value: effect.preferences }));
          break;
      }
    }
  });
}

/**
 * Replaces everything a workspace holds (an import): clears the stores of data, writes the new
 * records, keeps the preferences. One transaction: a failure leaves the workspace as it was.
 * @param {Database} db
 * @param {{ folders: readonly Folder[], notes: readonly Note[], assets: readonly { meta: AssetMeta, blob: Blob }[] }} data
 * @returns {Promise<void>}
 */
export async function replaceWorkspace(db, data) {
  const tx = db.transaction(['folders', 'notes', 'assets'], 'readwrite');
  await commit(tx, (write) => {
    write(tx.objectStore('folders').clear());
    write(tx.objectStore('notes').clear());
    write(tx.objectStore('assets').clear());
    for (const folder of data.folders) write(tx.objectStore('folders').put(folder));
    for (const note of data.notes) write(tx.objectStore('notes').put(note));
    for (const { meta, blob } of data.assets) {
      write(tx.objectStore('assets').put({ ...meta, blob }));
    }
  });
}
