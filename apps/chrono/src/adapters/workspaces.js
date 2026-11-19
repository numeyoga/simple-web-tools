// Workspace API (list, create, rename, remove, switch), JSON import and download.
// The list and the active id are in localStorage; see workspace-list.js.

import { fmtDateISO } from '../core/dates.js';
import { validerImport } from '../core/import-export.js';
import { slugify, uniqueId } from '../core/workspaces.js';
import { fermerBase, idbDeleteDatabase, ouvrirBaseDe } from './idb.js';
import {
  STORE_NAMES,
  channelNameFor,
  lsKeyFor,
  wsActive,
  wsActiveId,
  wsLoadList,
  wsSaveList,
  wsSetActiveId,
} from './workspace-list.js';

/**
 * Replaces the data of workspace `id` with a validated import. Without IndexedDB (or when it
 * does not open), writes the localStorage fallback instead.
 * @param {string} id
 * @param {unknown} payload an export file, or its `data` part
 * @returns {Promise<void>}
 */
async function importerJSONDansWorkspace(id, payload) {
  const { projets, todos, sessions, pointage } = validerImport(payload, Date.now());

  // Importing into the current workspace: close the open connection first.
  if (id === wsActiveId()) await fermerBase();

  // Target the right database directly: open it, overwrite every store.
  /** @type {IDBDatabase | null} */
  let db = null;
  if ('indexedDB' in window) {
    try {
      db = await ouvrirBaseDe(id);
    } catch (e) {
      console.warn(
        '[db] import : IndexedDB indisponible, repli localStorage',
        /** @type {Error} */ (e)?.message || e,
      );
    }
  }
  if (!db) {
    // Same format as lsSave.
    localStorage.setItem(lsKeyFor(id), JSON.stringify({ projets, todos, sessions, pointage }));
    return;
  }
  const base = db;
  await new Promise((res, rej) => {
    const tx = base.transaction([...STORE_NAMES, 'meta'], 'readwrite');
    const put = (/** @type {string} */ name, /** @type {unknown[]} */ items) => {
      const s = tx.objectStore(name);
      s.clear();
      items.forEach((it) => s.put(it));
    };
    put('projets', projets);
    put('todos', todos);
    put('sessions', sessions);
    put('pointage', pointage);
    tx.objectStore('meta').clear();
    tx.oncomplete = () => res(undefined);
    tx.onerror = () => rej(tx.error);
  });
  base.close();
  // Tell the other tabs of this workspace (they re-read the database).
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const c = new BroadcastChannel(channelNameFor(id));
      c.postMessage('maj');
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
    const list = wsLoadList();
    const id = uniqueId(slugify(label || 'espace'), list);
    const ws = { id, label: (label || id).trim(), creeLe: Date.now(), seedOnInit: !!seedDemo };
    list.push(ws);
    wsSaveList(list);
    return ws;
  },

  /**
   * @param {string} id
   * @param {string} label
   */
  rename(id, label) {
    const list = wsLoadList();
    const i = list.findIndex((w) => w.id === id);
    const courant = list[i];
    if (!courant) throw new Error('workspace inconnu');
    const renomme = { ...courant, label: String(label).trim() || courant.label };
    list[i] = renomme;
    wsSaveList(list);
    return renomme;
  },

  /** @param {string} id */
  async remove(id) {
    const list = wsLoadList();
    if (list.length <= 1) throw new Error('on ne peut pas supprimer le dernier espace');
    const filtered = list.filter((w) => w.id !== id);
    wsSaveList(filtered);
    if (wsActiveId() === id) wsSetActiveId(/** @type {{ id: string }} */ (filtered[0]).id);
    await idbDeleteDatabase(id);
    try {
      localStorage.removeItem(lsKeyFor(id));
    } catch {
      /* ignore */
    }
    return filtered;
  },

  importJSON: importerJSONDansWorkspace,

  /**
   * Direct JSON download of the current workspace.
   * @param {{ exporterJSON: () => Promise<unknown> }} store
   */
  async downloadCurrentJSON(store) {
    const payload = await store.exporterJSON();
    const ws = wsActive();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chrono-${ws.id}-${fmtDateISO(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
