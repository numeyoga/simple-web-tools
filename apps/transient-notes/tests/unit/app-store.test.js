// The application store of a workspace: hydration, the write queue, and the single-writer model
// (decision 0004): one tab holds `transient-notes-write-lock` and writes, the other tabs are
// read-only, re-read what the writer announces and take over when the writer goes away.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readBackup, serializeBackup } from '../../src/adapters/backup.js';
import { coalesceEffects, createAppStore, StorageError } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { openRaw, putRecords, readStore } from './support/idb.js';
import { asset, at, doc, docWithImage, folder, note } from './support/data.js';

const DB = 'transient-notes__default';
const LOCK = 'transient-notes-write-lock';
const png = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });

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
const ids = (store) =>
  store
    .getState()
    .notes.map((n) => n.id)
    .sort();

describe('start', () => {
  test('an empty workspace starts empty, writer, with nothing written but the schema', async () => {
    const store = await newStore();

    expect(store.getState()).toMatchObject({ readOnly: false, folders: [], notes: [], assets: [] });
    expect(nav.locks.isHeld(LOCK)).toBe(true);
    expect(await readStore(DB, 'notes')).toEqual([]);
  });

  test('reads what the database holds, cleaned', async () => {
    (
      await openRaw(DB, 1, (db) => {
        db.createObjectStore('meta', { keyPath: 'key' });
        for (const name of ['folders', 'notes', 'assets'])
          db.createObjectStore(name, { keyPath: 'id' });
      })
    ).close();
    await putRecords(DB, {
      meta: [{ key: 'preferences', value: { sort: 'created' } }],
      folders: [folder({ id: 'f1' })],
      notes: [note({ id: 'n1', folderId: 'f1' }), note({ id: 'n2', folderId: 'gone' })],
    });

    const store = await newStore();

    expect(ids(store)).toEqual(['n1', 'n2']);
    expect(store.getState().notes.find((n) => n.id === 'n2')?.folderId).toBeNull();
    expect(store.getState().preferences.sort).toBe('created');
  });

  test('drops the pictures no note shows at start, and keeps the ones that are shown', async () => {
    const first = await newStore();
    first.dispatch({ type: 'create_note', id: 'n1', now: at() });
    first.dispatch({ type: 'update_note', id: 'n1', now: at(1), doc: docWithImage('used') });
    first.dispatch({ type: 'add_asset', asset: asset('used'), blob: png() });
    first.dispatch({ type: 'add_asset', asset: asset('orphan'), blob: png() });
    await first.flush();
    await first.close();
    opened = [];

    const second = await newStore();

    expect(second.getState().assets.map((a) => a.id)).toEqual(['used']);
    await second.flush();
    expect((await readStore(DB, 'assets')).map((a) => a.id)).toEqual(['used']);
  });

  test('without IndexedDB it rejects as "unavailable" and gives the lock back', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createAppStore({ workspaceId: 'default' });

    await expect(store.init()).rejects.toBeInstanceOf(StorageError);

    expect(nav.locks.isHeld(LOCK)).toBe(false);
  });
});

describe('writing', () => {
  test('a command reaches the database after flush, and reading it back gives the same notes', async () => {
    const store = await newStore();

    store.dispatch({
      type: 'create_folder',
      id: 'f1',
      name: 'Garden',
      category: 'areas',
      now: at(),
    });
    store.dispatch({ type: 'create_note', id: 'n1', now: at(1), category: 'areas' });
    store.dispatch({ type: 'update_note', id: 'n1', now: at(2), title: 'Plan', doc: doc('Hello') });
    await store.flush();

    expect(await readStore(DB, 'folders')).toEqual(store.getState().folders);
    expect(await readStore(DB, 'notes')).toEqual(store.getState().notes);
    expect((await readStore(DB, 'notes'))[0]).toMatchObject({ title: 'Plan', folderId: 'f1' });
  });

  test('a burst of edits of the same note is written as its last version', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await store.flush();

    for (let i = 1; i <= 50; i += 1) {
      store.dispatch({ type: 'update_note', id: 'n1', now: at(i), doc: doc(`text ${i}`) });
    }
    await store.flush();

    const [stored] = await readStore(DB, 'notes');
    expect(JSON.stringify(stored.doc)).toContain('text 50');
    expect(stored.updatedAt).toBe(at(50));
  });

  test('coalesceEffects keeps the last effect of each record, in order of last write', () => {
    const a = note({ id: 'a' });
    const merged = coalesceEffects([
      { type: 'persist_note', note: a },
      { type: 'persist_note', note: note({ id: 'b' }) },
      { type: 'persist_note', note: { ...a, title: 'later' } },
      { type: 'persist_asset', asset: asset('x'), blob: png() },
      { type: 'remove_asset', id: 'x' },
      { type: 'persist_preferences', preferences: { sort: 'title' } },
      { type: 'persist_preferences', preferences: { sort: 'created' } },
    ]);

    expect(merged.map((e) => e.type)).toEqual([
      'persist_note',
      'persist_note',
      'remove_asset',
      'persist_preferences',
    ]);
    expect(merged[1]).toMatchObject({ note: { id: 'a', title: 'later' } });
    expect(merged[3]).toMatchObject({ preferences: { sort: 'created' } });
  });

  test('deleting a note deletes the pictures only it shows', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_note', id: 'n1', now: at() });
    store.dispatch({ type: 'update_note', id: 'n1', now: at(1), doc: docWithImage('a1') });
    store.dispatch({ type: 'add_asset', asset: asset('a1'), blob: png() });
    await store.flush();
    expect((await readStore(DB, 'assets')).map((a) => a.id)).toEqual(['a1']);

    store.dispatch({ type: 'delete_note', id: 'n1' });
    await store.flush();

    expect(await readStore(DB, 'assets')).toEqual([]);
    expect(await readStore(DB, 'notes')).toEqual([]);
  });

  test('the pending writes go out when the tab is hidden or closed', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_note', id: 'n1', now: at() });

    nav.fire('pagehide', { persisted: false });

    await vi.waitFor(async () => expect((await readStore(DB, 'notes')).length).toBe(1));
    store.dispatch({ type: 'create_note', id: 'n2', now: at(1) });
    /** @type {{ visibilityState: string }} */ (/** @type {unknown} */ (document)).visibilityState =
      'hidden';
    nav.fire('visibilitychange');
    await vi.waitFor(async () => expect((await readStore(DB, 'notes')).length).toBe(2));
  });

  test('a failed write keeps the changes, tells the listeners and retries on the next change', async () => {
    const store = await newStore();
    const failures = vi.fn();
    store.onWriteError(failures);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    store.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await store.flush();
    expect(failures).toHaveBeenCalledTimes(1);
    expect(await readStore(DB, 'notes')).toEqual([]);

    put.mockRestore();
    store.dispatch({ type: 'create_note', id: 'n2', now: at(1) });
    await store.flush();

    expect((await readStore(DB, 'notes')).map((n) => n.id).sort()).toEqual(['n1', 'n2']);
  });
});

describe('pictures', () => {
  test('addImage stores an allowed picture and serves it before and after it is written', async () => {
    const store = await newStore();

    const result = store.addImage(png());

    expect('asset' in result).toBe(true);
    const id = 'asset' in result ? result.asset.id : '';
    expect(store.getState().assets.map((a) => a.id)).toEqual([id]);
    expect((await store.getAssetBlob(id))?.size).toBe(4); // from memory
    await store.flush();
    expect((await readStore(DB, 'assets')).map((a) => a.id)).toEqual([id]);
    expect((await store.getAssetBlob(id))?.size).toBe(4); // from the database
    expect(await store.getAssetBlob('nope')).toBeNull();
  });

  test('refuses an SVG, a text file and a picture over 10 MiB', async () => {
    const store = await newStore();

    expect(store.addImage(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).toEqual({
      error: 'unsupported-type',
    });
    expect(store.addImage(new Blob(['x'], { type: 'text/plain' }))).toEqual({
      error: 'unsupported-type',
    });
    const huge = /** @type {Blob} */ (
      /** @type {unknown} */ ({ type: 'image/png', size: 11 * 1024 * 1024 })
    );
    expect(store.addImage(huge)).toEqual({ error: 'too-large' });
    expect(store.getState().assets).toEqual([]);
  });

  test('getAssetUrl gives one blob: URL per picture, revoked on request', async () => {
    const store = await newStore();
    const create = vi.fn(() => 'blob:fake-1');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const result = store.addImage(png());
    const id = 'asset' in result ? result.asset.id : '';

    expect(await store.getAssetUrl(id)).toBe('blob:fake-1');
    expect(await store.getAssetUrl(id)).toBe('blob:fake-1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(await store.getAssetUrl('nope')).toBeNull();
    store.revokeAssetUrls();
    expect(revoke).toHaveBeenCalledWith('blob:fake-1');
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
    writer.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await writer.flush();
    const reader = await newStore();
    const refused = vi.fn();
    reader.onRefused(refused);

    reader.dispatch({ type: 'create_note', id: 'n2', now: at(1) });
    reader.dispatch({ type: 'delete_note', id: 'n1' });
    const image = reader.addImage(png());
    await reader.flush();

    expect(image).toEqual({ error: 'read-only' });
    expect(refused).toHaveBeenCalledTimes(3);
    expect(ids(reader)).toEqual(['n1']);
    expect((await readStore(DB, 'notes')).map((n) => n.id)).toEqual(['n1']);
    expect(await readStore(DB, 'assets')).toEqual([]);
  });

  test('a read-only tab keeps its own view: selection, search, sort and the open note', async () => {
    const writer = await newStore();
    writer.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await writer.flush();
    const reader = await newStore();
    const refused = vi.fn();
    reader.onRefused(refused);

    reader.dispatch({ type: 'select_note', noteId: 'n1' });
    reader.dispatch({ type: 'set_search', query: 'x' });
    reader.dispatch({ type: 'set_sort', sort: 'title' });
    await reader.flush();

    expect(refused).not.toHaveBeenCalled();
    expect(reader.getState()).toMatchObject({ selectedNoteId: 'n1', search: 'x' });
    expect(await readStore(DB, 'meta')).toEqual([]); // the sort of a reader is not saved
  });

  test('a change of the writer appears in the read-only tab, which keeps its view', async () => {
    const writer = await newStore();
    const reader = await newStore();
    reader.dispatch({ type: 'set_search', query: 'plan' });
    const listener = vi.fn();
    reader.subscribe(listener);

    writer.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await writer.flush();

    await vi.waitFor(() => expect(ids(reader)).toEqual(['n1']));
    expect(reader.getState().search).toBe('plan');
    expect(listener).toHaveBeenCalled();
  });

  test('a deletion by the writer disappears from the read-only tab, and from its selection', async () => {
    const writer = await newStore();
    writer.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await writer.flush();
    const reader = await newStore();
    reader.dispatch({ type: 'select_note', noteId: 'n1' });

    writer.dispatch({ type: 'delete_note', id: 'n1' });
    await writer.flush();

    await vi.waitFor(() => expect(ids(reader)).toEqual([]));
    expect(reader.getState().selectedNoteId).toBeNull();
  });

  test('when the writer goes away the read-only tab takes the lock, re-reads and can write', async () => {
    const writer = await newStore();
    const reader = await newStore();
    writer.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await writer.flush();
    nav.locks.crash(LOCK); // the writer's tab dies right after its last write

    await vi.waitFor(() => expect(reader.getState().readOnly).toBe(false));

    expect(ids(reader)).toEqual(['n1']);
    reader.dispatch({ type: 'create_note', id: 'n2', now: at(1) });
    await reader.flush();
    expect((await readStore(DB, 'notes')).map((n) => n.id).sort()).toEqual(['n1', 'n2']);
  });

  test('"resume editing" does nothing while the other tab still writes', async () => {
    await newStore();
    const reader = await newStore();

    expect(await reader.retryWriteLock()).toBe(false);
    expect(reader.getState().readOnly).toBe(true);
  });

  test('only one of two waiting tabs becomes the writer', async () => {
    const writer = await newStore();
    const second = await newStore();
    const third = await newStore();
    writer.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await writer.flush();

    nav.locks.crash(LOCK);

    await vi.waitFor(() =>
      expect([second, third].filter((s) => !s.getState().readOnly)).toHaveLength(1),
    );
  });

  test('the lock is one for the whole app: a tab on another workspace is read-only too', async () => {
    await newStore('default');
    const other = await newStore('work');

    expect(other.getState().readOnly).toBe(true);
  });
});

describe('backup', () => {
  test('exportBackup waits for the pending writes and carries the pictures; replaceAll restores them', async () => {
    const store = await newStore();
    store.dispatch({ type: 'create_folder', id: 'f1', name: 'F', category: 'areas', now: at() });
    store.dispatch({ type: 'create_note', id: 'n1', now: at(1), category: 'areas' });
    const image = store.addImage(png());
    const assetId = 'asset' in image ? image.asset.id : '';
    store.dispatch({
      type: 'update_note',
      id: 'n1',
      now: at(2),
      title: 'T',
      doc: docWithImage(assetId),
    });

    const envelope = await store.exportBackup();

    expect(envelope).toMatchObject({
      app: 'transient-notes',
      format: 'transient-notes-workspace',
      version: 1,
    });
    const restored = readBackup(serializeBackup(envelope));
    expect(restored.assets).toHaveLength(1);
    expect(restored.assets[0]?.blob.size).toBe(4);
    expect(restored.notes[0]).toMatchObject({ id: 'n1', title: 'T' });

    store.dispatch({ type: 'delete_note', id: 'n1' });
    await store.flush();
    expect(store.getState().notes).toEqual([]);

    expect(await store.replaceAll(restored)).toBe(true);

    expect(ids(store)).toEqual(['n1']);
    expect((await store.getAssetBlob(assetId))?.size).toBe(4);
    expect((await readStore(DB, 'assets')).map((a) => a.id)).toEqual([assetId]);
  });

  test('a read-only tab cannot replace the data', async () => {
    await newStore();
    const reader = await newStore();
    const refused = vi.fn();
    reader.onRefused(refused);

    expect(await reader.replaceAll({ folders: [], notes: [note({ id: 'x' })], assets: [] })).toBe(
      false,
    );

    expect(refused).toHaveBeenCalled();
    expect(await readStore(DB, 'notes')).toEqual([]);
  });

  test('replaceAll tells the read-only tabs of the workspace', async () => {
    const writer = await newStore();
    const reader = await newStore();

    await writer.replaceAll({ folders: [], notes: [note({ id: 'imported' })], assets: [] });

    await vi.waitFor(() => expect(ids(reader)).toEqual(['imported']));
  });
});
