// Store on IndexedDB (fake-indexeddb): differential writes and migration on load. The two-tab
// behaviour is in store-single-writer.test.js.
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

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: h(9) });
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
  await store.init();
  return store;
}

const names = async (/** @type {string} */ collection) =>
  (await readStore(DB, collection)).map((x) => x.name).sort();

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

describe('immediate flush when the page goes away', () => {
  /**
   * From now on the 80 ms debounce can never fire on its own: only `setTimeout` and
   * `clearTimeout` are faked, and the fake time is never advanced. `installBrowser` fakes `Date`,
   * so the date is set again. `uninstallBrowser` restores the real timers, which drops any
   * pending debounce: nothing leaks into the next test.
   */
  function freezeDebounce() {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(h(9));
  }

  /** Lets the fake IndexedDB, which runs on `setImmediate`, finish what it was asked to do. */
  async function drain() {
    // Node's `setImmediate` is not in the DOM typings of this project.
    const { setImmediate } = /** @type {{ setImmediate: (fn: () => void) => void }} */ (
      /** @type {unknown} */ (globalThis)
    );
    for (let i = 0; i < 100; i += 1) await new Promise((resolve) => setImmediate(() => resolve(0)));
  }

  /** @type {(() => void)[]} */
  let documentListeners = [];

  /** A `document` that records its `visibilitychange` listeners (Node has none). */
  function stubDocument(/** @type {string} */ visibilityState) {
    documentListeners = [];
    vi.stubGlobal('document', {
      visibilityState,
      addEventListener: (/** @type {string} */ type, /** @type {() => void} */ fn) => {
        if (type === 'visibilitychange') documentListeners.push(fn);
      },
    });
  }

  test('pagehide writes the pending change without waiting for the debounce', async () => {
    const store = await newStore();
    freezeDebounce();

    store.actions.addProject('Alpha');
    await drain();
    expect(await names('projects')).toEqual([]); // the debounce has not fired
    nav.fire('pagehide');
    await drain();

    expect(await names('projects')).toEqual(['Alpha']);
  });

  test('pagehide without a change writes nothing', async () => {
    await newStore();
    freezeDebounce();
    spyOnWrites();

    nav.fire('pagehide');
    await drain();

    expect(ops).toEqual([]);
  });

  test('visibilitychange to hidden flushes the pending change too', async () => {
    stubDocument('hidden');
    const store = await newStore();
    freezeDebounce();

    store.actions.addProject('Alpha');
    documentListeners.forEach((fn) => fn());
    await drain();

    expect(await names('projects')).toEqual(['Alpha']);
  });

  test('visibilitychange to visible does not flush', async () => {
    stubDocument('visible');
    const store = await newStore();
    freezeDebounce();

    store.actions.addProject('Alpha');
    documentListeners.forEach((fn) => fn());
    await drain();

    expect(await names('projects')).toEqual([]);
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
