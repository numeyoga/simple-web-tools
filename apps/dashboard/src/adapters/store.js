/** @import { AppCommand, AppState, StoreEffect, WorkspaceData } from '../types.d.ts' */

// The application store of one workspace: the pure state machine of `core/store.js`, the
// IndexedDB database of the workspace, and the single-writer model (decision 0004).
//
// - One Web Lock for the whole app, `dashboard-write-lock`: the tab that holds it writes, every
//   other tab is read-only. A read-only tab refuses data commands (`onRefused`), re-reads the
//   database when the writer announces a write on `dashboard-sync-<id>`, and becomes the writer
//   when the lock is released.
// - Effects are queued and written in order, one transaction per batch, with the writes of the
//   same record coalesced. At most one write is in flight and the next one carries the latest
//   state. `flush()` resolves once everything dispatched so far is on disk; it also runs when the
//   tab is hidden or closed.

import {
  acquireWriteLock,
  createExportEnvelope,
  onWriteLockReleased,
  waitForWriteLock,
} from '@simple-web-tools/storage';
import { buildBackupData, BACKUP_APP, BACKUP_FORMAT, BACKUP_VERSION } from '../core/backup.js';
import { createStore as createCoreStore, isDataCommand } from '../core/store.js';
import {
  StorageError,
  applyEffects,
  openWorkspaceDatabase,
  readWorkspace,
  replaceWorkspace,
} from './idb.js';
import { nowIso } from './ids.js';
import { APP, channelName } from './names.js';
import { startingSettings } from './starting.js';

export { StorageError };

/**
 * The record an effect writes, as a key: `settings`, `template:<id>` or `app:<id>`.
 * @param {StoreEffect} effect
 * @returns {string}
 */
function recordKey(effect) {
  switch (effect.type) {
    case 'persist_settings':
      return 'settings';
    case 'persist_template':
      return `template:${effect.template.id}`;
    case 'remove_template':
      return `template:${effect.id}`;
    case 'persist_app':
      return `app:${effect.app.id}`;
    case 'remove_app':
      return `app:${effect.id}`;
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
    const read = await readWorkspace(db);
    core.dispatch({
      type: 'reload_data',
      payload: { ...read, settings: read.settings ?? startingSettings() },
    });
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
    const read = await readWorkspace(db);
    // A workspace that was never written has no settings yet: it starts with the default tags.
    const firstStart = read.settings === undefined;
    const data = { ...read, settings: read.settings ?? startingSettings() };
    core.dispatch({ type: 'hydrate', payload: { ...data, readOnly } });
    if (firstStart && !readOnly) {
      await applyEffects(db, [{ type: 'persist_settings', settings: core.getState().settings }]);
    }
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

  /* ---------------- backup ---------------- */

  /**
   * The backup file of the workspace (after the pending writes).
   * @returns {Promise<import('@simple-web-tools/storage').ExportEnvelope>}
   */
  async function exportBackup() {
    await flush();
    const { settings, templates, apps } = core.getState();
    return createExportEnvelope({
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: nowIso(),
      data: buildBackupData({ settings, templates, apps }),
    });
  }

  /**
   * Replaces everything the workspace holds with already validated data (an import, "clear all").
   * Writer only.
   * @param {WorkspaceData} data
   * @returns {Promise<boolean>} false when this tab is read-only: nothing was written
   */
  async function replaceAll(data) {
    if (core.getState().readOnly) {
      for (const listener of refusedListeners) listener();
      return false;
    }
    if (!db) throw new Error('The store is not open.');
    await flush();
    pending = [];
    await replaceWorkspace(db, data);
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
    exportBackup,
    replaceAll,
  };
}

/** @typedef {ReturnType<typeof createAppStore>} AppStore */
