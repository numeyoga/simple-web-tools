import { describe, expect, it } from 'vitest';
import { createIdbFactory, deleteAllDatabases, resetIndexedDb } from '../src/indexeddb.js';

/**
 * @param {IDBFactory} factory
 * @param {string} name
 * @returns {Promise<IDBDatabase>}
 */
function open(factory, name) {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('items');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @param {IDBDatabase} db
 * @param {string} key
 * @param {string} value
 * @returns {Promise<void>}
 */
function put(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    tx.objectStore('items').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listNames() {
  return (await indexedDB.databases()).map((info) => info.name);
}

describe('fake IndexedDB setup', () => {
  it('provides the IndexedDB globals', () => {
    expect(typeof indexedDB.open).toBe('function');
    expect(typeof IDBKeyRange.bound).toBe('function');
  });

  it('writes a database, then resetIndexedDb drops it', async () => {
    const db = await open(indexedDB, 'app-test');
    await put(db, 'a', 'value');
    expect(await listNames()).toEqual(['app-test']);

    resetIndexedDb();
    expect(await listNames()).toEqual([]);
  });

  it('isolates tests: first test leaves a database behind', async () => {
    await open(indexedDB, 'leftover');
    expect(await listNames()).toEqual(['leftover']);
  });

  it('isolates tests: second test does not see it', async () => {
    expect(await listNames()).toEqual([]);
  });

  it('createIdbFactory returns independent factories', async () => {
    const other = createIdbFactory();
    await open(other, 'elsewhere');
    expect(await listNames()).toEqual([]);
    expect((await other.databases()).map((info) => info.name)).toEqual(['elsewhere']);
  });

  it('deleteAllDatabases removes every closed database', async () => {
    (await open(indexedDB, 'one')).close();
    (await open(indexedDB, 'two')).close();
    await deleteAllDatabases();
    expect(await listNames()).toEqual([]);
  });

  it('deleteAllDatabases rejects when a connection is still open', async () => {
    const db = await open(indexedDB, 'busy');
    await expect(deleteAllDatabases()).rejects.toThrow(/blocked/);
    db.close();
  });
});
