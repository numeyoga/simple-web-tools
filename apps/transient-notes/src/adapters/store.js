/** @import { AppCommand, AppState, AssetMeta, StoreEffect } from '../types.d.ts' */

// The application store of one workspace: the pure state machine of `core/store.js`, the
// IndexedDB database of the workspace, and the single-writer model (decision 0004).
//
// - One Web Lock for the whole app, `transient-notes-write-lock`: the tab that holds it writes,
//   every other tab is read-only. A read-only tab refuses data commands (`onRefused`), re-reads
//   the database when the writer announces a write on `transient-notes-sync-<id>`, and becomes
//   the writer when the lock is released.
// - Effects are queued and written in order, one transaction per batch, with the writes of the
//   same record coalesced: a view may dispatch `update_note` after every keystroke, at most one
//   write is in flight and the next one carries the latest text. `flush()` resolves once
//   everything dispatched so far is on disk; it also runs when the tab is hidden or closed.

import { acquireWriteLock, onWriteLockReleased, waitForWriteLock } from '@simple-web-tools/storage';
import { validateImage } from '../core/model.js';
import { createStore as createCoreStore, isDataCommand } from '../core/store.js';
import { buildBackup } from './backup.js';
import {
  StorageError,
  applyEffects,
  openWorkspaceDatabase,
  readAllAssets,
  readAssetBlob,
  readWorkspace,
  replaceWorkspace,
} from './idb.js';
import { newId, nowIso } from './ids.js';
import { APP, channelName } from './names.js';

export { StorageError };

/**
 * The record an effect writes, as a key: `folder:<id>`, `note:<id>`, `asset:<id>`, `preferences`.
 * @param {StoreEffect} effect
 * @returns {string}
 */
function recordKey(effect) {
  switch (effect.type) {
    case 'persist_folder':
      return `folder:${effect.folder.id}`;
    case 'remove_folder':
      return `folder:${effect.id}`;
    case 'persist_note':
      return `note:${effect.note.id}`;
    case 'remove_note':
      return `note:${effect.id}`;
    case 'persist_asset':
      return `asset:${effect.asset.id}`;
    case 'remove_asset':
      return `asset:${effect.id}`;
    case 'persist_preferences':
      return 'preferences';
  }
}

/**
 * One effect per record: a later write of a record replaces an earlier one, and a removal
 * replaces a write. The order of the last write of each record is kept.
 * @param {readonly StoreEffect[]} effects
 * @returns {StoreEffect[]}
 */
export function coalesceEffects(effects) {
  /** @type {Map<string, StoreEffect>} */
  const byRecord = new Map();
  for (const effect of effects) {
    const key = recordKey(effect);
    byRecord.delete(key);
    byRecord.set(key, effect);
  }
  return [...byRecord.values()];
}

/**
 * @param {{ workspaceId: string }} options the workspace whose database the store opens
 */
export function createAppStore({ workspaceId }) {
  const core = createCoreStore();
  /** @type {import('@simple-web-tools/storage').Database | null} */
  let db = null;
  /** @type {BroadcastChannel | null} */
  let channel = null;
  /** @type {StoreEffect[]} */
  let pending = [];
  /** @type {Promise<void> | null} */
  let writing = null;
  let writeFailed = false;
  /** Pictures added in this session, available before they reach the database. @type {Map<string, Blob>} */
  const sessionBlobs = new Map();
  /** @type {Map<string, string>} */
  const objectUrls = new Map();

  /** @type {Set<() => void>} */
  const refusedListeners = new Set();
  /** @type {Set<(error: unknown) => void>} */
  const writeErrorListeners = new Set();

  /** @type {() => void} */
  let cancelLockWait = () => {};
  /** @type {() => void} */
  let stopLockListener = () => {};
  /** @type {(() => void) | null} */
  let releaseLock = null;

  /* ---------------- writing ---------------- */

  /** Tells the read-only tabs of this workspace that the database changed. */
  function announceChange() {
    try {
      channel?.postMessage('update');
    } catch {
      // The tabs re-read at their next start.
    }
  }

  async function drain() {
    while (pending.length > 0 && db) {
      const batch = coalesceEffects(pending);
      pending = [];
      try {
        await applyEffects(db, batch);
        for (const effect of batch) {
          if (effect.type === 'persist_asset') sessionBlobs.delete(effect.asset.id);
        }
        announceChange();
      } catch (error) {
        // Keep what was not written; the next dispatch or flush tries again.
        pending = [...batch, ...pending];
        writeFailed = true;
        for (const listener of writeErrorListeners) listener(error);
        return;
      }
    }
  }

  function startWriting() {
    if (writing) return;
    writing = drain().finally(() => {
      writing = null;
      if (pending.length > 0 && !writeFailed) startWriting();
    });
  }

  /**
   * Resolves once every effect dispatched so far is written (or has failed: see `onWriteError`).
   * @returns {Promise<void>}
   */
  async function flush() {
    writeFailed = false;
    startWriting();
    while (writing) await writing;
  }

  /* ---------------- reading ---------------- */

  async function readIntoState() {
    if (!db) return;
    const data = await readWorkspace(db);
    core.dispatch({ type: 'reload_data', payload: data });
  }

  /** The writer announced a change: a read-only tab re-reads the database. */
  async function reloadFromStorage() {
    if (!core.getState().readOnly) return;
    await readIntoState();
  }

  /**
   * This tab gets the write lock: it re-reads the database (the former writer may have written
   * until its last moment) and starts to write.
   * @param {{ release: () => void }} granted
   */
  async function promote(granted) {
    if (!core.getState().readOnly) {
      granted.release();
      return;
    }
    cancelLockWait();
    cancelLockWait = () => {};
    releaseLock = granted.release;
    // Read first: the tab must not act on a state older than the former writer's last write.
    await readIntoState();
    core.dispatch({ type: 'set_read_only', readOnly: false });
  }

  async function retryAcquireLock() {
    if (!core.getState().readOnly) return;
    const next = await acquireWriteLock(APP);
    if (next.acquired) await promote(next);
  }

  /**
   * "Resume editing" of the banner: takes the write lock if the other tab let it go.
   * @returns {Promise<boolean>} whether this tab is now the writer
   */
  async function retryWriteLock() {
    await retryAcquireLock();
    return !core.getState().readOnly;
  }

  /**
   * Takes the lock, opens the database of the workspace and fills the state. Rejects with a
   * `StorageError` (and gives the lock back) when the database cannot be used.
   * @returns {Promise<void>}
   */
  async function init() {
    const handle = await acquireWriteLock(APP);
    const readOnly = !handle.acquired;
    if (!readOnly) releaseLock = handle.release;
    try {
      db = await openWorkspaceDatabase(workspaceId);
    } catch (error) {
      handle.release(); // nothing was written: let another tab try
      releaseLock = null;
      throw error;
    }
    const data = await readWorkspace(db);
    core.dispatch({ type: 'hydrate', payload: { ...data, readOnly } });
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName(workspaceId));
      channel.onmessage = () => {
        void reloadFromStorage();
      };
    }
    if (readOnly) {
      cancelLockWait = waitForWriteLock(APP, (granted) => {
        void promote(granted);
      });
      stopLockListener = onWriteLockReleased(APP, () => {
        void retryAcquireLock();
      });
    } else {
      // Pictures that no note uses any more (an edit removed them): safe to drop at start.
      dispatch({ type: 'purge_orphaned_assets' });
    }
  }

  /* ---------------- commands ---------------- */

  /**
   * Applies a command. A data command in a read-only tab is refused: nothing changes and the
   * `onRefused` listeners are told.
   * @param {AppCommand} command
   * @returns {{ state: AppState, effects: StoreEffect[] }}
   */
  function dispatch(command) {
    const state = core.getState();
    if (state.readOnly && isDataCommand(command.type)) {
      for (const listener of refusedListeners) listener();
      return { state, effects: [] };
    }
    const result = core.dispatch(command);
    if (result.effects.length > 0 && db) {
      pending.push(...result.effects);
      writeFailed = false;
      startWriting();
    }
    return result;
  }

  /**
   * Stores a picture (pasted, dropped or picked) as an asset of the workspace.
   * @param {Blob} file
   * @returns {{ asset: AssetMeta } | { error: 'unsupported-type' | 'too-large' | 'read-only' }}
   */
  function addImage(file) {
    if (core.getState().readOnly) {
      for (const listener of refusedListeners) listener();
      return { error: 'read-only' };
    }
    const error = validateImage({ type: file.type, size: file.size });
    if (error) return { error };
    /** @type {AssetMeta} */
    const asset = { id: newId(), mime: file.type, size: file.size, createdAt: nowIso() };
    sessionBlobs.set(asset.id, file);
    dispatch({ type: 'add_asset', asset, blob: file });
    return { asset };
  }

  /**
   * The picture of an asset: the one added in this session if it is not written yet, else the
   * one in the database.
   * @param {string} id
   * @returns {Promise<Blob | null>}
   */
  async function getAssetBlob(id) {
    const local = sessionBlobs.get(id);
    if (local) return local;
    return db ? readAssetBlob(db, id) : null;
  }

  /**
   * A `blob:` URL for an asset, for an `<img>` (the CSP allows `img-src blob:`). One URL per
   * asset, kept until `revokeAssetUrls`.
   * @param {string} id
   * @returns {Promise<string | null>}
   */
  async function getAssetUrl(id) {
    const known = objectUrls.get(id);
    if (known) return known;
    const blob = await getAssetBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrls.set(id, url);
    return url;
  }

  function revokeAssetUrls() {
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear();
  }

  /* ---------------- backup ---------------- */

  /**
   * The backup file of the workspace (after the pending writes), with the pictures inside.
   * @returns {Promise<import('@simple-web-tools/storage').ExportEnvelope>}
   */
  async function exportBackup() {
    await flush();
    if (!db) throw new Error('The store is not open.');
    const { folders, notes } = core.getState();
    return buildBackup({ folders, notes, assets: await readAllAssets(db) }, nowIso());
  }

  /**
   * Replaces everything the workspace holds with a validated backup (see `readBackup`). Writer
   * only. The caller reloads the page afterwards, as the views were built on the old data.
   * @param {import('./backup.js').WorkspaceContent} content
   * @returns {Promise<boolean>} false when this tab is read-only: nothing was written
   */
  async function replaceAll(content) {
    if (core.getState().readOnly) {
      for (const listener of refusedListeners) listener();
      return false;
    }
    if (!db) throw new Error('The store is not open.');
    await flush();
    pending = [];
    await replaceWorkspace(db, content);
    sessionBlobs.clear();
    revokeAssetUrls();
    announceChange();
    await readIntoState();
    return true;
  }

  /* ---------------- life cycle ---------------- */

  function flushNow() {
    if (core.getState().readOnly) return;
    void flush();
  }

  /** @param {PageTransitionEvent} event */
  function onPageHide(event) {
    flushNow();
    if (event.persisted) return;
    cancelLockWait();
    stopLockListener();
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') flushNow();
  }
  const hasPage = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (hasPage) {
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
  }

  /** Stops listening, closes the database and gives the lock back (tests, workspace switch). */
  async function close() {
    if (hasPage) {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    }
    cancelLockWait();
    stopLockListener();
    await flush();
    revokeAssetUrls();
    channel?.close();
    channel = null;
    db?.close();
    db = null;
    releaseLock?.();
    releaseLock = null;
  }

  return {
    workspaceId,
    init,
    close,
    getState: core.getState,
    subscribe: core.subscribe,
    dispatch,
    flush,
    /** @param {() => void} listener @returns {() => void} */
    onRefused(listener) {
      refusedListeners.add(listener);
      return () => refusedListeners.delete(listener);
    },
    /** @param {(error: unknown) => void} listener @returns {() => void} */
    onWriteError(listener) {
      writeErrorListeners.add(listener);
      return () => writeErrorListeners.delete(listener);
    },
    retryWriteLock,
    reloadFromStorage,
    addImage,
    getAssetBlob,
    getAssetUrl,
    revokeAssetUrls,
    exportBackup,
    replaceAll,
  };
}

/** @typedef {ReturnType<typeof createAppStore>} AppStore */
