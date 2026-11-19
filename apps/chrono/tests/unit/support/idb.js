// Direct access to the (fake) IndexedDB, to prepare and inspect what the adapters wrote. It
// uses the raw IndexedDB API on purpose: that is how a release of Chrono wrote its data.

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
 * Fill existing stores of an open database.
 * @param {IDBDatabase} db
 * @param {Record<string, object[]>} content records per store
 */
async function fill(db, content) {
  if (Object.keys(content).length === 0) {
    db.close();
    return;
  }
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

/**
 * Creates a database exactly as the version 1 `openDB()` of Chrono did (IndexedDB version 1,
 * stores `projets`, `todos`, `sessions`, `pointage` keyed by `id`, and `meta` keyed by `key`),
 * and fills it.
 * @param {string} dbName
 * @param {Record<string, object[]>} [content] version 1 records per store
 */
export async function createV1Database(dbName, content = {}) {
  const db = await openRaw(dbName, 1, (d) => {
    for (const name of ['projets', 'todos', 'sessions', 'pointage']) {
      d.createObjectStore(name, { keyPath: 'id' });
    }
    d.createObjectStore('meta', { keyPath: 'key' });
  });
  await fill(db, content);
}

/**
 * Creates a database in the version 2 layout (IndexedDB version 2) and fills it.
 * @param {string} dbName
 * @param {Record<string, object[]>} [content] version 2 records per store
 */
export async function createV2Database(dbName, content = {}) {
  const db = await openRaw(dbName, 2, (d) => {
    for (const name of ['projects', 'todos', 'sessions', 'attendance']) {
      d.createObjectStore(name, { keyPath: 'id' });
    }
    d.createObjectStore('meta', { keyPath: 'key' });
  });
  await fill(db, content);
}
