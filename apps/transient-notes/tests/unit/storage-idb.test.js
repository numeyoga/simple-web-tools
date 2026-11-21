// The database of a workspace: its layout (version 1), the effects the store writes, the replace
// of an import, and the failures that end on the error screen.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  StorageError,
  applyEffects,
  migrations,
  openWorkspaceDatabase,
  readAllAssets,
  readAssetBlob,
  readWorkspace,
  replaceWorkspace,
} from '../../src/adapters/idb.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { describeDatabase, openRaw, putRecords, readStore } from './support/idb.js';
import { asset, docWithImage, folder, note } from './support/data.js';

const png = (/** @type {number[]} */ ...bytes) =>
  new Blob([new Uint8Array(bytes)], { type: 'image/png' });

beforeEach(() => {
  installBrowser();
});
afterEach(uninstallBrowser);

describe('the layout', () => {
  test('a new database is version 1 with four stores keyed as documented', async () => {
    (await openWorkspaceDatabase('default')).close();

    expect(migrations).toHaveLength(1);
    expect(await describeDatabase('transient-notes__default')).toEqual({
      version: 1,
      stores: { assets: 'id', folders: 'id', meta: 'key', notes: 'id' },
    });
  });

  test('a database written as version 1 by a former release opens untouched and is read', async () => {
    // Written with the raw API, as a release of the app would have left it.
    const old = await openRaw('transient-notes__work', 1, (db) => {
      db.createObjectStore('meta', { keyPath: 'key' });
      for (const name of ['folders', 'notes', 'assets'])
        db.createObjectStore(name, { keyPath: 'id' });
    });
    old.close();
    await putRecords('transient-notes__work', {
      meta: [{ key: 'preferences', value: { sort: 'title' } }],
      folders: [folder({ id: 'f1' })],
      notes: [note({ id: 'n1', folderId: 'f1' })],
      assets: [{ ...asset('a1'), blob: png(1, 2, 3, 4) }],
    });

    const db = await openWorkspaceDatabase('work');
    const data = await readWorkspace(db);
    db.close();

    expect(data.folders).toEqual([folder({ id: 'f1' })]);
    expect(data.notes).toEqual([note({ id: 'n1', folderId: 'f1' })]);
    expect(data.assets).toEqual([asset('a1')]); // metadata only: no picture in the state
    expect(data.preferences).toEqual({ sort: 'title' });
  });

  test('every workspace has its own database', async () => {
    (await openWorkspaceDatabase('default')).close();
    (await openWorkspaceDatabase('work')).close();

    expect((await indexedDB.databases()).map((d) => d.name).sort()).toEqual([
      'transient-notes__default',
      'transient-notes__work',
    ]);
  });
});

describe('applyEffects', () => {
  test('writes folders, notes, assets and preferences, and removes what is removed', async () => {
    const db = await openWorkspaceDatabase('default');
    const blob = png(9, 9);

    await applyEffects(db, [
      { type: 'persist_folder', folder: folder({ id: 'f1' }) },
      { type: 'persist_note', note: note({ id: 'n1', doc: docWithImage('a1') }) },
      { type: 'persist_note', note: note({ id: 'n2' }) },
      { type: 'persist_asset', asset: asset('a1', 2), blob },
      { type: 'persist_preferences', preferences: { sort: 'created' } },
    ]);
    await applyEffects(db, [
      { type: 'remove_note', id: 'n2' },
      { type: 'remove_folder', id: 'f1' },
    ]);

    expect((await readStore('transient-notes__default', 'folders')).length).toBe(0);
    expect((await readStore('transient-notes__default', 'notes')).map((n) => n.id)).toEqual(['n1']);
    expect(await readStore('transient-notes__default', 'meta')).toEqual([
      { key: 'preferences', value: { sort: 'created' } },
    ]);
    const stored = await readAssetBlob(db, 'a1');
    expect(stored?.size).toBe(2);
    expect(stored?.type).toBe('image/png');
    expect(await readAssetBlob(db, 'nope')).toBeNull();
    db.close();
  });

  test('is all or nothing: a failing write leaves the database as it was', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [{ type: 'persist_note', note: note({ id: 'n1' }) }]);

    await expect(
      applyEffects(db, [
        { type: 'persist_note', note: note({ id: 'n2' }) },
        // A record that cannot be cloned makes the transaction fail.
        { type: 'persist_note', note: /** @type {never} */ ({ id: 'n3', doc: () => {} }) },
      ]),
    ).rejects.toThrow();

    expect((await readStore('transient-notes__default', 'notes')).map((n) => n.id)).toEqual(['n1']);
    db.close();
  });

  test('no effect, no transaction', async () => {
    const db = await openWorkspaceDatabase('default');

    await expect(applyEffects(db, [])).resolves.toBeUndefined();
    db.close();
  });
});

describe('replaceWorkspace', () => {
  test('replaces folders, notes and assets, and keeps the preferences', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [
      { type: 'persist_folder', folder: folder({ id: 'old-f' }) },
      { type: 'persist_note', note: note({ id: 'old-n' }) },
      { type: 'persist_asset', asset: asset('old-a'), blob: png(1) },
      { type: 'persist_preferences', preferences: { sort: 'title' } },
    ]);

    await replaceWorkspace(db, {
      folders: [folder({ id: 'f1' })],
      notes: [note({ id: 'n1' })],
      assets: [{ meta: asset('a1', 3), blob: png(1, 2, 3) }],
    });

    const data = await readWorkspace(db);
    expect(data.folders.map((f) => f.id)).toEqual(['f1']);
    expect(data.notes.map((n) => n.id)).toEqual(['n1']);
    expect(data.assets.map((a) => a.id)).toEqual(['a1']);
    expect(data.preferences).toEqual({ sort: 'title' });
    expect((await readAllAssets(db)).map(({ meta, blob }) => [meta.id, blob.size])).toEqual([
      ['a1', 3],
    ]);
    db.close();
  });

  test('is all or nothing', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [{ type: 'persist_note', note: note({ id: 'keep' }) }]);

    await expect(
      replaceWorkspace(db, {
        folders: [],
        notes: [/** @type {never} */ ({ id: 'bad', doc: () => {} })],
        assets: [],
      }),
    ).rejects.toThrow();

    expect((await readStore('transient-notes__default', 'notes')).map((n) => n.id)).toEqual([
      'keep',
    ]);
    db.close();
  });
});

describe('a database that cannot be used', () => {
  test('without IndexedDB the open fails as "unavailable"', async () => {
    vi.stubGlobal('indexedDB', undefined);

    await expect(openWorkspaceDatabase('default')).rejects.toMatchObject({
      name: 'StorageError',
      code: 'unavailable',
    });
  });

  test('an IndexedDB that refuses to open fails as "unavailable"', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    await expect(openWorkspaceDatabase('default')).rejects.toBeInstanceOf(StorageError);
    open.mockRestore();
  });

  test('a database from a newer release is not touched: "unavailable"', async () => {
    (await openRaw('transient-notes__default', 5, () => {})).close();

    await expect(openWorkspaceDatabase('default')).rejects.toMatchObject({ code: 'unavailable' });
    expect((await describeDatabase('transient-notes__default')).version).toBe(5);
  });

  test('an open that never answers fails as "unavailable" after the timeout', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => /** @type {never} */ ({}));

    await expect(openWorkspaceDatabase('default', { timeoutMs: 10 })).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
