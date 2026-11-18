import { describe, it, expect, vi } from 'vitest';
import { createStoresIfMissing, deleteDatabase, openDatabase } from '../src/index.js';

/**
 * Create a database with the raw IndexedDB API, as an older release of an app would have.
 * @param {string} name
 * @param {number} version
 * @param {(db: IDBDatabase) => void} build runs in the upgrade transaction
 * @param {(db: IDBDatabase) => Promise<void>} [fill] writes records afterwards
 */
async function createRawDatabase(name, version, build, fill) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => build(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await fill?.(db);
  db.close();
}

/** @param {IDBDatabase} db @param {string} store @param {unknown} value */
function put(db, store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

describe('openDatabase', () => {
  it('creates the stores of a fresh database and uses migrations.length as the version', async () => {
    /** @type {number[]} */
    const calls = [];
    const db = await openDatabase({
      name: 'app-db',
      migrations: [
        (d) => {
          calls.push(1);
          d.createObjectStore('a', { keyPath: 'id' });
        },
        (d) => {
          calls.push(2);
          d.createObjectStore('b', { keyPath: 'id' });
        },
      ],
    });
    expect(db.version).toBe(2);
    expect([...db.objectStoreNames]).toEqual(['a', 'b']);
    expect(calls).toEqual([1, 2]);
    db.close();
  });

  it('runs migrations in order, and only the ones from the stored version', async () => {
    await createRawDatabase(
      'app-db',
      2,
      (d) => {
        d.createObjectStore('a', { keyPath: 'id' });
        d.createObjectStore('b', { keyPath: 'id' });
      },
      (d) => put(d, 'a', { id: 'kept' }),
    );
    /** @type {number[][]} */
    const calls = [];
    /** @param {number} n @returns {import('../src/index.js').Migration} */
    const step = (n) => (_db, _tx, oldVersion) => {
      calls.push([n, oldVersion]);
    };
    const db = await openDatabase({
      name: 'app-db',
      migrations: [step(0), step(1), step(2), step(3)],
    });
    expect(db.version).toBe(4);
    expect(calls).toEqual([
      [2, 2],
      [3, 2],
    ]);
    expect(await db.get('a', 'kept')).toEqual({ id: 'kept' });
    db.close();
  });

  it('runs nothing when the database is already current', async () => {
    const migration = vi.fn((d) => d.createObjectStore('a', { keyPath: 'id' }));
    const first = await openDatabase({ name: 'app-db', migrations: [migration] });
    await first.put('a', { id: 1 });
    first.close();
    const second = await openDatabase({ name: 'app-db', migrations: [migration] });
    expect(migration).toHaveBeenCalledTimes(1);
    expect(await second.get('a', 1)).toEqual({ id: 1 });
    second.close();
  });

  it('runs a failing migration inside the transaction: nothing is half-applied', async () => {
    await createRawDatabase('app-db', 1, (d) => d.createObjectStore('a', { keyPath: 'id' }));
    await expect(
      openDatabase({
        name: 'app-db',
        migrations: [
          () => {},
          (d) => {
            d.createObjectStore('b', { keyPath: 'id' });
            throw new Error('boom');
          },
        ],
      }),
    ).rejects.toThrow();
    const db = await openDatabase({ name: 'app-db', migrations: [() => {}] });
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames]).toEqual(['a']);
    db.close();
  });

  it('rejects a database newer than the known migrations without touching it', async () => {
    await createRawDatabase('app-db', 3, (d) => d.createObjectStore('a', { keyPath: 'id' }));
    await expect(openDatabase({ name: 'app-db', migrations: [() => {}] })).rejects.toThrow();
  });

  it('rejects an empty migration list and a missing name', () => {
    expect(() => openDatabase({ name: 'app-db', migrations: [] })).toThrow(TypeError);
    expect(() => openDatabase({ name: '', migrations: [() => {}] })).toThrow(TypeError);
  });

  it('reports blocked when another connection keeps an older version open', async () => {
    const old = await new Promise((resolve) => {
      const request = indexedDB.open('app-db', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('a');
      request.onsuccess = () => resolve(request.result);
    });
    const onBlocked = vi.fn(() => old.close()); // the other tab finally lets go
    const db = await openDatabase({
      name: 'app-db',
      migrations: [() => {}, (d) => d.createObjectStore('b')],
      onBlocked,
    });
    expect(onBlocked).toHaveBeenCalledWith({ currentVersion: 1, blockedVersion: 2 });
    expect(db.version).toBe(2);
    db.close();
  });

  it('closes its connection when another tab upgrades, and tells the caller', async () => {
    const onVersionChange = vi.fn();
    const db = await openDatabase({
      name: 'app-db',
      migrations: [(d) => d.createObjectStore('a')],
      onVersionChange,
    });
    const upgraded = await new Promise((resolve, reject) => {
      const request = indexedDB.open('app-db', 2);
      request.onupgradeneeded = () => request.result.createObjectStore('b');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(onVersionChange).toHaveBeenCalledTimes(1);
    expect(() => db.transaction('a')).toThrow();
    expect(upgraded.version).toBe(2);
    upgraded.close();
  });
});

describe('createStoresIfMissing', () => {
  it('creates missing stores and leaves existing ones and their data alone', async () => {
    await createRawDatabase(
      'app-db',
      1,
      (d) => d.createObjectStore('a', { keyPath: 'id' }),
      (d) => put(d, 'a', { id: 'x', n: 1 }),
    );
    const db = await openDatabase({
      name: 'app-db',
      migrations: [
        () => {},
        (d) =>
          createStoresIfMissing(d, [
            { name: 'a', keyPath: 'other' },
            { name: 'b', keyPath: 'key' },
            { name: 'c' },
            { name: 'd', autoIncrement: true },
          ]),
      ],
    });
    expect(await db.get('a', 'x')).toEqual({ id: 'x', n: 1 });
    const tx = db.transaction(['a', 'b', 'c', 'd']);
    expect(tx.objectStore('a').keyPath).toBe('id');
    expect(tx.objectStore('b').keyPath).toBe('key');
    expect(tx.objectStore('c').keyPath).toBeNull();
    expect(tx.objectStore('d').autoIncrement).toBe(true);
    db.close();
  });
});

describe('deleteDatabase', () => {
  it('deletes a database, closing our own connection on the way', async () => {
    const db = await openDatabase({ name: 'gone-db', migrations: [() => {}] });
    expect(await deleteDatabase('gone-db')).toBe(true);
    expect(() => db.transaction([...db.objectStoreNames])).toThrow();
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain('gone-db');
  });

  it('reports false when another connection refuses to close', async () => {
    const stubborn = await new Promise((resolve) => {
      const request = indexedDB.open('stuck-db', 1);
      request.onsuccess = () => resolve(request.result);
    });
    expect(await deleteDatabase('stuck-db')).toBe(false);
    stubborn.close();
    expect(await deleteDatabase('stuck-db')).toBe(true);
  });
});
