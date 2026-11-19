// Direct access to the (fake) IndexedDB, to prepare and inspect what the adapters wrote.

/**
 * @param {string} name
 * @param {(db: IDBDatabase) => void} [onUpgrade]
 * @returns {Promise<IDBDatabase>}
 */
export function ouvrir(name, onUpgrade) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
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
export async function lire(dbName, store) {
  const db = await ouvrir(dbName);
  const records = await new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return /** @type {any[]} */ (records);
}

/**
 * Creates a database in the format of version 1 and fills it.
 * @param {string} dbName
 * @param {Record<string, object[]>} contenu records per store
 */
export async function preparer(dbName, contenu) {
  const db = await ouvrir(dbName, (d) => {
    for (const n of ['projets', 'todos', 'sessions', 'pointage'])
      d.createObjectStore(n, { keyPath: 'id' });
    d.createObjectStore('meta', { keyPath: 'key' });
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction(Object.keys(contenu), 'readwrite');
    for (const [n, items] of Object.entries(contenu))
      items.forEach((it) => tx.objectStore(n).put(it));
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
