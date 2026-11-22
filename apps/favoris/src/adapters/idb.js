/** @import { Group, Link, StoreEffect } from '../types.d.ts' */

// IndexedDB: one database per workspace (`favoris__<id>`), opened with `openDatabase` of
// @simple-web-tools/storage.
//
// Schema (the database version is the number of migrations):
//   version 1   groups  Group  { id, label, category, featured, collapsed, position }
//               links   Link   { id, name, url, groupId, position }
//   `position` is the place of the record in its list (the core keeps it equal to the index).
//   Records come back from IndexedDB in key order, so the readers sort them by `position`.
// Adding a schema change means appending a migration and a test that opens a database written
// by the previous version. Never edit or reorder a step.

import { createStoresIfMissing, openDatabase } from '@simple-web-tools/storage';
import { databaseNameFor } from './names.js';

/** @typedef {import('@simple-web-tools/storage').Database} Database */
/** @typedef {import('@simple-web-tools/storage').Migration} Migration */

/** @type {readonly Migration[]} */
export const migrations = [
  (db) =>
    createStoresIfMissing(db, [
      { name: 'groups', keyPath: 'id' },
      { name: 'links', keyPath: 'id' },
    ]),
];

/** The stores of the current schema. */
export const STORE_NAMES = /** @type {const} */ (['groups', 'links']);

/**
 * The database cannot be used: the page shows an error screen and writes nothing anywhere.
 * `blocked`: an older tab keeps a connection that prevents the upgrade of the database.
 * `unavailable`: IndexedDB is missing, refuses to open or does not answer.
 */
export class StorageError extends Error {
  /**
   * @param {'unavailable' | 'blocked'} code
   * @param {unknown} [cause]
   */
  constructor(code, cause) {
    super(code === 'blocked' ? 'IndexedDB blocked by another tab' : 'IndexedDB unavailable', {
      cause,
    });
    this.name = 'StorageError';
    this.code = code;
  }
}

/** How long an open may take before it counts as unavailable. */
const OPEN_TIMEOUT_MS = 8000;

/**
 * Open the database of a workspace, with the migrations. Rejects with a `StorageError` when
 * IndexedDB is missing or fails, when the open is blocked by another connection, or after the
 * timeout.
 * @param {string} workspaceId
 * @param {{ timeoutMs?: number, onVersionChange?: () => void }} [options] `onVersionChange`:
 *   another tab upgrades or deletes this database, the connection was closed (default: reload)
 * @returns {Promise<Database>}
 */
export function openWorkspaceDatabase(
  workspaceId,
  { timeoutMs = OPEN_TIMEOUT_MS, onVersionChange = () => location.reload() } = {},
) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('unavailable'));
      return;
    }
    let settled = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeout;
    /** @param {(value: never) => void} outcome @param {unknown} value */
    const settle = (outcome, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      outcome(/** @type {never} */ (value));
    };
    if (timeoutMs > 0) {
      timeout = setTimeout(() => settle(reject, new StorageError('unavailable')), timeoutMs);
    }
    /** @type {Promise<Database>} */
    let opening;
    try {
      opening = openDatabase({
        name: databaseNameFor(workspaceId),
        migrations,
        onBlocked: () => settle(reject, new StorageError('blocked')),
        onVersionChange,
      });
    } catch (error) {
      settle(reject, new StorageError('unavailable', error));
      return;
    }
    opening.then(
      (db) => {
        // The caller gave up (timeout, blocked): do not leak the connection.
        if (settled) db.close();
        else settle(resolve, db);
      },
      (error) => settle(reject, new StorageError('unavailable', error)),
    );
  });
}

/**
 * What a workspace holds, as the state needs it. The core sorts and cleans the records.
 * @param {Database} db
 * @returns {Promise<{ groups: Group[], links: Link[] }>}
 */
export async function readWorkspace(db) {
  const tx = db.transaction(['groups', 'links'], 'readonly');
  const [groups, links] = await Promise.all([
    tx.objectStore('groups').getAll(),
    tx.objectStore('links').getAll(),
  ]);
  await tx.done;
  return { groups, links };
}

/**
 * Runs the writes of one transaction and waits for it to commit. If building a write throws (a
 * record that cannot be stored), the transaction is aborted: without that, IndexedDB would
 * commit the writes made before the failure, and "all or nothing" would not hold.
 * @param {import('idb').IDBPTransaction<unknown, string[], 'readwrite'>} tx
 * @param {(write: (request: Promise<unknown>) => void) => void} build
 * @returns {Promise<void>}
 */
async function commit(tx, build) {
  /** @type {Promise<unknown>[]} */
  const requests = [];
  try {
    build((request) => {
      // Rejected when the transaction aborts: reported through `tx.done`, not as unhandled.
      request.catch(() => {});
      requests.push(request);
    });
    await Promise.all([...requests, tx.done]);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Already finished or aborted.
    }
    await tx.done.catch(() => {});
    throw error;
  }
}

/**
 * Writes effects in one transaction, in order: all of them or none.
 * @param {Database} db
 * @param {readonly StoreEffect[]} effects
 * @returns {Promise<void>}
 */
export async function applyEffects(db, effects) {
  if (effects.length === 0) return;
  const tx = db.transaction(['groups', 'links'], 'readwrite');
  await commit(tx, (write) => {
    for (const effect of effects) {
      switch (effect.type) {
        case 'persist_group':
          write(tx.objectStore('groups').put(effect.group));
          break;
        case 'remove_group':
          write(tx.objectStore('groups').delete(effect.id));
          break;
        case 'persist_link':
          write(tx.objectStore('links').put(effect.link));
          break;
        case 'remove_link':
          write(tx.objectStore('links').delete(effect.id));
          break;
      }
    }
  });
}

/**
 * Replaces everything a workspace holds (an import, "clear all", a copy): clears the stores,
 * writes the new records. One transaction: a failure leaves the workspace as it was.
 * @param {Database} db
 * @param {{ groups: readonly Group[], links: readonly Link[] }} data
 * @returns {Promise<void>}
 */
export async function replaceWorkspace(db, data) {
  const tx = db.transaction(['groups', 'links'], 'readwrite');
  await commit(tx, (write) => {
    write(tx.objectStore('groups').clear());
    write(tx.objectStore('links').clear());
    for (const group of data.groups) write(tx.objectStore('groups').put(group));
    for (const link of data.links) write(tx.objectStore('links').put(link));
  });
}
