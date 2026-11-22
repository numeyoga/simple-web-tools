// The workspaces of the app: the registry over localStorage, and what creating, switching and
// deleting a workspace does to the databases. Every workspace has its own IndexedDB database.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { addAppCommand } from '../../src/adapters/commands.js';
import {
  activeWorkspace,
  activeWorkspaceId,
  announceWorkspaceChange,
  createWorkspace,
  createWorkspaceWithData,
  duplicateWorkspace,
  listWorkspaces,
  removeWorkspace,
  renameWorkspace,
  switchWorkspace,
} from '../../src/adapters/workspaces.js';
import { createAppStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { template } from './support/data.js';
import { readStore } from './support/idb.js';

const NOW = new Date(2026, 10, 18, 10, 0).getTime();

/** A command that adds a template with this id. @param {string} id */
const addTemplate = (id) =>
  /** @type {import('../../src/types.d.ts').AppCommand} */ ({
    type: 'add_template',
    template: {
      id,
      name: id,
      description: '',
      envs: [{ key: 'dev', label: 'DEV' }],
      metaFields: [],
      links: [],
    },
  });

/** A command that adds an application with this id on a template. @param {string} id @param {string} templateId */
const addApp = (id, templateId) => ({
  type: /** @type {const} */ ('add_app'),
  app: {
    ...addAppCommand(template({ id: templateId, envs: [{ key: 'dev', label: 'DEV' }] }), {
      name: id,
      slug: id,
      jiraKey: '',
    }).app,
    id,
  },
});

/** Ids `id-1`, `id-2`... */
function counter() {
  let n = 0;
  return () => `id-${(n += 1)}`;
}

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: NOW });
});
afterEach(uninstallBrowser);

describe('the list', () => {
  test('a first start has one workspace, "default", named in the language of the page', () => {
    expect(listWorkspaces()).toEqual([{ id: 'default', label: 'My dashboard', createdAt: NOW }]);
    expect(activeWorkspaceId()).toBe('default');
    expect(activeWorkspace().label).toBe('My dashboard');
    expect(nav.localStorage.keys()).toEqual(['dashboard-workspaces']);
  });

  test('create makes a workspace with an id taken from its name, and does not switch', () => {
    const work = createWorkspace('  Work & Clients  ');

    expect(work).toEqual({ id: 'work-clients', label: 'Work & Clients', createdAt: NOW });
    expect(listWorkspaces().map((w) => w.id)).toEqual(['default', 'work-clients']);
    expect(activeWorkspaceId()).toBe('default');
  });

  test('two workspaces with the same name get distinct ids', () => {
    expect(createWorkspace('Work').id).toBe('work');
    expect(createWorkspace('Work').id).toBe('work-2');
  });

  test('a blank name is refused', () => {
    expect(() => createWorkspace('   ')).toThrow();
    expect(listWorkspaces()).toHaveLength(1);
  });

  test('rename changes the name, not the id (the id is the name of its database)', () => {
    createWorkspace('Work');

    expect(renameWorkspace('work', 'Office')).toMatchObject({ id: 'work', label: 'Office' });
    expect(listWorkspaces().find((w) => w.id === 'work')?.label).toBe('Office');
    expect(() => renameWorkspace('nope', 'X')).toThrow();
  });

  test('the name of a workspace is kept as text, whatever it holds', () => {
    const name = '<img src=x onerror="window.__xss=1"><b>bold</b>';

    expect(createWorkspace(name).label).toBe(name);
  });
});

describe('switching', () => {
  test('switch makes the workspace the active one and reloads the page', () => {
    createWorkspace('Work');

    switchWorkspace('work');

    expect(activeWorkspaceId()).toBe('work');
    expect(nav.localStorage.getItem('dashboard-workspace-active')).toBe('work');
    expect(nav.reload).toHaveBeenCalledTimes(1);
  });

  test('an unknown workspace cannot be switched to', () => {
    expect(() => switchWorkspace('nope')).toThrow();
    expect(nav.reload).not.toHaveBeenCalled();
  });

  test('the applications of two workspaces are separate', async () => {
    createWorkspace('Work');
    for (const [id, name] of /** @type {const} */ ([
      ['default', 'home'],
      ['work', 'work'],
    ])) {
      const store = createAppStore({ workspaceId: id });
      await store.init();
      store.dispatch(addTemplate(`${name}-tpl`));
      store.dispatch(addApp(`${name}-app`, `${name}-tpl`));
      await store.close();
    }

    expect((await readStore('dashboard__default', 'apps')).map((n) => n.id)).toEqual(['home-app']);
    expect((await readStore('dashboard__work', 'apps')).map((n) => n.id)).toEqual(['work-app']);
  });
});

describe('deleting', () => {
  test('removes the workspace from the list and deletes its database', async () => {
    createWorkspace('Work');
    const store = createAppStore({ workspaceId: 'work' });
    await store.init();
    store.dispatch(addTemplate('t1'));
    await store.close();

    expect(await removeWorkspace('work', 'default')).toBe(true);

    expect(listWorkspaces().map((w) => w.id)).toEqual(['default']);
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain('dashboard__work');
  });

  test('the last workspace cannot be deleted', async () => {
    await expect(removeWorkspace('default', 'other')).rejects.toThrow();
    expect(listWorkspaces()).toHaveLength(1);
  });

  test('neither the active workspace nor the one this tab shows can be deleted', async () => {
    createWorkspace('Work');
    createWorkspace('Home');

    await expect(removeWorkspace('default', 'work')).rejects.toThrow(/active/);
    await expect(removeWorkspace('work', 'work')).rejects.toThrow(/active/);
    expect(listWorkspaces()).toHaveLength(3);
  });

  test('an unknown workspace cannot be deleted', async () => {
    createWorkspace('Work');

    await expect(removeWorkspace('nope', 'default')).rejects.toThrow();
  });

  test('deleting a workspace leaves the other databases alone', async () => {
    createWorkspace('Work');
    for (const id of ['default', 'work']) {
      const store = createAppStore({ workspaceId: id });
      await store.init();
      store.dispatch(addTemplate(`${id}-tpl`));
      await store.close();
    }

    await removeWorkspace('work', 'default');

    expect((await readStore('dashboard__default', 'templates')).map((n) => n.id)).toEqual([
      'default-tpl',
    ]);
  });
});

describe('duplicating', () => {
  test('copies the templates and applications under a new name, in their order, and leaves the source alone', async () => {
    const source = createAppStore({ workspaceId: 'default' });
    await source.init();
    source.dispatch(addTemplate('tpl'));
    for (const id of ['b', 'a']) source.dispatch(addApp(id, 'tpl'));
    await source.flush();

    const copy = await duplicateWorkspace('default', 'My dashboard (copy)');

    expect(copy).toMatchObject({ id: 'my-dashboard-copy', label: 'My dashboard (copy)' });
    expect(listWorkspaces().map((w) => w.id)).toEqual(['default', 'my-dashboard-copy']);
    expect(activeWorkspaceId()).toBe('default'); // the copy is not made the active workspace
    const copied = createAppStore({ workspaceId: copy.id });
    await copied.init(); // read-only: the first store holds the lock
    expect(copied.getState().templates).toEqual(source.getState().templates);
    expect(copied.getState().apps).toEqual(source.getState().apps);
    expect(copied.getState().apps.map((a) => a.id)).toEqual(['b', 'a']);
    expect(copied.getState().settings.tags.length).toBeGreaterThan(0);
    await copied.close();
    await source.close();
    expect((await readStore('dashboard__default', 'apps')).map((a) => a.id).sort()).toEqual([
      'a',
      'b',
    ]);
  });

  test('a workspace made from data starts with it, and leaves nothing behind when it fails', async () => {
    const { buildSample } = await import('../../src/core/sample.js');
    const data = buildSample({ makeId: counter(), t: (key) => key });

    const made = await createWorkspaceWithData('Imported', data);

    expect(made).toMatchObject({ id: 'imported', label: 'Imported' });
    expect(listWorkspaces().map((w) => w.id)).toEqual(['default', 'imported']);
    expect(await readStore('dashboard__imported', 'apps')).toHaveLength(12);
    await expect(createWorkspaceWithData('   ', data)).rejects.toThrow();
    expect(listWorkspaces().map((w) => w.id)).toEqual(['default', 'imported']);
  });

  test('does not leave a half-made workspace when the copy fails', async () => {
    await expect(duplicateWorkspace('default', '   ')).rejects.toThrow();
    expect(listWorkspaces().map((w) => w.id)).toEqual(['default']);
  });
});

describe('announcing a change', () => {
  test('goes to the channel of that workspace only', async () => {
    /** @type {string[]} */
    const heard = [];
    const home = new BroadcastChannel('dashboard-sync-default');
    const work = new BroadcastChannel('dashboard-sync-work');
    home.onmessage = () => heard.push('default');
    work.onmessage = () => heard.push('work');

    announceWorkspaceChange('work');
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(heard).toEqual(['work']);
  });
});
