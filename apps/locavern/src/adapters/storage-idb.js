/** @import { AppPreferences, AssetMeta, HydratePayload, LocalTemplate, Note, Project, StoreEffect, Task, TrashItem, Whiteboard } from '../types.d.ts' */

import { openDB } from 'idb';

const DB_NAME = 'locavern-db';
const DB_VERSION = 4;
const LOCK_NAME = 'locavern-write-lock';
const LOCK_CHANNEL = 'locavern-lock-channel';
const LAST_BACKUP_META_KEY = 'lastBackupAt';

/**
 * @typedef {AssetMeta & { readonly blob: Blob }} StoredAssetRecord
 */

/**
 * Open or initialize the Locavern IndexedDB database.
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export function openLocavernDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('whiteboards')) {
        db.createObjectStore('whiteboards', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trash')) {
        db.createObjectStore('trash', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
    },
  });
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
 * Notify other tabs via BroadcastChannel that the write lock was released.
 */
function broadcastLockRelease() {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(LOCK_CHANNEL);
    ch.postMessage({ type: 'lock-released' });
    ch.close();
  } catch {
    // Ignore broadcast errors.
  }
}

/**
 * Acquire an exclusive Web Lock for editing across browser tabs.
 * If another tab holds the lock, resolves immediately with { acquired: false }.
 * @returns {Promise<{ acquired: boolean; release: () => void }>}
 */
export function acquireWriteLock() {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return Promise.resolve({ acquired: true, release: () => {} });
  }

  return new Promise((resolve) => {
    let settled = false;
    navigator.locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (!lock) {
          settled = true;
          resolve({ acquired: false, release: () => {} });
          return undefined;
        }

        return new Promise((releaseLock) => {
          const release = () => {
            releaseLock(undefined);
            broadcastLockRelease();
          };
          settled = true;
          resolve({ acquired: true, release });
        });
      })
      .catch(() => {
        if (!settled) {
          resolve({ acquired: false, release: () => {} });
        }
      });
  });
}

/**
 * Wait in the Web Locks queue until the exclusive write lock becomes available
 * (handles abrupt tab closes or crashes where beforeunload does not fire).\n * @param {(handle: { acquired: true; release: () => void }) => void} onAcquired
 * @returns {() => void} Cancel function if the tab unloads before acquiring
 */
export function waitForWriteLock(onAcquired) {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return () => {};
  }

  const controller = new AbortController();
  navigator.locks
    .request(LOCK_NAME, { signal: controller.signal }, (lock) => {
      if (!lock) return undefined;
      return new Promise((releaseLock) => {
        const release = () => {
          releaseLock(undefined);
          broadcastLockRelease();
        };
        onAcquired({ acquired: true, release });
      });
    })
    .catch(() => {
      // Aborted or unavailable; ignore cleanly.
    });

  return () => controller.abort();
}

/**
 * Subscribe to cross-tab lock release notifications.
 * @param {() => void} onRelease
 * @returns {() => void}
 */
export function onWriteLockReleased(onRelease) {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  const ch = new BroadcastChannel(LOCK_CHANNEL);
  ch.addEventListener('message', (event) => {
    if (event.data?.type === 'lock-released') {
      onRelease();
    }
  });
  return () => ch.close();
}

/**
 * Request persistent storage and gather current quota usage.
 * @param {{ requestPersist?: boolean }} [opts]
 * @returns {Promise<{ supported: boolean; persisted: boolean; usageBytes: number | null; quotaBytes: number | null }>}
 */
export async function inspectStorageStatus(opts = {}) {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, persisted: false, usageBytes: null, quotaBytes: null };
  }
  let persisted;
  try {
    persisted = await navigator.storage.persisted();
    if (!persisted && opts.requestPersist && typeof navigator.storage.persist === 'function') {
      persisted = await navigator.storage.persist();
    }
  } catch {
    persisted = false;
  }

  let usageBytes = null;
  let quotaBytes = null;
  try {
    if (typeof navigator.storage.estimate === 'function') {
      const estimate = await navigator.storage.estimate();
      usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
      quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
    }
  } catch {
    usageBytes = null;
    quotaBytes = null;
  }

  return { supported: true, persisted, usageBytes, quotaBytes };
}
