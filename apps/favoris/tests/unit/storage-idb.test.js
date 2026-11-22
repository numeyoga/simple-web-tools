// The database of a workspace: its layout (version 1), the effects the store writes, the replace
// of an import, and the failures that end on the error screen.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  StorageError,
  applyEffects,
  migrations,
  openWorkspaceDatabase,
  readWorkspace,
  replaceWorkspace,
} from '../../src/adapters/idb.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { group, link } from './support/data.js';
import { describeDatabase, openRaw, putRecords, readStore } from './support/idb.js';

beforeEach(() => {
  installBrowser();
});
afterEach(uninstallBrowser);

describe('the layout', () => {
  test('a new database is version 1 with two stores keyed by id', async () => {
    (await openWorkspaceDatabase('default')).close();

    expect(migrations).toHaveLength(1);
    expect(await describeDatabase('favoris__default')).toEqual({
      version: 1,
      stores: { groups: 'id', links: 'id' },
    });
  });

  test('a database written as version 1 by a former release opens untouched and is read', async () => {
    // Written with the raw API, as a release of the app would have left it.
    (
      await openRaw('favoris__work', 1, (db) => {
        for (const name of ['groups', 'links']) db.createObjectStore(name, { keyPath: 'id' });
      })
    ).close();
    await putRecords('favoris__work', {
      groups: [group({ id: 'g1', position: 0 })],
      links: [link({ id: 'l1', groupId: 'g1', position: 0 })],
    });

    const db = await openWorkspaceDatabase('work');
    const data = await readWorkspace(db);
    db.close();

    expect(data.groups).toEqual([group({ id: 'g1', position: 0 })]);
    expect(data.links).toEqual([link({ id: 'l1', groupId: 'g1', position: 0 })]);
  });

  test('every workspace has its own database', async () => {
    (await openWorkspaceDatabase('default')).close();
    (await openWorkspaceDatabase('work')).close();

    expect((await indexedDB.databases()).map((d) => d.name).sort()).toEqual([
      'favoris__default',
      'favoris__work',
    ]);
  });
});

describe('applyEffects', () => {
  test('writes groups and links, and removes what is removed', async () => {
    const db = await openWorkspaceDatabase('default');

    await applyEffects(db, [
      { type: 'persist_group', group: group({ id: 'g1' }) },
      { type: 'persist_link', link: link({ id: 'l1', groupId: 'g1' }) },
      { type: 'persist_link', link: link({ id: 'l2' }) },
    ]);
    await applyEffects(db, [
      { type: 'remove_link', id: 'l2' },
      { type: 'remove_group', id: 'g1' },
    ]);

    expect(await readStore('favoris__default', 'groups')).toEqual([]);
    expect((await readStore('favoris__default', 'links')).map((l) => l.id)).toEqual(['l1']);
    db.close();
  });

  test('is all or nothing: a failing write leaves the database as it was', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [{ type: 'persist_link', link: link({ id: 'l1' }) }]);

    await expect(
      applyEffects(db, [
        { type: 'persist_link', link: link({ id: 'l2' }) },
        // A record that cannot be cloned makes the transaction fail.
        { type: 'persist_link', link: /** @type {never} */ ({ id: 'l3', name: () => {} }) },
      ]),
    ).rejects.toThrow();

    expect((await readStore('favoris__default', 'links')).map((l) => l.id)).toEqual(['l1']);
    db.close();
  });

  test('no effect, no transaction', async () => {
    const db = await openWorkspaceDatabase('default');
    const spy = vi.spyOn(db, 'transaction');
    await applyEffects(db, []);
    expect(spy).not.toHaveBeenCalled();
    db.close();
  });
});

describe('replaceWorkspace', () => {
  test('replaces everything the workspace holds', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [
      { type: 'persist_group', group: group({ id: 'old' }) },
      { type: 'persist_link', link: link({ id: 'old-link' }) },
    ]);

    await replaceWorkspace(db, {
      groups: [group({ id: 'new' })],
      links: [link({ id: 'a' }), link({ id: 'b', position: 1 })],
    });

    expect((await readStore('favoris__default', 'groups')).map((g) => g.id)).toEqual(['new']);
    expect((await readStore('favoris__default', 'links')).map((l) => l.id)).toEqual(['a', 'b']);
    db.close();
  });

  test('is all or nothing', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [{ type: 'persist_link', link: link({ id: 'keep' }) }]);

    await expect(
      replaceWorkspace(db, {
        groups: [],
        links: [link({ id: 'x' }), /** @type {never} */ ({ id: 'y', name: () => {} })],
      }),
    ).rejects.toThrow();

    expect((await readStore('favoris__default', 'links')).map((l) => l.id)).toEqual(['keep']);
    db.close();
  });
});

describe('the records come back in their own order', () => {
  test('readWorkspace returns what is stored; the core sorts it by position', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [
      { type: 'persist_link', link: link({ id: 'z', position: 0 }) },
      { type: 'persist_link', link: link({ id: 'a', position: 1 }) },
    ]);
    const { links } = await readWorkspace(db);
    db.close();

    // IndexedDB returns the records by key: the position, not the key, says the order.
    expect(links.map((l) => l.id)).toEqual(['a', 'z']);
    expect([...links].sort((x, y) => x.position - y.position).map((l) => l.id)).toEqual(['z', 'a']);
  });
});

describe('failures', () => {
  test('without IndexedDB it rejects as unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(openWorkspaceDatabase('default')).rejects.toMatchObject({
      name: 'StorageError',
      code: 'unavailable',
    });
  });

  test('a database that does not answer is unavailable after the timeout', async () => {
    // A request that never settles: the database of an older version is kept open elsewhere.
    vi.stubGlobal('indexedDB', {
      open: () => ({}),
    });
    await expect(openWorkspaceDatabase('default', { timeoutMs: 20 })).rejects.toBeInstanceOf(
      StorageError,
    );
  });
});
