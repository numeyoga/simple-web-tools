// The first start after the previous version, against a fake localStorage and a fake IndexedDB:
// one workspace per old space, the old keys untouched, the import run once.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { openWorkspaceDatabase, readWorkspace } from '../../src/adapters/idb.js';
import { needsLegacyImport, runLegacyImport } from '../../src/adapters/legacy-import.js';
import { createAppStore } from '../../src/adapters/store.js';
import { activeWorkspaceId, listWorkspaces } from '../../src/adapters/workspaces.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { readStore } from './support/idb.js';
import { multiSpaceStorage, singleKeyStorage } from './support/legacy-fixtures.js';

const NOW = new Date(2026, 10, 22, 10, 0).getTime();
const LABEL = 'Mes favoris';

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: NOW });
});
afterEach(uninstallBrowser);

/** Puts the old keys in the storage, and returns a log of every write made afterwards. @param {Record<string, string>} keys */
function seed(keys) {
  for (const [key, value] of Object.entries(keys)) nav.localStorage.setItem(key, value);
  /** @type {string[]} */
  const writes = [];
  const { setItem, removeItem } = nav.localStorage;
  nav.localStorage.setItem = (key, value) => {
    writes.push(`set ${key}`);
    setItem(key, value);
  };
  nav.localStorage.removeItem = (key) => {
    writes.push(`remove ${key}`);
    removeItem(key);
  };
  return writes;
}

const run = () => runLegacyImport({ storage: nav.localStorage, defaultLabel: LABEL, now: NOW });

describe('a browser with several spaces', () => {
  test('creates one workspace per space, with its groups and links, and makes the open one active', async () => {
    seed(multiSpaceStorage());

    const result = await run();

    expect(result).toEqual({
      workspaces: 3,
      links: 7,
      skipped: { groups: 0, links: 0, unsafeUrls: 1 },
      unreadable: 0,
    });
    expect(listWorkspaces().map((w) => [w.id, w.label])).toEqual([
      ['default', 'Mon espace'],
      ['travail', 'Travail'],
      ['lectures-2', 'Lectures'],
    ]);
    expect(activeWorkspaceId()).toBe('travail');
    expect(await readStore('favoris__default', 'links')).toHaveLength(6);
    expect(await readStore('favoris__travail', 'groups')).toEqual([
      expect.objectContaining({ id: 'clients', label: 'Clients', category: 14 }),
    ]);
    expect(await readStore('favoris__lectures-2', 'links')).toEqual([]);
  });

  test('the new app reads what was imported', async () => {
    seed(multiSpaceStorage());
    await run();

    const store = createAppStore({ workspaceId: 'default' });
    await store.init();
    const { groups, links } = store.getState();
    await store.close();

    expect(groups.map((g) => g.id)).toEqual(['docs', 'tools', 'reading', 'ancien-tag']);
    expect(links.map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4', 'l5', 'l7']);
  });

  test('never changes or deletes an old key: they stay as a backup', async () => {
    const keys = multiSpaceStorage();
    const writes = seed(keys);

    await run();

    for (const [key, value] of Object.entries(keys))
      expect(nav.localStorage.getItem(key)).toBe(value);
    // Only this app's own keys were written, none of the old `favoris.` ones, and nothing removed.
    expect(writes.filter((w) => w.startsWith('remove'))).toEqual([]);
    expect(writes.filter((w) => /^set favoris\./.test(w))).toEqual([]);
    expect(writes.sort()).toEqual([
      'set favoris-legacy-import',
      'set favoris-theme',
      'set favoris-workspace-active',
      'set favoris-workspaces',
    ]);
  });

  test('keeps the old theme as the theme, unless one is already chosen', async () => {
    seed(multiSpaceStorage());
    await run();
    expect(nav.localStorage.getItem('favoris-theme')).toBe('dark');
  });

  test('runs once: the flag is set, and a second start does nothing', async () => {
    seed(multiSpaceStorage());
    await run();
    expect(nav.localStorage.getItem('favoris-legacy-import')).toBe('1');
    expect(needsLegacyImport(nav.localStorage)).toBe(false);

    // The data of the new app changes, then the app starts again: the old data is not imported over it.
    const store = createAppStore({ workspaceId: 'travail' });
    await store.init();
    store.dispatch({ type: 'delete_link', id: 't1' });
    await store.close();
    expect(await run()).toBeNull();
    expect(await readStore('favoris__travail', 'links')).toEqual([]);
  });

  test('does not run when this app already has workspaces', async () => {
    seed(multiSpaceStorage());
    nav.localStorage.setItem(
      'favoris-workspaces',
      JSON.stringify([{ id: 'mine', label: 'Mine', createdAt: 1 }]),
    );

    expect(await run()).toBeNull();
    expect(listWorkspaces().map((w) => w.id)).toEqual(['mine']);
    expect((await indexedDB.databases()).map((d) => d.name)).toEqual([]);
  });
});

describe('a browser with the single key of the versions before spaces', () => {
  test('imports it as one workspace', async () => {
    seed(singleKeyStorage());

    const result = await run();

    expect(result).toMatchObject({ workspaces: 1, links: 2 });
    expect(listWorkspaces()).toEqual([{ id: 'default', label: LABEL, createdAt: NOW }]);
    const store = createAppStore({ workspaceId: 'default' });
    await store.init();
    expect(store.getState().links.map((l) => l.name)).toEqual(['MDN', 'Sans tag']);
    expect(store.getState().groups[0]).toMatchObject({ id: 'docs', category: 9, featured: true });
    await store.close();
    expect(nav.localStorage.getItem('favoris.v1')).toBe(singleKeyStorage()['favoris.v1']);
  });
});

describe('a browser that never ran the previous version', () => {
  test('imports nothing, creates no database, and records that it looked', async () => {
    expect(await run()).toBeNull();
    expect(nav.localStorage.getItem('favoris-legacy-import')).toBe('1');
    expect(nav.localStorage.getItem('favoris-workspaces')).toBeNull();
    expect((await indexedDB.databases()).map((d) => d.name)).toEqual([]);
  });
});

describe('failures and races', () => {
  test('a database that cannot be written rejects, and nothing is recorded: the next start tries again', async () => {
    seed(multiSpaceStorage());

    await expect(
      runLegacyImport({
        storage: nav.localStorage,
        defaultLabel: LABEL,
        now: NOW,
        writeWorkspace: async () => {
          throw new Error('quota');
        },
      }),
    ).rejects.toMatchObject({ name: 'StorageError' });

    expect(nav.localStorage.getItem('favoris-workspaces')).toBeNull();
    expect(nav.localStorage.getItem('favoris-legacy-import')).toBeNull();
    expect(await run()).toMatchObject({ workspaces: 3 });
  });

  test('an import that is retried writes the same databases over: nothing is doubled', async () => {
    seed(multiSpaceStorage());
    await runLegacyImport({
      storage: nav.localStorage,
      defaultLabel: LABEL,
      now: NOW,
      writeWorkspace: async (id, data) => {
        const db = await openWorkspaceDatabase(id);
        const { replaceWorkspace } = await import('../../src/adapters/idb.js');
        await replaceWorkspace(db, data);
        db.close();
        if (id === 'travail') throw new Error('crash halfway');
      },
    }).catch(() => {});
    expect(nav.localStorage.getItem('favoris-workspaces')).toBeNull();

    await run();

    const db = await openWorkspaceDatabase('default');
    expect((await readWorkspace(db)).links).toHaveLength(6);
    db.close();
  });

  test('two tabs that start together import once, under the app’s own lock', async () => {
    seed(multiSpaceStorage());

    const [a, b] = await Promise.all([run(), run()]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(nav.locks.requested).toEqual([
      'favoris-legacy-import-lock',
      'favoris-legacy-import-lock',
    ]);
    expect(listWorkspaces()).toHaveLength(3);
  });
});
