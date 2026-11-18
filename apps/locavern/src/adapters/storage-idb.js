/** @import { AppPreferences, AssetMeta, HydratePayload, LocalTemplate, Note, Project, StoreEffect, Task, TrashItem, Whiteboard } from '../types.d.ts' */

import {
  acquireWriteLock as acquireAppWriteLock,
  createStoresIfMissing,
  databaseName,
  inspectStorageStatus as inspectStatus,
  onWriteLockReleased as onAppWriteLockReleased,
  openDatabase,
  waitForWriteLock as waitForAppWriteLock,
} from '@simple-web-tools/storage';

const APP_NAME = 'locavern';
// Persisted names are frozen: existing users' data lives under them (see tests/unit/storage-idb.test.js).
export const DB_NAME = databaseName(APP_NAME); // 'locavern-db'
const LAST_BACKUP_META_KEY = 'lastBackupAt';

/**
 * @typedef {AssetMeta & { readonly blob: Blob }} StoredAssetRecord
 */

/** Object stores of the version 1 to 3 databases. */
const BASE_STORES = ['meta', 'projects', 'tasks', 'notes', 'whiteboards', 'assets'].map((name) => ({
  name,
  keyPath: name === 'meta' ? 'key' : 'id',
}));

/** Every object store of the current schema (version 4). */
const ALL_STORES = [
  ...BASE_STORES,
  { name: 'trash', keyPath: 'id' },
  { name: 'templates', keyPath: 'id' },
];

/**
 * Schema history. Locavern shipped a single idempotent `upgrade` that created every missing
 * store whatever the version found on disk, so each step here is "create the stores that are
 * missing": a new database and a database at version 1, 2 or 3 all end with the same eight
 * stores, existing records untouched. Steps 0 to 2 only create the original stores. Step 3
 * (version 3 to 4) creates all of them, so it is the one that guarantees the final shape for
 * any older database, whatever exactly versions 1 to 3 contained. The version stays 4.
 * @type {readonly import('@simple-web-tools/storage').Migration[]}
 */
export const LOCAVERN_MIGRATIONS = [
  (db) => createStoresIfMissing(db, BASE_STORES),
  (db) => createStoresIfMissing(db, BASE_STORES),
  (db) => createStoresIfMissing(db, BASE_STORES),
  (db) => createStoresIfMissing(db, ALL_STORES),
];

/**
 * Open or initialize the Locavern IndexedDB database.
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export function openLocavernDb() {
  return openDatabase({ name: DB_NAME, migrations: LOCAVERN_MIGRATIONS });
}

/**
 * Load all persisted records from IndexedDB to hydrate the store.
 * @param {import('idb').IDBPDatabase} db
 * @returns {Promise<HydratePayload>}
 */
export async function loadHydrationPayload(db) {
  const tx = db.transaction(
    ['meta', 'projects', 'tasks', 'notes', 'whiteboards', 'assets', 'trash', 'templates'],
    'readonly',
  );
  const [prefRow, projects, tasks, notes, whiteboards, rawAssets, trash, templates] =
    await Promise.all([
      tx.objectStore('meta').get('preferences'),
      tx.objectStore('projects').getAll(),
      tx.objectStore('tasks').getAll(),
      tx.objectStore('notes').getAll(),
      tx.objectStore('whiteboards').getAll(),
      tx.objectStore('assets').getAll(),
      tx.objectStore('trash').getAll(),
      tx.objectStore('templates').getAll(),
    ]);
  await tx.done;

  /** @type {AssetMeta[]} */
  const assets = /** @type {StoredAssetRecord[]} */ (rawAssets).map((record) => ({
    id: record.id,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    filename: record.filename,
    createdAt: record.createdAt,
  }));

  /** @type {Partial<AppPreferences> | undefined} */
  const preferences = prefRow && typeof prefRow.value === 'object' ? prefRow.value : undefined;

  return {
    projects: /** @type {Project[]} */ (projects),
    tasks: /** @type {Task[]} */ (tasks),
    notes: /** @type {Note[]} */ (notes),
    whiteboards: /** @type {Whiteboard[]} */ (whiteboards),
    assets,
    trash: /** @type {TrashItem[]} */ (trash),
    templates: /** @type {LocalTemplate[]} */ (templates),
    preferences,
  };
}

/**
 * Read the ISO timestamp of the most recent local ZIP backup export, if any.
 * @param {import('idb').IDBPDatabase} db
 * @returns {Promise<string | null>}
 */
export async function getLastBackupAt(db) {
  const row = await db.get('meta', LAST_BACKUP_META_KEY);
  return row && typeof row.value === 'string' ? row.value : null;
}

/**
 * Persist or clear the ISO timestamp of the most recent ZIP backup export.
 * @param {import('idb').IDBPDatabase} db
 * @param {string | null} isoTimestamp
 */
export async function setLastBackupAt(db, isoTimestamp) {
  if (isoTimestamp === null) {
    await db.delete('meta', LAST_BACKUP_META_KEY);
    return;
  }
  await db.put('meta', { key: LAST_BACKUP_META_KEY, value: isoTimestamp });
}

/**
 * Persist a binary asset record (metadata + Blob) in IndexedDB.
 * @param {import('idb').IDBPDatabase} db
 * @param {AssetMeta} meta
 * @param {Blob} blob
 */
export async function saveAssetBlob(db, meta, blob) {
  await db.put('assets', { ...meta, blob });
}

/**
 * Retrieve a single asset Blob by id.
 * @param {import('idb').IDBPDatabase} db
 * @param {string} id
 * @returns {Promise<Blob | null>}
 */
export async function loadAssetBlob(db, id) {
  const record = /** @type {StoredAssetRecord | undefined} */ (await db.get('assets', id));
  return record?.blob ?? null;
}

/**
 * Retrieve all asset Blobs mapped by id.
 * @param {import('idb').IDBPDatabase} db
 * @returns {Promise<Map<string, Blob>>}
 */
export async function loadAllAssetBlobs(db) {
  const records = /** @type {StoredAssetRecord[]} */ (await db.getAll('assets'));
  /** @type {Map<string, Blob>} */
  const map = new Map();
  for (const r of records) {
    if (r.blob instanceof Blob) {
      map.set(r.id, r.blob);
    }
  }
  return map;
}

/**
 * Replace all collections + binary blobs atomically in IndexedDB.
 * @param {import('idb').IDBPDatabase} db
 * @param {{ projects: readonly Project[]; tasks: readonly Task[]; notes: readonly Note[]; whiteboards: readonly Whiteboard[]; assets: readonly AssetMeta[] }} payload
 * @param {ReadonlyMap<string, Blob>} blobs
 */
export async function replaceAllWithBlobs(db, payload, blobs) {
  const tx = db.transaction(
    ['meta', 'projects', 'tasks', 'notes', 'whiteboards', 'assets', 'trash'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('projects').clear(),
    tx.objectStore('tasks').clear(),
    tx.objectStore('notes').clear(),
    tx.objectStore('whiteboards').clear(),
    tx.objectStore('assets').clear(),
    tx.objectStore('trash').clear(),
  ]);
  await tx.objectStore('meta').put({ key: 'schema', schemaVersion: 2 });
  for (const p of payload.projects) {
    tx.objectStore('projects').put(p);
  }
  for (const t of payload.tasks) {
    tx.objectStore('tasks').put(t);
  }
  for (const n of payload.notes) {
    tx.objectStore('notes').put(n);
  }
  for (const w of payload.whiteboards) {
    tx.objectStore('whiteboards').put(w);
  }
  for (const a of payload.assets) {
    const blob = blobs.get(a.id);
    if (blob) {
      tx.objectStore('assets').put({ ...a, blob });
    }
  }
  await tx.done;
}

/**
 * Merge imported collections + binary blobs into IndexedDB without erasing existing records.
 * @param {import('idb').IDBPDatabase} db
 * @param {{ projects: readonly Project[]; tasks: readonly Task[]; notes: readonly Note[]; whiteboards: readonly Whiteboard[]; assets: readonly AssetMeta[] }} payload
 * @param {ReadonlyMap<string, Blob>} blobs
 */
export async function mergeWithBlobs(db, payload, blobs) {
  const tx = db.transaction(['projects', 'tasks', 'notes', 'whiteboards', 'assets'], 'readwrite');
  for (const p of payload.projects) {
    tx.objectStore('projects').put(p);
  }
  for (const t of payload.tasks) {
    tx.objectStore('tasks').put(t);
  }
  for (const n of payload.notes) {
    tx.objectStore('notes').put(n);
  }
  for (const w of payload.whiteboards) {
    tx.objectStore('whiteboards').put(w);
  }
  for (const a of payload.assets) {
    const blob = blobs.get(a.id);
    if (blob) {
      tx.objectStore('assets').put({ ...a, blob });
    }
  }
  await tx.done;
}

/**
 * Apply StoreEffects emitted by the pure store reducer to IndexedDB.
 * @param {import('idb').IDBPDatabase} db
 * @param {readonly StoreEffect[]} effects
 */
export async function applyStoreEffects(db, effects) {
  for (const effect of effects) {
    switch (effect.type) {
      case 'persist_project':
        await db.put('projects', effect.project);
        break;

      case 'remove_project': {
        const tx = db.transaction(['projects', 'tasks', 'notes', 'whiteboards'], 'readwrite');
        await tx.objectStore('projects').delete(effect.id);
        for (const taskId of effect.deletedTaskIds) {
          tx.objectStore('tasks').delete(taskId);
        }
        for (const note of effect.updatedNotes) {
          tx.objectStore('notes').put(note);
        }
        for (const wb of effect.updatedWhiteboards) {
          tx.objectStore('whiteboards').put(wb);
        }
        await tx.done;
        break;
      }

      case 'persist_task':
        await db.put('tasks', effect.task);
        break;

      case 'persist_tasks': {
        const tx = db.transaction('tasks', 'readwrite');
        for (const task of effect.tasks) {
          tx.objectStore('tasks').put(task);
        }
        await tx.done;
        break;
      }

      case 'remove_task':
        await db.delete('tasks', effect.id);
        break;

      case 'persist_note':
        await db.put('notes', effect.note);
        break;

      case 'remove_note':
        await db.delete('notes', effect.id);
        break;

      case 'persist_whiteboard':
        await db.put('whiteboards', effect.whiteboard);
        break;

      case 'remove_whiteboard':
        await db.delete('whiteboards', effect.id);
        break;

      case 'persist_asset_meta': {
        const existing = /** @type {StoredAssetRecord | undefined} */ (
          await db.get('assets', effect.asset.id)
        );
        if (existing) {
          await db.put('assets', { ...existing, ...effect.asset });
        }
        break;
      }

      case 'remove_asset':
        await db.delete('assets', effect.id);
        break;

      case 'persist_preferences':
        await db.put('meta', { key: 'preferences', value: effect.preferences });
        break;

      case 'persist_trash_item':
        await db.put('trash', effect.item);
        break;

      case 'persist_trash_items': {
        const tx = db.transaction('trash', 'readwrite');
        for (const item of effect.items) {
          tx.objectStore('trash').put(item);
        }
        await tx.done;
        break;
      }

      case 'remove_trash_item':
        await db.delete('trash', effect.id);
        break;

      case 'remove_trash_items': {
        const tx = db.transaction('trash', 'readwrite');
        for (const id of effect.ids) {
          tx.objectStore('trash').delete(id);
        }
        await tx.done;
        break;
      }

      case 'persist_template':
        await db.put('templates', effect.template);
        break;

      case 'remove_template':
        await db.delete('templates', effect.id);
        break;

      case 'persist_replace_all':
        // Handled explicitly via replaceAllWithBlobs so binary blobs are written atomically.
        break;

      case 'persist_merge':
        // Handled explicitly via mergeWithBlobs so binary blobs are written atomically.
        break;
    }
  }
}

/**
 * Acquire an exclusive Web Lock for editing across browser tabs.
 * If another tab holds the lock, resolves immediately with { acquired: false }.
 * @returns {Promise<{ acquired: boolean; release: () => void }>}
 */
export function acquireWriteLock() {
  return acquireAppWriteLock(APP_NAME);
}

/**
 * Wait in the Web Locks queue until the exclusive write lock becomes available
 * (handles abrupt tab closes or crashes where beforeunload does not fire).
 * @param {(handle: { acquired: true; release: () => void }) => void} onAcquired
 * @returns {() => void} Cancel function if the tab unloads before acquiring
 */
export function waitForWriteLock(onAcquired) {
  return waitForAppWriteLock(APP_NAME, onAcquired);
}

/**
 * Subscribe to cross-tab lock release notifications.
 * @param {() => void} onRelease
 * @returns {() => void}
 */
export function onWriteLockReleased(onRelease) {
  return onAppWriteLockReleased(APP_NAME, onRelease);
}

/**
 * Request persistent storage and gather current quota usage.
 * @param {{ requestPersist?: boolean }} [opts]
 * @returns {Promise<{ supported: boolean; persisted: boolean; usageBytes: number | null; quotaBytes: number | null }>}
 */
export function inspectStorageStatus(opts = {}) {
  return inspectStatus(opts);
}
