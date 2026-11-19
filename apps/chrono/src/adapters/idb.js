// IndexedDB helpers. One connection per page, on the active workspace's database.
//
// Schema (version 1):
//   projets  : { id, nom, couleur, client, archive }
//   todos    : { id, titre, fait, projetId, echeance, creeLe }
//                echeance: null or local date 'AAAA-MM-JJ' (absolute, independent of creeLe).
//                Old data: relative labels ('today', 'tomorrow', 'mon'..'sun', 'week')
//                converted on load by migrerEcheancesTodos().
//   sessions : { id, projetId, description, debut, dernierDebut, fin, duree, statut }
//                statut: 'terminee' | 'en_cours' | 'en_pause'
//   pointage : { id, type, at } with type: 'arrivee' | 'pause_debut' | 'pause_fin' | 'depart'
//   meta     : { key, value }

import { DB_VERSION, STORE_NAMES, dbNameFor, wsActiveId } from './workspace-list.js';

/** @type {Promise<IDBDatabase | null> | null} */
let _dbPromise = null;

/** @param {IDBDatabase} db */
function creerStores(db) {
  for (const s of STORE_NAMES) {
    if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
}

/**
 * Opens (once) the active workspace's database; null when IndexedDB is unusable.
 * @returns {Promise<IDBDatabase | null>}
 */
export function openDB() {
  if (_dbPromise) return _dbPromise;
  const dbName = dbNameFor(wsActiveId());
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('no-idb'));
      return;
    }
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[db] indexedDB.open timed out, falling back to localStorage');
        reject(new Error('idb-timeout'));
      }
    }, 1500);
    /** @type {IDBOpenDBRequest} */
    let req;
    try {
      req = indexedDB.open(dbName, DB_VERSION);
    } catch (e) {
      settled = true;
      clearTimeout(timeout);
      reject(e);
      return;
    }
    req.onupgradeneeded = () => creerStores(req.result);
    req.onsuccess = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(req.result);
      }
    };
    req.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(req.error);
      }
    };
    req.onblocked = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('idb-blocked'));
      }
    };
  }).catch((e) => {
    console.warn('[db] openDB fallback:', e?.message || e);
    return null;
  });
  return _dbPromise;
}

/**
 * Closes the shared connection (if any) and forgets it, so the next openDB() reopens.
 * @returns {Promise<void>}
 */
export async function fermerBase() {
  if (!_dbPromise) return;
  const db = await _dbPromise.catch(() => null);
  if (db) db.close();
  _dbPromise = null;
}

/**
 * All the records of a store; null when IndexedDB is unavailable.
 * @param {string} store
 * @returns {Promise<any[] | null>}
 */
export async function idbAll(store) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}

/**
 * Differential write of a store: `put` the objects whose reference differs from the snapshot
 * `vu` (Map id -> object already written or read), `delete` the snapshot ids absent from
 * `items`. One transaction; does not touch objects added by another tab. Resolves to true
 * when something was written.
 * @param {string} store
 * @param {{ id: string }[]} items
 * @param {Map<string, unknown>} vu
 * @returns {Promise<boolean>}
 */
export async function idbSync(store, items, vu) {
  const db = await openDB();
  if (!db) return false;
  const ids = new Set(items.map((it) => it.id));
  const aEcrire = items.filter((it) => vu.get(it.id) !== it);
  const aSupprimer = [...vu.keys()].filter((id) => !ids.has(id));
  if (!aEcrire.length && !aSupprimer.length) return false;
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    aEcrire.forEach((it) => s.put(it));
    aSupprimer.forEach((id) => s.delete(id));
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('tx-abort'));
  });
}

/**
 * @param {string} store
 * @param {{ id: string }[]} items
 * @returns {Promise<boolean>}
 */
export async function idbBulkPut(store, items) {
  const db = await openDB();
  if (!db) return false;
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    items.forEach((it) => s.put(it));
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

/**
 * Deletes the whole database of a workspace (workspace removal).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export function idbDeleteDatabase(id) {
  return new Promise((res) => {
    if (!('indexedDB' in window)) return res(false);
    const req = indexedDB.deleteDatabase(dbNameFor(id));
    req.onsuccess = () => res(true);
    req.onerror = () => res(false);
    req.onblocked = () => res(false);
  });
}

/**
 * Opens a workspace's database directly (import), creating the stores if needed. Rejects on
 * error or when blocked. The caller closes it.
 * @param {string} id
 * @returns {Promise<IDBDatabase>}
 */
export function ouvrirBaseDe(id) {
  return new Promise((res, rej) => {
    const req = indexedDB.open(dbNameFor(id), DB_VERSION);
    req.onupgradeneeded = () => creerStores(req.result);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    req.onblocked = () => rej(new Error('idb-blocked'));
  });
}
