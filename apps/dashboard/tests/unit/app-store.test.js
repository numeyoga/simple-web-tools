// The application store of a workspace: hydration, the write queue, and the single-writer model
// (decision 0004): one tab holds `dashboard-write-lock` and writes, the other tabs are read-only,
// re-read what the writer announces and take over when the writer goes away.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readBackup, serializeBackup } from '../../src/adapters/backup.js';
import { StorageError, coalesceEffects, createAppStore } from '../../src/adapters/store.js';
import { emptyWorkspaceData } from '../../src/adapters/starting.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { app, settings, template } from './support/data.js';
import { openRaw, putRecords, readStore } from './support/idb.js';

const DB = 'dashboard__default';
const LOCK = 'dashboard-write-lock';

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
const appIds = (store) => store.getState().apps.map((a) => a.id);

/** @param {string} id */
const addTemplate = (id) => ({
  type: /** @type {const} */ ('add_template'),
  template: { ...template({ id }), position: undefined },
});

/** @param {string} id @param {string} templateId */
const addApp = (id, templateId = 't1') => ({
  type: /** @type {const} */ ('add_app'),
  app: { ...app({ id, templateId }), position: undefined },
});

describe('start', () => {
  test('a new workspace starts with the default tags, as writer, and writes them', async () => {
    const store = await newStore();

    expect(store.getState()).toMatchObject({ readOnly: false, templates: [], apps: [] });
    expect(store.getState().settings.tags.map((t) => t.key)).toContain('cicd');
    expect(nav.locks.isHeld(LOCK)).toBe(true);
    expect(await readStore(DB, 'settings')).toHaveLength(1);
    expect(await readStore(DB, 'apps')).toEqual([]);
  });

  test('reads what the database holds, in order and cleaned', async () => {
    (
      await openRaw(DB, 1, (db) => {
        for (const name of ['templates', 'apps']) db.createObjectStore(name, { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      })
    ).close();
    await putRecords(DB, {
      settings: [{ key: 'settings', ...settings({ dashboardName: 'Mine', defaultAppId: 'gone' }) }],
      templates: [template({ id: 't1' })],
      apps: [
        app({ id: 'b', templateId: 't1', position: 1 }),
        app({ id: 'a', templateId: 't1', position: 0 }),
        // A record that a damaged release left with an unsafe address.
        app({
          id: 'c',
          templateId: 't1',
          position: 2,
          extras: [{ id: 'x', name: 'evil', url: 'javascript:alert(1)', tag: '' }],
        }),
      ],
    });

    const store = await newStore();

    expect(appIds(store)).toEqual(['a', 'b', 'c']);
    expect(store.getState().apps[2]?.extras).toEqual([]);
    expect(store.getState().settings).toMatchObject({ dashboardName: 'Mine', defaultAppId: null });
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

    store.dispatch(addTemplate('t1'));
    store.dispatch(addApp('a1'));
    store.dispatch(addApp('a2'));
    await store.flush();

    expect(await readStore(DB, 'templates')).toEqual(store.getState().templates);
    expect(await readStore(DB, 'apps')).toEqual(store.getState().apps);
  });

  test('a reorder-free change of a template carries the applications along, in storage too', async () => {
    const store = await newStore();
    store.dispatch(addTemplate('t1'));
    store.dispatch(addApp('a1'));
    store.dispatch({
      type: 'set_meta',
      appId: 'a1',
      envKey: 'prod',
      fieldKey: 'cluster',
      value: 'ocp-1',
    });
    await store.flush();

    store.dispatch({
      type: 'update_meta_field',
      templateId: 't1',
      key: 'cluster',
      newKey: 'platform',
    });
    await store.flush();

    expect((await readStore(DB, 'apps'))[0]?.envs.prod.meta).toEqual({ platform: 'ocp-1' });
    expect((await readStore(DB, 'templates'))[0]?.metaFields[0]?.key).toBe('platform');
  });

  test('deleting an application removes it, and clears the default one, in storage', async () => {
    const store = await newStore();
    store.dispatch(addTemplate('t1'));
    store.dispatch(addApp('a1'));
    store.dispatch({ type: 'update_settings', defaultAppId: 'a1' });
    await store.flush();

    store.dispatch({ type: 'delete_app', id: 'a1' });
    await store.flush();

    expect(await readStore(DB, 'apps')).toEqual([]);
    expect((await readStore(DB, 'settings'))[0]?.defaultAppId).toBeNull();
  });

  test('a burst of edits of the same application is written as its last version', async () => {
    const store = await newStore();
    store.dispatch(addTemplate('t1'));
    store.dispatch(addApp('a1'));
    await store.flush();

    for (let i = 1; i <= 50; i += 1) {
      store.dispatch({ type: 'update_app', id: 'a1', description: `text ${i}` });
    }
    await store.flush();

    expect((await readStore(DB, 'apps'))[0]).toMatchObject({ description: 'text 50' });
  });

  test('coalesceEffects keeps the last effect of each record, in order of last write', () => {
    const a = app({ id: 'a', templateId: 't' });
    const merged = coalesceEffects([
      { type: 'persist_app', app: a },
      { type: 'persist_app', app: app({ id: 'b', templateId: 't' }) },
      { type: 'persist_app', app: { ...a, name: 'later' } },
      { type: 'persist_template', template: template({ id: 't' }) },
      { type: 'remove_template', id: 't' },
      { type: 'persist_settings', settings: settings() },
      { type: 'persist_settings', settings: settings({ dashboardName: 'x' }) },
    ]);

    expect(merged.map((e) => e.type)).toEqual([
      'persist_app',
      'persist_app',
      'remove_template',
      'persist_settings',
    ]);
    expect(merged[1]).toMatchObject({ app: { id: 'a', name: 'later' } });
    expect(merged[3]).toMatchObject({ settings: { dashboardName: 'x' } });
  });

  test('the pending writes go out when the tab is hidden or closed', async () => {
    const store = await newStore();
    store.dispatch(addTemplate('t1'));

    nav.fire('pagehide', { persisted: false });

    await vi.waitFor(async () => expect((await readStore(DB, 'templates')).length).toBe(1));
    store.dispatch(addApp('a1'));
    /** @type {{ visibilityState: string }} */ (/** @type {unknown} */ (document)).visibilityState =
      'hidden';
    nav.fire('visibilitychange');
    await vi.waitFor(async () => expect((await readStore(DB, 'apps')).length).toBe(1));
  });

  test('a failed write keeps the changes, tells the listeners and retries on the next change', async () => {
    const store = await newStore();
    const failures = vi.fn();
    store.onWriteError(failures);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    store.dispatch(addTemplate('t1'));
    await store.flush();
    expect(failures).toHaveBeenCalledTimes(1);
    expect(await readStore(DB, 'templates')).toEqual([]);

    put.mockRestore();
    store.dispatch(addTemplate('t2'));
    await store.flush();

    expect((await readStore(DB, 'templates')).map((t) => t.id).sort()).toEqual(['t1', 't2']);
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
    writer.dispatch(addTemplate('t1'));
    await writer.flush();
    const reader = await newStore();
    const refused = vi.fn();
    reader.onRefused(refused);

    reader.dispatch(addTemplate('t2'));
    reader.dispatch({ type: 'update_template', id: 't1', name: 'Other' });
    const replaced = await reader.replaceAll(emptyWorkspaceData());
    await reader.flush();

    expect(replaced).toBe(false);
    expect(refused).toHaveBeenCalledTimes(3);
    expect(reader.getState().templates.map((t) => t.id)).toEqual(['t1']);
    expect((await readStore(DB, 'templates')).map((t) => t.id)).toEqual(['t1']);
  });

  test('a read-only tab keeps its own view: the filter and the edit mode', async () => {
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

    writer.dispatch(addTemplate('t1'));
    await writer.flush();

    await vi.waitFor(() => expect(reader.getState().templates.map((t) => t.id)).toEqual(['t1']));
    expect(reader.getState().search).toBe('plan');
  });

  test('when the writer goes away the read-only tab takes the lock, re-reads and can write', async () => {
    const writer = await newStore();
    const reader = await newStore();
    writer.dispatch(addTemplate('t1'));
    writer.dispatch(addApp('a1'));
    await writer.flush();
    nav.locks.crash(LOCK); // the writer's tab dies right after its last write

    await vi.waitFor(() => expect(reader.getState().readOnly).toBe(false));

    expect(appIds(reader)).toEqual(['a1']);
    reader.dispatch(addApp('a2'));
    await reader.flush();
    expect((await readStore(DB, 'apps')).map((a) => a.id).sort()).toEqual(['a1', 'a2']);
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
    store.dispatch(addTemplate('t1'));
    store.dispatch(addApp('a1'));
    store.dispatch({ type: 'update_settings', dashboardName: 'Backoffice' });

    const envelope = await store.exportBackup();

    expect(envelope).toMatchObject({
      app: 'dashboard',
      format: 'dashboard-workspace',
      version: 1,
    });
    const restored = readBackup(serializeBackup(envelope));
    expect(restored.legacy).toBe(false);
    expect(restored.data.apps[0]).toMatchObject({ id: 'a1' });

    store.dispatch({ type: 'delete_app', id: 'a1' });
    await store.flush();
    expect(store.getState().apps).toEqual([]);

    expect(await store.replaceAll(restored.data)).toBe(true);

    expect(appIds(store)).toEqual(['a1']);
    expect(store.getState().settings.dashboardName).toBe('Backoffice');
    expect((await readStore(DB, 'apps')).map((a) => a.id)).toEqual(['a1']);
  });

  test('replaceAll tells the read-only tabs of the workspace', async () => {
    const writer = await newStore();
    const reader = await newStore();
    const data = {
      settings: settings(),
      templates: [template({ id: 't1' })],
      apps: [app({ id: 'imported', templateId: 't1' })],
    };

    await writer.replaceAll(data);

    await vi.waitFor(() => expect(appIds(reader)).toEqual(['imported']));
  });
});
