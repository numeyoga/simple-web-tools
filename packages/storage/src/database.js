import { openDB } from 'idb';

/**
 * @typedef {import('idb').IDBPDatabase} Database
 * @typedef {import('idb').IDBPTransaction<unknown, string[], 'versionchange'>} UpgradeTransaction
 */

/**
 * One schema step, run inside the upgrade transaction. It may return a promise (an
 * `async` function): the next steps then run after it settles. The only things a step may
 * await are requests of the upgrade transaction (`tx.objectStore(...).getAll()`, `put`...):
 * the transaction commits as soon as no request is pending, so awaiting a timer, `fetch` or
 * any other promise would end the upgrade early. If the promise rejects, the upgrade
 * transaction is aborted and the open rejects: nothing is half-applied.
 * @callback Migration
 * @param {Database} db
 * @param {UpgradeTransaction} tx
 * @param {number} oldVersion version found on disk (0 for a new database)
 * @returns {unknown} a promise when the step is asynchronous; any other value is ignored
 */

/**
 * @typedef {object} OpenDatabaseOptions
 * @property {string} name database name, built with the helpers of `names.js`
 * @property {readonly Migration[]} migrations ordered steps: index `i` upgrades version `i` to
 *   `i + 1`. The database version is `migrations.length`.
 * @property {(info: { currentVersion: number; blockedVersion: number | null }) => void} [onBlocked]
 *   another tab keeps an older connection open and did not close it: the upgrade waits
 * @property {() => void} [onVersionChange] called after this connection was closed because
 *   another tab upgrades the database; the app should stop using the connection and reload
 */

/**
 * @param {unknown} value
 * @returns {value is PromiseLike<unknown>}
 */
function isThenable(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (/** @type {{ then?: unknown }} */ (value).then) === 'function'
  );
}

/**
 * Open a database and run the migrations it still needs.
 *
 * A step runs when `index >= oldVersion`: a new database runs all of them in order, a
 * database at version 2 runs steps 2, 3... only. A database newer than the last step is not
 * touched, and the browser rejects the open with a `VersionError`.
 *
 * On `versionchange` (another tab opens a higher version) the connection is closed so that
 * the other tab can upgrade; `onVersionChange` tells the caller.
 * @param {OpenDatabaseOptions} options
 * @returns {Promise<Database>}
 */
export function openDatabase({ name, migrations, onBlocked, onVersionChange }) {
  if (typeof name !== 'string' || name === '') {
    throw new TypeError('openDatabase: a database name is required.');
  }
  if (migrations.length === 0) {
    throw new TypeError('openDatabase: at least one migration is required.');
  }
  /** @type {Database | undefined} */
  let connection;
  return openDB(name, migrations.length, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // A failing step aborts the upgrade transaction and rejects the open promise; without
      // this, `tx.done` would reject as well and be reported as an unhandled rejection.
      tx.done.catch(() => {});
      const abort = () => {
        try {
          tx.abort();
        } catch {
          /* the transaction is already finishing or aborted */
        }
      };
      /**
       * Runs the steps from `index`. Steps run synchronously one after the other; when one
       * returns a promise, the rest runs after it settles (still in the same transaction).
       * @param {number} index
       * @returns {void}
       */
      const run = (index) => {
        for (let step = index; step < migrations.length; step += 1) {
          const result = /** @type {Migration} */ (migrations[step])(db, tx, oldVersion);
          if (isThenable(result)) {
            result.then(
              () => {
                try {
                  run(step + 1);
                } catch (error) {
                  console.error('[storage] a migration step failed', error);
                  abort();
                }
              },
              (/** @type {unknown} */ error) => {
                console.error('[storage] a migration step failed', error);
                abort();
              },
            );
            return;
          }
        }
      };
      run(oldVersion);
    },
    blocked(currentVersion, blockedVersion) {
      onBlocked?.({ currentVersion, blockedVersion });
    },
    blocking() {
      connection?.close();
      onVersionChange?.();
    },
  }).then((db) => {
    connection = db;
    return db;
  });
}

/**
 * An object store to create if it is missing.
 * @typedef {object} StoreDefinition
 * @property {string} name
 * @property {string | string[] | null} [keyPath]
 * @property {boolean} [autoIncrement]
 */

/**
 * Create the stores that do not exist yet; leave existing ones (and their data) alone. Use it
 * in an idempotent migration step.
 * @param {Database} db
 * @param {readonly StoreDefinition[]} stores
 * @returns {void}
 */
export function createStoresIfMissing(db, stores) {
  for (const { name, keyPath, autoIncrement } of stores) {
    if (db.objectStoreNames.contains(name)) continue;
    /** @type {IDBObjectStoreParameters} */
    const options = {};
    if (keyPath !== undefined) options.keyPath = keyPath;
    if (autoIncrement) options.autoIncrement = true;
    db.createObjectStore(name, options);
  }
}

/**
 * Delete a database. Resolves `true` when it is gone, `false` when another connection blocks
 * the deletion or the request fails.
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export function deleteDatabase(name) {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(false);
      return;
    }
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
  });
}
