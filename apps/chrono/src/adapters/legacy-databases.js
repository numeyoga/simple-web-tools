// Version 1 workspaces whose id the registry refuses (see `planLegacyWorkspaces`): their data is
// in the database `chrono__<version 1 id>`, which has no valid workspace name. Each one is copied
// once into the database of its new id, converted with the same `v1ToV2` and `v2ToV3`. The old database is
// opened with the raw IndexedDB API (no name validation), read, and never modified or deleted.

import { v1ToV2, v2ToV3 } from '../core/migrations.js';
import { openWorkspaceDatabase } from './idb.js';
import { legacyDatabaseName } from './names.js';
import {
  STORE_NAMES,
  getRegistry,
  readLegacyWorkspaces,
  writeLegacyWorkspaces,
} from './workspace-list.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */

const LEGACY_STORES = ['projets', 'todos', 'sessions', 'pointage'];

/**
 * Reads every record of the stores of an existing database, without creating or upgrading it.
 * @param {string} name
 * @returns {Promise<Record<string, unknown[]> | null>} null when the database does not exist
 */
function readRawDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    let missing = false;
    request.onupgradeneeded = () => {
      // Version 0: the database does not exist. Abort so that the open creates nothing.
      missing = true;
      request.transaction?.abort();
    };
    request.onerror = () => (missing ? resolve(null) : reject(request.error));
    request.onsuccess = () => {
      const db = request.result;
      const names = [...db.objectStoreNames].filter(
        (n) => LEGACY_STORES.includes(n) || STORE_NAMES.includes(/** @type {never} */ (n)),
      );
      /** @type {Record<string, unknown[]>} */
      const content = {};
      if (names.length === 0) {
        db.close();
        resolve(content);
        return;
      }
      const tx = db.transaction(names, 'readonly');
      for (const n of names) {
        const all = tx.objectStore(n).getAll();
        all.onsuccess = () => {
          content[n] = all.result;
        };
      }
      tx.oncomplete = () => {
        db.close();
        resolve(content);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

/**
 * Copies the database of one repaired workspace into the database of its new id, unless that
 * one already holds data.
 * @param {{ from: string, to: string }} entry
 * @returns {Promise<void>}
 */
async function copyOne({ from, to }) {
  const source = await readRawDatabase(legacyDatabaseName(from));
  if (!source) return;
  const converted = /** @type {Partial<ChronoData>} */ (
    v2ToV3(
      v1ToV2({
        projets: source.projets ?? source.projects ?? [],
        todos: source.todos ?? [],
        sessions: source.sessions ?? [],
        pointage: source.pointage ?? source.attendance ?? [],
      }),
    )
  );
  const target = await openWorkspaceDatabase(to);
  try {
    const counts = await Promise.all(STORE_NAMES.map((n) => target.count(n)));
    if (counts.some((count) => count > 0)) return; // already has data: never overwritten
    const tx = target.transaction([...STORE_NAMES], 'readwrite');
    for (const n of STORE_NAMES) {
      for (const record of converted[n] ?? []) tx.objectStore(n).put(record);
    }
    await tx.done;
  } finally {
    target.close();
  }
}

/**
 * Copies the pending databases. A failure leaves the entry pending, to retry at the next
 * start. Only the writer tab calls it (it writes to IndexedDB).
 * @returns {Promise<number>} how many databases were copied or found absent
 */
export async function copyLegacyDatabases() {
  getRegistry(); // the first call after an update imports the version 1 list, and records the repairs
  const entries = readLegacyWorkspaces();
  let done = 0;
  for (const entry of entries) {
    if (entry.copied) continue;
    try {
      await copyOne(entry);
      entry.copied = true;
      done += 1;
    } catch (error) {
      console.warn('[db] copy of the version 1 database failed', entry.from, error);
    }
  }
  if (done) writeLegacyWorkspaces(entries);
  return done;
}
