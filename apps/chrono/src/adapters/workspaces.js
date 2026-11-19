// Workspace API (list, create, rename, remove, switch), JSON import and download.
// The list and the active id are in localStorage, managed by the registry (workspace-list.js).

import { formatLocalDate } from '../core/dates.js';
import { readExport } from './backup.js';
import { closeDatabase, idbDeleteDatabase, openWorkspaceDatabase } from './idb.js';
import { channelName, fallbackKey, legacyFallbackKey } from './names.js';
import {
  STORE_NAMES,
  getRegistry,
  setDemoEnabled,
  wsActive,
  wsActiveId,
  wsLoadList,
  wsSetActiveId,
} from './workspace-list.js';

/**
 * Replaces the data of workspace `id` with a validated import. Without IndexedDB (or when it
 * does not open), writes the localStorage fallback instead.
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
  /** @type {import('@simple-web-tools/storage').Database | null} */
  let db = null;
  if ('indexedDB' in window) {
    try {
      db = await openWorkspaceDatabase(id);
    } catch (e) {
      console.warn(
        '[db] import: IndexedDB unavailable, using the localStorage fallback',
        /** @type {Error} */ (e)?.message || e,
      );
    }
  }
  if (!db) {
    // Same format as saveFallback.
    localStorage.setItem(fallbackKey(id), JSON.stringify(imported));
    return;
  }
  const tx = db.transaction([...STORE_NAMES, 'meta'], 'readwrite');
  /** @type {Promise<unknown>[]} */
  const writes = [tx.objectStore('meta').clear()];
  for (const name of STORE_NAMES) {
    const store = tx.objectStore(name);
    writes.push(store.clear());
    for (const record of imported[name]) writes.push(store.put(record));
  }
  await Promise.all([...writes, tx.done]);
  db.close();
  // Tell the other tabs of this workspace (they re-read the database).
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const c = new BroadcastChannel(channelName(id));
      c.postMessage('update');
      c.close();
    } catch {
      /* ignore */
    }
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

  /** @param {{ label?: string, seedDemo?: boolean }} [options] */
  create({ label, seedDemo = false } = {}) {
    const ws = getRegistry().create(label?.trim() || 'espace');
    setDemoEnabled(ws.id, seedDemo);
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
    setDemoEnabled(id, true);
    await idbDeleteDatabase(id);
    try {
      localStorage.removeItem(fallbackKey(id));
      localStorage.removeItem(legacyFallbackKey(id));
    } catch {
      /* ignore */
    }
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
