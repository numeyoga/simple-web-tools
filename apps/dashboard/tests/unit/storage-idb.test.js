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
import { app, settings, template } from './support/data.js';
import { describeDatabase, openRaw, putRecords, readStore } from './support/idb.js';

beforeEach(() => {
  installBrowser();
});
afterEach(uninstallBrowser);

describe('the layout', () => {
  test('a new database is version 1 with three stores', async () => {
    (await openWorkspaceDatabase('default')).close();

    expect(migrations).toHaveLength(1);
    expect(await describeDatabase('dashboard__default')).toEqual({
      version: 1,
      stores: { templates: 'id', apps: 'id', settings: 'key' },
    });
  });

  test('a database written as version 1 by a former release opens untouched and is read', async () => {
    // Written with the raw API, as a release of the app would have left it.
    (
      await openRaw('dashboard__work', 1, (db) => {
        for (const name of ['templates', 'apps']) db.createObjectStore(name, { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      })
    ).close();
    await putRecords('dashboard__work', {
      templates: [template({ id: 't1' })],
      apps: [app({ id: 'a1', templateId: 't1' })],
      settings: [{ key: 'settings', ...settings({ dashboardName: 'Work' }) }],
    });

    const db = await openWorkspaceDatabase('work');
    const data = await readWorkspace(db);
    db.close();

    expect(data.templates).toEqual([template({ id: 't1' })]);
    expect(data.apps).toEqual([app({ id: 'a1', templateId: 't1' })]);
    expect(data.settings).toEqual(settings({ dashboardName: 'Work' }));
  });

  test('every workspace has its own database', async () => {
    (await openWorkspaceDatabase('default')).close();
    (await openWorkspaceDatabase('work')).close();

    expect((await indexedDB.databases()).map((d) => d.name).sort()).toEqual([
      'dashboard__default',
      'dashboard__work',
    ]);
  });
});

describe('applyEffects', () => {
  test('writes the settings, templates and applications, and removes what is removed', async () => {
    const db = await openWorkspaceDatabase('default');

    await applyEffects(db, [
      { type: 'persist_settings', settings: settings({ dashboardName: 'Mine' }) },
      { type: 'persist_template', template: template({ id: 't1' }) },
      { type: 'persist_app', app: app({ id: 'a1', templateId: 't1' }) },
      { type: 'persist_app', app: app({ id: 'a2', templateId: 't1' }) },
    ]);
    await applyEffects(db, [
      { type: 'remove_app', id: 'a2' },
      { type: 'remove_template', id: 't1' },
    ]);

    expect(await readStore('dashboard__default', 'templates')).toEqual([]);
    expect((await readStore('dashboard__default', 'apps')).map((a) => a.id)).toEqual(['a1']);
    expect((await readWorkspace(db)).settings?.dashboardName).toBe('Mine');
    db.close();
  });

  test('a workspace that was never written has no settings', async () => {
    const db = await openWorkspaceDatabase('default');
    expect((await readWorkspace(db)).settings).toBeUndefined();
    db.close();
  });

  test('is all or nothing: a failing write leaves the database as it was', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [{ type: 'persist_template', template: template({ id: 't1' }) }]);

    await expect(
      applyEffects(db, [
        { type: 'persist_template', template: template({ id: 't2' }) },
        // A record that cannot be cloned makes the transaction fail.
        {
          type: 'persist_template',
          template: /** @type {never} */ ({ id: 't3', name: () => {} }),
        },
      ]),
    ).rejects.toThrow();

    expect((await readStore('dashboard__default', 'templates')).map((t) => t.id)).toEqual(['t1']);
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
      { type: 'persist_settings', settings: settings({ dashboardName: 'Old' }) },
      { type: 'persist_template', template: template({ id: 'old' }) },
      { type: 'persist_app', app: app({ id: 'old-app', templateId: 'old' }) },
    ]);

    await replaceWorkspace(db, {
      settings: settings({ dashboardName: 'New' }),
      templates: [template({ id: 'new' })],
      apps: [app({ id: 'a', templateId: 'new' }), app({ id: 'b', templateId: 'new', position: 1 })],
    });

    expect((await readStore('dashboard__default', 'templates')).map((t) => t.id)).toEqual(['new']);
    expect((await readStore('dashboard__default', 'apps')).map((a) => a.id)).toEqual(['a', 'b']);
    expect((await readWorkspace(db)).settings?.dashboardName).toBe('New');
    db.close();
  });

  test('is all or nothing', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [{ type: 'persist_app', app: app({ id: 'keep', templateId: 't' }) }]);

    await expect(
      replaceWorkspace(db, {
        settings: settings(),
        templates: [],
        apps: [
          app({ id: 'x', templateId: 't' }),
          /** @type {never} */ ({ id: 'y', name: () => {} }),
        ],
      }),
    ).rejects.toThrow();

    expect((await readStore('dashboard__default', 'apps')).map((a) => a.id)).toEqual(['keep']);
    db.close();
  });
});

describe('the records come back in their own order', () => {
  test('readWorkspace returns what is stored; the core sorts it by position', async () => {
    const db = await openWorkspaceDatabase('default');
    await applyEffects(db, [
      { type: 'persist_app', app: app({ id: 'z', templateId: 't', position: 0 }) },
      { type: 'persist_app', app: app({ id: 'a', templateId: 't', position: 1 }) },
    ]);
    const { apps } = await readWorkspace(db);
    db.close();

    // IndexedDB returns the records by key: the position, not the key, says the order.
    expect(apps.map((a) => a.id)).toEqual(['a', 'z']);
    expect([...apps].sort((x, y) => x.position - y.position).map((a) => a.id)).toEqual(['z', 'a']);
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
