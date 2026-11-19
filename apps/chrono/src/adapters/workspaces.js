// Workspace API (list, create, rename, remove, switch), JSON import and download.
// The list and the active id are in localStorage, managed by the registry (workspace-list.js).
// The import, the creation with demo data and the removal write to IndexedDB: only the tab that
// holds the write lock may call them (the views disable them in a read-only tab).

import { formatLocalDate } from '../core/dates.js';
import { readExport } from './backup.js';
import { seed } from '../core/seed.js';
import { skipFallbackOf } from './fallback.js';
import { closeDatabase, idbDeleteDatabase, openWorkspaceDatabase } from './idb.js';
import { channelName } from './names.js';
import {
  STORE_NAMES,
  getRegistry,
  wsActive,
  wsActiveId,
  wsLoadList,
  wsSetActiveId,
} from './workspace-list.js';

/**
 * Tells the other tabs of workspace `id` that its database changed (they re-read it).
 * @param {string} id
 */
function announceChange(id) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const c = new BroadcastChannel(channelName(id));
    c.postMessage('update');
    c.close();
  } catch {
    /* ignore */
  }
}

/**
 * Replaces the data of workspace `id` with a validated import. Only the writer tab calls it.
 * Rejects with a `StorageError` when the database cannot be opened: nothing is written anywhere
 * else.
 * @param {string} id
 * @param {string | unknown} payload an export file (JSON text or parsed): version 2 envelope,
 *   or the version 1 file of the former site
 * @returns {Promise<void>}
 */
async function importJsonIntoWorkspace(id, payload) {
  const imported = readExport(payload, Date.now());

  // Importing into the current workspace: close the open connection first.
  if (id === wsActiveId()) await closeDatabase();

  // Target the right database directly: open it, overwrite every store.
  const db = await openWorkspaceDatabase(id);
  try {
    const tx = db.transaction([...STORE_NAMES], 'readwrite');
    /** @type {Promise<unknown>[]} */
    const writes = [];
    for (const name of STORE_NAMES) {
      const store = tx.objectStore(name);
      writes.push(store.clear());
      for (const record of imported[name]) writes.push(store.put(record));
    }
    await Promise.all([...writes, tx.done]);
  } finally {
    db.close();
  }
  announceChange(id);
}

/**
 * Loads the demo data into the (empty) database of a workspace.
 * @param {string} id
 * @returns {Promise<void>}
 */
async function seedWorkspace(id) {
  const demo = seed(Date.now());
  const db = await openWorkspaceDatabase(id);
  try {
    const tx = db.transaction([...STORE_NAMES], 'readwrite');
    for (const name of STORE_NAMES) {
      for (const record of demo[name]) tx.objectStore(name).put(record);
    }
    await tx.done;
  } finally {
    db.close();
  }
}

export const WORKSPACES = {
  getList: () => wsLoadList().slice(),
  getActiveId: wsActiveId,
  getActive: wsActive,

  /** @param {string} id */
  switchTo(id) {
    if (!wsLoadList().some((w) => w.id === id)) throw new Error('workspace inconnu');
    wsSetActiveId(id);
    location.reload();
  },

  /**
   * Adds a workspace; with `seedDemo` its database starts with the demo data (the user asked
   * for it in the creation form). Only the writer tab calls it.
   * @param {{ label?: string, seedDemo?: boolean }} [options]
   */
  async create({ label, seedDemo = false } = {}) {
    const ws = getRegistry().create(label?.trim() || 'espace');
    if (seedDemo) await seedWorkspace(ws.id);
    return ws;
  },

  /**
   * @param {string} id
   * @param {string} label
   */
  rename(id, label) {
    const current = wsLoadList().find((w) => w.id === id);
    if (!current) throw new Error('workspace inconnu');
    const trimmed = String(label).trim();
    return trimmed ? getRegistry().rename(id, trimmed) : current;
  },

  /** @param {string} id */
  async remove(id) {
    const registry = getRegistry();
    if (registry.list().length <= 1) throw new Error('on ne peut pas supprimer le dernier espace');
    const remaining = registry.remove(id);
    await idbDeleteDatabase(id);
    // The old localStorage fallback keys are never deleted: remember not to import them again
    // if the id is reused.
    skipFallbackOf(id);
    return remaining;
  },

  importJson: importJsonIntoWorkspace,

  /**
   * Direct JSON download of the current workspace.
   * @param {{ exportJson: () => Promise<unknown> }} store
   */
  async downloadCurrentJson(store) {
    const payload = await store.exportJson();
    const ws = wsActive();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chrono-${ws.id}-${formatLocalDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
