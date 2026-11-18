import { IDBFactory } from 'fake-indexeddb';

/**
 * Creates a new, empty IndexedDB factory. Databases opened through it are invisible to every
 * other factory.
 * @returns {IDBFactory}
 */
export function createIdbFactory() {
  return new IDBFactory();
}

/**
 * Replaces `globalThis.indexedDB` with a fresh factory, which drops every database created
 * so far. Connections still open on the previous factory keep working but are detached.
 * @returns {IDBFactory} the new factory
 */
export function resetIndexedDb() {
  const factory = createIdbFactory();
  globalThis.indexedDB = factory;
  return factory;
}

/**
 * Deletes every database of a factory, waiting for each deletion. Open connections must be
 * closed first, otherwise a deletion stays pending.
 * @param {IDBFactory} [factory] defaults to `globalThis.indexedDB`
 * @returns {Promise<void>}
 */
export async function deleteAllDatabases(factory = globalThis.indexedDB) {
  for (const { name } of await factory.databases()) {
    if (name === undefined) continue;
    await new Promise((resolve, reject) => {
      const request = factory.deleteDatabase(name);
      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error(`Deleting "${name}" is blocked by an open connection`));
    });
  }
}
