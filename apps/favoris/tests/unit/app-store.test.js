// The application store of a workspace: hydration, the write queue, and the single-writer model
// (decision 0004): one tab holds `favoris-write-lock` and writes, the other tabs are read-only,
// re-read what the writer announces and take over when the writer goes away.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readBackup, serializeBackup } from '../../src/adapters/backup.js';
import { StorageError, coalesceEffects, createAppStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { group, link } from './support/data.js';
import { openRaw, putRecords, readStore } from './support/idb.js';

const DB = 'favoris__default';
const LOCK = 'favoris-write-lock';

/** @type {ReturnType<typeof installBrowser>} */
let nav;
/** @type {ReturnType<typeof createAppStore>[]} */
let opened = [];
beforeEach(() => {
  nav = installBrowser();
  opened = [];
});
afterEach(async () => {
  for (const store of opened) await store.close();
  uninstallBrowser();
});

async function newStore(workspaceId = 'default') {
  const store = createAppStore({ workspaceId });
  opened.push(store);
  await store.init();
  return store;
}

/** @param {ReturnType<typeof createAppStore>} store */
const linkIds = (store) => store.getState().links.map((l) => l.id);

describe('start', () => {
  test('an empty workspace starts empty, writer, with nothing written but the schema', async () => {
    const store = await newStore();

    expect(store.getState()).toMatchObject({ readOnly: false, groups: [], links: [] });
    expect(nav.locks.isHeld(LOCK)).toBe(true);
    expect(await readStore(DB, 'links')).toEqual([]);
  });

  test('reads what the database holds, in order and cleaned', async () => {
    (
      await openRaw(DB, 1, (db) => {
        for (const name of ['groups', 'links']) db.createObjectStore(name, { keyPath: 'id' });
      })
    ).close();
    await putRecords(DB, {
      groups: [group({ id: 'g1' })],
      links: [
        link({ id: 'b', groupId: 'g1', position: 1 }),
        link({ id: 'a', groupId: 'gone', position: 0 }),
        // A record that an older or damaged release left with an unsafe address.
        link({ id: 'evil', url: 'javascript:alert(1)', position: 2 }),
      ],
    });

    const store = await newStore();

    expect(linkIds(store)).toEqual(['a', 'b']);
    expect(store.getState().links[0]?.groupId).toBeNull();
  });

  test('without IndexedDB it rejects as "unavailable" and gives the lock back', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createAppStore({ workspaceId: 'default' });

    await expect(store.init()).rejects.toBeInstanceOf(StorageError);

    expect(nav.locks.isHeld(LOCK)).toBe(false);
  });
});

describe('writing', () => {
  test('a command reaches the database after flush, and reading it back gives the same data', async () => {
    const store = await newStore();

    store.dispatch({ type: 'create_group', id: 'g1', label: 'Docs', category: 9 });
    store.dispatch({
      type: 'create_link',
      id: 'l1',
      name: 'MDN',
      url: 'mdn.example',
      groupId: 'g1',
    });
    store.dispatch({
      type: 'create_link',
      id: 'l2',
      name: 'Can I use',
      url: 'caniuse.com',
      groupId: 'g1',
    });
    await store.flush();

    expect(await readStore(DB, 'groups')).toEqual(store.getState().groups);
    expect(await readStore(DB, 'links')).toEqual(store.getState().links);
    expect((await readStore(DB, 'links'))[0]).toMatchObject({ url: 'https://mdn.example' });
  });

  test('a reorder is written, and a new start shows the same order', async () => {
    const first = await newStore();
    for (const id of ['a', 'b', 'c']) {
      first.dispatch({ type: 'create_link', id, name: id, url: `${id}.example`, groupId: null });
    }
    first.dispatch({ type: 'move_link', id: 'c', groupId: null, targetId: 'a', place: 'before' });
    await first.close();
    opened = [];

    const second = await newStore();

    expect(linkIds(second)).toEqual(['c', 'a', 'b']);
  });

  test('deleting a group detaches its links, in storage too', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_group', id: 'g1', label: 'Docs', category: 9 });
    store.dispatch({
      type: 'create_link',
      id: 'l1',
      name: 'MDN',
      url: 'mdn.example',
      groupId: 'g1',
    });
    await store.flush();

    store.dispatch({ type: 'delete_group', id: 'g1' });
    await store.flush();

    expect(await readStore(DB, 'groups')).toEqual([]);
    expect((await readStore(DB, 'links'))[0]).toMatchObject({ id: 'l1', groupId: null });
  });

  test('a burst of edits of the same link is written as its last version', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_link', id: 'l1', name: 'x', url: 'x.example', groupId: null });
    await store.flush();

    for (let i = 1; i <= 50; i += 1) {
      store.dispatch({ type: 'update_link', id: 'l1', name: `name ${i}` });
    }
    await store.flush();

    expect((await readStore(DB, 'links'))[0]).toMatchObject({ name: 'name 50' });
  });

  test('coalesceEffects keeps the last effect of each record, in order of last write', () => {
    const a = link({ id: 'a' });
    const merged = coalesceEffects([
      { type: 'persist_link', link: a },
      { type: 'persist_link', link: link({ id: 'b' }) },
      { type: 'persist_link', link: { ...a, name: 'later' } },
      { type: 'persist_group', group: group({ id: 'g' }) },
      { type: 'remove_group', id: 'g' },
    ]);

    expect(merged.map((e) => e.type)).toEqual(['persist_link', 'persist_link', 'remove_group']);
    expect(merged[1]).toMatchObject({ link: { id: 'a', name: 'later' } });
  });

  test('the pending writes go out when the tab is hidden or closed', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_link', id: 'l1', name: 'x', url: 'x.example', groupId: null });

    nav.fire('pagehide', { persisted: false });

    await vi.waitFor(async () => expect((await readStore(DB, 'links')).length).toBe(1));
    store.dispatch({ type: 'create_link', id: 'l2', name: 'y', url: 'y.example', groupId: null });
    /** @type {{ visibilityState: string }} */ (/** @type {unknown} */ (document)).visibilityState =
      'hidden';
    nav.fire('visibilitychange');
    await vi.waitFor(async () => expect((await readStore(DB, 'links')).length).toBe(2));
  });

  test('a failed write keeps the changes, tells the listeners and retries on the next change', async () => {
    const store = await newStore();
    const failures = vi.fn();
    store.onWriteError(failures);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    store.dispatch({ type: 'create_link', id: 'l1', name: 'x', url: 'x.example', groupId: null });
    await store.flush();
    expect(failures).toHaveBeenCalledTimes(1);
    expect(await readStore(DB, 'links')).toEqual([]);

    put.mockRestore();
    store.dispatch({ type: 'create_link', id: 'l2', name: 'y', url: 'y.example', groupId: null });
    await store.flush();

    expect((await readStore(DB, 'links')).map((l) => l.id).sort()).toEqual(['l1', 'l2']);
  });
});

describe('who writes', () => {
  test('the first tab is the writer, the next ones are read-only', async () => {
    const writer = await newStore();
    const reader = await newStore();

    expect(writer.getState().readOnly).toBe(false);
    expect(reader.getState().readOnly).toBe(true);
  });

  test('a read-only tab refuses every data command, tells the listeners and writes nothing', async () => {
    const writer = await newStore();
    writer.dispatch({ type: 'create_link', id: 'l1', name: 'x', url: 'x.example', groupId: null });
    await writer.flush();
    const reader = await newStore();
    const refused = vi.fn();
    reader.onRefused(refused);

    reader.dispatch({ type: 'create_link', id: 'l2', name: 'y', url: 'y.example', groupId: null });
    reader.dispatch({ type: 'delete_link', id: 'l1' });
    const replaced = await reader.replaceAll({ groups: [], links: [] });
    await reader.flush();

    expect(replaced).toBe(false);
    expect(refused).toHaveBeenCalledTimes(3);
    expect(linkIds(reader)).toEqual(['l1']);
    expect((await readStore(DB, 'links')).map((l) => l.id)).toEqual(['l1']);
  });

  test('a read-only tab keeps its own view: the search and the edit mode', async () => {
    await newStore();
    const reader = await newStore();
    const refused = vi.fn();
    reader.onRefused(refused);

    reader.dispatch({ type: 'set_search', query: 'x' });
    reader.dispatch({ type: 'set_edit_mode', editMode: true });

    expect(refused).not.toHaveBeenCalled();
    expect(reader.getState()).toMatchObject({ search: 'x', editMode: true });
  });

  test('a change of the writer appears in the read-only tab, which keeps its view', async () => {
    const writer = await newStore();
    const reader = await newStore();
    reader.dispatch({ type: 'set_search', query: 'plan' });

    writer.dispatch({ type: 'create_link', id: 'l1', name: 'x', url: 'x.example', groupId: null });
    await writer.flush();

    await vi.waitFor(() => expect(linkIds(reader)).toEqual(['l1']));
    expect(reader.getState().search).toBe('plan');
  });

  test('when the writer goes away the read-only tab takes the lock, re-reads and can write', async () => {
    const writer = await newStore();
    const reader = await newStore();
    writer.dispatch({ type: 'create_link', id: 'l1', name: 'x', url: 'x.example', groupId: null });
    await writer.flush();
    nav.locks.crash(LOCK); // the writer's tab dies right after its last write

    await vi.waitFor(() => expect(reader.getState().readOnly).toBe(false));

    expect(linkIds(reader)).toEqual(['l1']);
    reader.dispatch({ type: 'create_link', id: 'l2', name: 'y', url: 'y.example', groupId: null });
    await reader.flush();
    expect((await readStore(DB, 'links')).map((l) => l.id).sort()).toEqual(['l1', 'l2']);
  });

  test('"resume editing" does nothing while the other tab still writes', async () => {
    await newStore();
    const reader = await newStore();

    expect(await reader.retryWriteLock()).toBe(false);
    expect(reader.getState().readOnly).toBe(true);
  });

  test('the lock is one for the whole app: a tab on another workspace is read-only too', async () => {
    await newStore('default');
    const other = await newStore('work');

    expect(other.getState().readOnly).toBe(true);
  });
});

describe('backup', () => {
  test('exportBackup waits for the pending writes; replaceAll restores them', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_group', id: 'g1', label: 'Docs', category: 9, featured: true });
    store.dispatch({
      type: 'create_link',
      id: 'l1',
      name: 'MDN',
      url: 'mdn.example',
      groupId: 'g1',
    });

    const envelope = await store.exportBackup();

    expect(envelope).toMatchObject({ app: 'favoris', format: 'favoris-workspace', version: 1 });
    const restored = readBackup(serializeBackup(envelope));
    expect(restored.legacy).toBe(false);
    expect(restored.data.links[0]).toMatchObject({ id: 'l1', url: 'https://mdn.example' });

    store.dispatch({ type: 'delete_link', id: 'l1' });
    await store.flush();
    expect(store.getState().links).toEqual([]);

    expect(await store.replaceAll(restored.data)).toBe(true);

    expect(linkIds(store)).toEqual(['l1']);
    expect(store.getState().groups[0]).toMatchObject({ id: 'g1', featured: true });
    expect((await readStore(DB, 'links')).map((l) => l.id)).toEqual(['l1']);
  });

  test('replaceAll tells the read-only tabs of the workspace', async () => {
    const writer = await newStore();
    const reader = await newStore();

    await writer.replaceAll({ groups: [], links: [link({ id: 'imported' })] });

    await vi.waitFor(() => expect(linkIds(reader)).toEqual(['imported']));
  });
});
