// Direct access to the (fake) IndexedDB, to prepare and inspect what the adapters wrote. It uses
// the raw IndexedDB API on purpose: that is how a release of the app wrote its data.

/**
 * Open (and optionally create) a database with the raw API.
 * @param {string} name
 * @param {number} [version] omit it to open the database as it is, without upgrading
 * @param {(db: IDBDatabase) => void} [onUpgrade]
 * @returns {Promise<IDBDatabase>}
 */
export function openRaw(name, version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    req.onupgradeneeded = () => onUpgrade?.(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * All the records of a store of an existing database.
 * @param {string} dbName
 * @param {string} store
 * @returns {Promise<any[]>}
 */
export async function readStore(dbName, store) {
  const db = await openRaw(dbName);
  const records = await new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return /** @type {any[]} */ (records);
}

/**
 * Version, object stores and key paths of an existing database.
 * @param {string} dbName
 * @returns {Promise<{ version: number, stores: Record<string, string | string[] | null> }>}
 */
export async function describeDatabase(dbName) {
  const db = await openRaw(dbName);
  /** @type {Record<string, string | string[] | null>} */
  const stores = {};
  if (db.objectStoreNames.length > 0) {
    const tx = db.transaction([...db.objectStoreNames], 'readonly');
    for (const name of [...db.objectStoreNames].sort()) stores[name] = tx.objectStore(name).keyPath;
  }
  const version = db.version;
  db.close();
  return { version, stores };
}

/**
 * Write records into the stores of an existing database, whatever its version.
 * @param {string} dbName
 * @param {Record<string, object[]>} content records per store
 */
export async function putRecords(dbName, content) {
  const db = await openRaw(dbName);
  await new Promise((resolve, reject) => {
    const tx = db.transaction(Object.keys(content), 'readwrite');
    for (const [name, items] of Object.entries(content)) {
      items.forEach((item) => tx.objectStore(name).put(item));
    }
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
