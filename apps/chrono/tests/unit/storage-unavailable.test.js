// IndexedDB that cannot be used: the store refuses to start, with a code the error screen
// reads, and nothing is written anywhere (not even to localStorage).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { StorageError } from '../../src/adapters/idb.js';
import { createStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { h } from './support/data.js';
import { openRaw } from './support/idb.js';

afterEach(uninstallBrowser);

describe('no IndexedDB', () => {
  /** @type {ReturnType<typeof installBrowser>} */
  let nav;
  beforeEach(() => {
    nav = installBrowser({ indexedDB: false, now: h(9) });
  });

  test('init fails as "unavailable" and the lock is given back', async () => {
    const store = createStore();

    await expect(store.init()).rejects.toMatchObject({ code: 'unavailable' });

    expect(nav.locks.isHeld('chrono-write-lock')).toBe(false);
  });

  test('nothing is written to localStorage, even with a fallback present', async () => {
    nav.localStorage.setItem('chrono-fallback-default-v2', '{"projects":[]}');
    const before = nav.localStorage.keys().sort();
    const store = createStore();

    await store.init().catch(() => {});

    // The workspace registry only creates its default list; no data key is written.
    const written = nav.localStorage.keys().filter((key) => !before.includes(key));
    expect(written).toEqual(['chrono-workspaces']);
    expect(nav.localStorage.getItem('chrono-fallback-default-v2')).toBe('{"projects":[]}');
  });

  test('the error is a StorageError', async () => {
    const error = await createStore()
      .init()
      .catch((e) => e);

    expect(error).toBeInstanceOf(StorageError);
  });
});

describe('an IndexedDB that refuses to open', () => {
  test('init fails as "unavailable"', async () => {
    installBrowser({ now: h(9) });
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = () => {
      throw new DOMException('denied', 'SecurityError');
    };

    try {
      await expect(createStore().init()).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      indexedDB.open = original;
    }
  });
});

describe('a database held by an old tab', () => {
  test('init fails as "blocked", and nothing is imported or written', async () => {
    const nav = installBrowser({ now: h(9) });
    nav.localStorage.setItem('chrono-fallback-default-v2', '{"projects":[{"id":"p"}]}');
    // An older release keeps a connection to version 1 open and ignores `versionchange`.
    const old = await openRaw('chrono__default', 1, (db) => {
      for (const name of ['projets', 'todos', 'sessions', 'pointage']) {
        db.createObjectStore(name, { keyPath: 'id' });
      }
      db.createObjectStore('meta', { keyPath: 'key' });
    });

    try {
      await expect(createStore().init()).rejects.toMatchObject({ code: 'blocked' });
      expect(nav.locks.isHeld('chrono-write-lock')).toBe(false);
    } finally {
      old.close();
    }
  });
});
