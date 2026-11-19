// Store on IndexedDB (fake-indexeddb): differential writes, two tabs, migration on load.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDatabase, openDB } from '../../src/adapters/idb.js';
import { createStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { h } from './support/data.js';
import { createV1Database, readStore } from './support/idb.js';

const DB = 'chrono__default';
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const yesterday = new Date(2026, 10, 17, 9, 0).getTime();

/** Write operations seen by IndexedDB: ['put' | 'delete' | 'clear', store, key?]. */
/** @type {(string | undefined)[][]} */
let ops = [];

beforeEach(() => {
  installBrowser({ now: h(9) });
});
afterEach(uninstallBrowser);

/** Starts recording the write operations (from now on). */
function spyOnWrites() {
  ops = [];
  const proto = IDBObjectStore.prototype;
  const put = proto.put;
  const originalDelete = proto.delete;
  const clear = proto.clear;
  /**
   * @this {IDBObjectStore}
   * @param {{ id: string }} value
   * @param {IDBValidKey} [key]
   */
  function recordPut(value, key) {
    ops.push(['put', this.name, value.id]);
    return put.call(this, value, key);
  }
  /**
   * @this {IDBObjectStore}
   * @param {IDBValidKey | IDBKeyRange} key
   */
  function recordDelete(key) {
    ops.push(['delete', this.name, String(key)]);
    return originalDelete.call(this, key);
  }
  /** @this {IDBObjectStore} */
  function recordClear() {
    ops.push(['clear', this.name]);
    return clear.call(this);
  }
  vi.spyOn(proto, 'put').mockImplementation(recordPut);
  vi.spyOn(proto, 'delete').mockImplementation(recordDelete);
  vi.spyOn(proto, 'clear').mockImplementation(recordClear);
}

async function newStore() {
  const store = createStore();
  await store.init({ seedIfEmpty: false });
  return store;
}

const names = async (/** @type {string} */ collection) =>
  (await readStore(DB, collection)).map((x) => x.name).sort();

describe('two tabs', () => {
  test('neither erases the additions of the other', async () => {
    const A = await newStore();
    const B = await newStore();
    spyOnWrites();

    A.actions.addProject('Alpha');
    B.actions.addProject('Beta');
    await A.flush();
    await B.flush();

    expect(await names('projects')).toEqual(['Alpha', 'Beta']);
    expect(ops.some((o) => o[0] === 'clear')).toBe(false);
    // Reload through the BroadcastChannel: each tab sees everything.
    await vi.waitFor(() => {
      expect(A.state.projects.map((p) => p.name).sort()).toEqual(['Alpha', 'Beta']);
      expect(B.state.projects.map((p) => p.name).sort()).toEqual(['Alpha', 'Beta']);
    });
  });

  test('on reception, the tab flushes its pending writes first, then re-reads', async () => {
    const A = await newStore();
    const B = await newStore();
    B.actions.addProject('Beta');
    await B.flush();

    A.actions.addProject('Alpha'); // pending (80 ms timer) when the message of B arrives

    await vi.waitFor(async () => {
      expect(await names('projects')).toEqual(['Alpha', 'Beta']);
      expect(A.state.projects.map((p) => p.name).sort()).toEqual(['Alpha', 'Beta']);
    });
  });
});

describe('differential writes', () => {
  test('puts only the modified objects, deletes the removed ones', async () => {
    const A = await newStore();
    const a = A.actions.addProject('Alpha');
    A.actions.addProject('Beta');
    await A.flush();
    spyOnWrites();

    A.actions.updateProject(a, { name: 'Alpha2' });
    await A.flush();

    expect(ops).toEqual([['put', 'projects', a]]);

    ops.length = 0;
    A.actions.deleteProject(a);
    await A.flush();

    expect(ops).toEqual([['delete', 'projects', a]]);
    expect(await names('projects')).toEqual(['Beta']);
  });
});

describe('due-date migration on load', () => {
  test('init migrates the old due dates and rewrites only the changed todos', async () => {
    vi.setSystemTime(NOW);
    // A version 1 database, as the former release left it (French fields).
    await createV1Database(DB, {
      projets: [{ id: 'p1', nom: 'A' }],
      todos: [
        { id: 'a', titre: 'a', fait: false, echeance: 'today', creeLe: yesterday },
        { id: 'b', titre: 'b', fait: false, echeance: '2026-12-01', creeLe: yesterday },
      ],
    });
    // The upgrade to version 2 happens at the first open: do it before recording the writes.
    await openDB();
    await closeDatabase();
    spyOnWrites();

    const store = await newStore();
    expect(store.state.todos.find((x) => x.id === 'a')?.dueDate).toBe('2026-11-17');
    expect(store.state.todos.find((x) => x.id === 'b')?.dueDate).toBe('2026-12-01');

    await store.flush();

    const stored = await readStore(DB, 'todos');
    expect(stored.find((x) => x.id === 'a').dueDate).toBe('2026-11-17');
    expect(ops.filter((o) => o[0] === 'put' && o[1] === 'todos').map((o) => o[2])).toEqual(['a']);
  });
});
