import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  DB_NAME,
  LOCAVERN_MIGRATIONS,
  acquireWriteLock,
  loadHydrationPayload,
  openLocavernDb,
} from '../../src/adapters/storage-idb.js';

// Frozen contract: existing users' data lives under these names and this shape.
const V4_STORES = [
  'assets',
  'meta',
  'notes',
  'projects',
  'tasks',
  'templates',
  'trash',
  'whiteboards',
];

const V1_TO_V3_STORES = ['meta', 'projects', 'tasks', 'notes', 'whiteboards', 'assets'];

/**
 * Build a database with the raw IndexedDB API, the way an older release left it.
 * @param {number} version
 * @param {string[]} storeNames
 * @param {Record<string, unknown[]>} records
 */
async function createLegacyDatabase(version, storeNames, records) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('locavern-db', version);
    request.onupgradeneeded = () => {
      for (const name of storeNames) {
        request.result.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const [store, values] of Object.entries(records)) {
      for (const value of values) tx.objectStore(store).put(value);
    }
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const legacyRecords = {
  meta: [
    { key: 'schema', schemaVersion: 2 },
    { key: 'preferences', value: { theme: 'dark' } },
    { key: 'lastBackupAt', value: '2026-01-02T03:04:05.000Z' },
  ],
  projects: [{ id: 'p1', name: 'Alpha' }],
  tasks: [{ id: 't1', projectId: 'p1', title: 'Write tests' }],
  notes: [{ id: 'n1', title: 'A note' }],
  whiteboards: [{ id: 'w1', title: 'Board' }],
  assets: [
    {
      id: 'a1',
      mimeType: 'text/plain',
      sizeBytes: 5,
      filename: 'a.txt',
      createdAt: 'x',
      blob: new Blob(['hello'], { type: 'text/plain' }),
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Locavern database contract', () => {
  it('keeps the persisted name and version', async () => {
    expect(DB_NAME).toBe('locavern-db');
    expect(LOCAVERN_MIGRATIONS).toHaveLength(4);
    const db = await openLocavernDb();
    expect(db.name).toBe('locavern-db');
    expect(db.version).toBe(4);
    db.close();
  });

  it('creates exactly the version 4 stores on a fresh install', async () => {
    const db = await openLocavernDb();
    expect([...db.objectStoreNames].sort()).toEqual(V4_STORES);
    const tx = db.transaction(V4_STORES);
    for (const name of V4_STORES) {
      const store = tx.objectStore(name);
      expect(store.keyPath).toBe(name === 'meta' ? 'key' : 'id');
      expect(store.autoIncrement).toBe(false);
      expect([...store.indexNames]).toEqual([]);
    }
    db.close();
  });

  it('reopens a current database without touching its data', async () => {
    const first = await openLocavernDb();
    await first.put('projects', { id: 'p1', name: 'Alpha' });
    first.close();
    const second = await openLocavernDb();
    expect(await second.get('projects', 'p1')).toEqual({ id: 'p1', name: 'Alpha' });
    second.close();
  });
});

describe('opening a database written by a previous release', () => {
  it.each([1, 2, 3])('upgrades a version %i database and keeps every record', async (version) => {
    await createLegacyDatabase(version, V1_TO_V3_STORES, legacyRecords);

    const db = await openLocavernDb();
    expect(db.version).toBe(4);
    expect([...db.objectStoreNames].sort()).toEqual(V4_STORES);

    expect(await db.getAll('projects')).toEqual(legacyRecords.projects);
    expect(await db.getAll('tasks')).toEqual(legacyRecords.tasks);
    expect(await db.getAll('notes')).toEqual(legacyRecords.notes);
    expect(await db.getAll('whiteboards')).toEqual(legacyRecords.whiteboards);
    expect((await db.getAll('meta')).sort((a, b) => a.key.localeCompare(b.key))).toEqual(
      [...legacyRecords.meta].sort((a, b) => a.key.localeCompare(b.key)),
    );
    const asset = await db.get('assets', 'a1');
    expect(asset.filename).toBe('a.txt');
    expect(await asset.blob.text()).toBe('hello');
    expect(await db.getAll('trash')).toEqual([]);
    expect(await db.getAll('templates')).toEqual([]);

    // The app's own loader reads the migrated database.
    const payload = await loadHydrationPayload(db);
    expect(payload.projects).toEqual(legacyRecords.projects);
    expect(payload.preferences).toEqual({ theme: 'dark' });
    expect(payload.assets.map((a) => a.id)).toEqual(['a1']);
    db.close();
  });

  it('completes a database that lacks some of the older stores', async () => {
    await createLegacyDatabase(2, ['meta', 'projects', 'tasks'], {
      projects: [{ id: 'p1', name: 'Alpha' }],
    });
    const db = await openLocavernDb();
    expect([...db.objectStoreNames].sort()).toEqual(V4_STORES);
    expect(await db.getAll('projects')).toEqual([{ id: 'p1', name: 'Alpha' }]);
    db.close();
  });

  it('ends in the same state as a fresh install', async () => {
    /** @param {import('idb').IDBPDatabase} db */
    const describeStores = async (db) => {
      const tx = db.transaction([...db.objectStoreNames]);
      return [...db.objectStoreNames].sort().map((name) => {
        const s = tx.objectStore(name);
        return [name, s.keyPath, s.autoIncrement, [...s.indexNames]];
      });
    };
    const fresh = await openLocavernDb();
    const expected = await describeStores(fresh);
    fresh.close();
    indexedDB.deleteDatabase('locavern-db');

    await createLegacyDatabase(1, V1_TO_V3_STORES, {});
    const upgraded = await openLocavernDb();
    expect(await describeStores(upgraded)).toEqual(expected);
    upgraded.close();
  });
});

describe('write lock names', () => {
  it('uses the Locavern lock name', async () => {
    const request = vi.fn((_name, _options, callback) => callback(null));
    vi.stubGlobal('navigator', { locks: { request } });
    await acquireWriteLock();
    expect(request).toHaveBeenCalledWith(
      'locavern-write-lock',
      { ifAvailable: true },
      expect.any(Function),
    );
  });

  it('uses the Locavern broadcast channel name', async () => {
    /** @type {string[]} */
    const names = [];
    class FakeChannel {
      /** @param {string} name */
      constructor(name) {
        names.push(name);
      }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    vi.stubGlobal('navigator', {
      locks: {
        /** @param {string} _n @param {unknown} _o @param {(lock: object) => unknown} callback */
        request: (_n, _o, callback) => callback({}),
      },
    });
    const handle = await acquireWriteLock();
    handle.release();
    expect(names).toEqual(['locavern-lock-channel']);
  });
});
