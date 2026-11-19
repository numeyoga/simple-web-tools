// Backup spaces (workspaces): the list and the active id live in localStorage.
//
// Each workspace has its own IndexedDB (`chrono__<id>`) and its own localStorage fallback
// (`chrono.fallback.<id>.v1`). Switching workspace reloads the page: the store is rebuilt.
// Every storage name starts with the app name (decision 0005).

import { listeParDefaut } from '../core/workspaces.js';

export const DB_VERSION = 1;
export const STORE_NAMES = /** @type {const} */ (['projets', 'todos', 'sessions', 'pointage']);

const WS_LIST_KEY = 'chrono.workspaces';
const WS_ACTIVE_KEY = 'chrono.workspace.active';

/** @returns {import('../types.js').EspaceDeSauvegarde[]} */
export function wsLoadList() {
  try {
    const raw = localStorage.getItem(WS_LIST_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    /* ignore */
  }
  const fresh = listeParDefaut(Date.now());
  localStorage.setItem(WS_LIST_KEY, JSON.stringify(fresh));
  return fresh;
}

/** @param {import('../types.js').EspaceDeSauvegarde[]} list */
export function wsSaveList(list) {
  localStorage.setItem(WS_LIST_KEY, JSON.stringify(list));
}

/** @returns {string} */
export function wsActiveId() {
  const id = localStorage.getItem(WS_ACTIVE_KEY);
  if (id && wsLoadList().some((w) => w.id === id)) return id;
  return /** @type {import('../types.js').EspaceDeSauvegarde} */ (wsLoadList()[0]).id;
}

/** @param {string} id */
export function wsSetActiveId(id) {
  localStorage.setItem(WS_ACTIVE_KEY, id);
}

/** @returns {import('../types.js').EspaceDeSauvegarde} */
export function wsActive() {
  const id = wsActiveId();
  return wsLoadList().find((w) => w.id === id) || /** @type {any} */ (wsLoadList()[0]);
}

/** @param {string} id */
export const dbNameFor = (id) => `chrono__${id}`;
/** @param {string} id */
export const lsKeyFor = (id) => `chrono.fallback.${id}.v1`;
/** @param {string} id */
export const channelNameFor = (id) => `chrono:${id}`;
