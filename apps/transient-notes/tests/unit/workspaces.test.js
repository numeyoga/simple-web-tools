// The workspaces of the app: the registry over localStorage, and what creating, switching and
// deleting a workspace does to the databases. Every workspace has its own IndexedDB database.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  activeWorkspace,
  activeWorkspaceId,
  announceWorkspaceChange,
  createWorkspace,
  listWorkspaces,
  removeWorkspace,
  renameWorkspace,
  switchWorkspace,
} from '../../src/adapters/workspaces.js';
import { getCollapsedCategories, setCollapsedCategories } from '../../src/adapters/preferences.js';
import { createAppStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { readStore } from './support/idb.js';
import { at } from './support/data.js';

const NOW = new Date(2026, 10, 18, 10, 0).getTime();

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: NOW });
});
afterEach(uninstallBrowser);

describe('the list', () => {
  test('a first start has one workspace, "default", named in the language of the page', () => {
    expect(listWorkspaces()).toEqual([{ id: 'default', label: 'Main workspace', createdAt: NOW }]);
    expect(activeWorkspaceId()).toBe('default');
    expect(activeWorkspace().label).toBe('Main workspace');
    expect(nav.localStorage.keys()).toEqual(['transient-notes-workspaces']);
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
    expect(nav.localStorage.getItem('transient-notes-workspace-active')).toBe('work');
    expect(nav.reload).toHaveBeenCalledTimes(1);
  });

  test('an unknown workspace cannot be switched to', () => {
    expect(() => switchWorkspace('nope')).toThrow();
    expect(nav.reload).not.toHaveBeenCalled();
  });

  test('the notes of two workspaces are separate', async () => {
    createWorkspace('Work');
    const home = createAppStore({ workspaceId: 'default' });
    await home.init();
    home.dispatch({ type: 'create_note', id: 'home-note', now: at() });
    await home.close();
    const work = createAppStore({ workspaceId: 'work' });
    await work.init();
    work.dispatch({ type: 'create_note', id: 'work-note', now: at() });
    await work.close();

    expect((await readStore('transient-notes__default', 'notes')).map((n) => n.id)).toEqual([
      'home-note',
    ]);
    expect((await readStore('transient-notes__work', 'notes')).map((n) => n.id)).toEqual([
      'work-note',
    ]);
  });
});

describe('deleting', () => {
  test('removes the workspace from the list and deletes its database', async () => {
    createWorkspace('Work');
    const store = createAppStore({ workspaceId: 'work' });
    await store.init();
    store.dispatch({ type: 'create_note', id: 'n1', now: at() });
    await store.close();

    expect(await removeWorkspace('work', 'default')).toBe(true);

    expect(listWorkspaces().map((w) => w.id)).toEqual(['default']);
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain('transient-notes__work');
  });

  test('forgets the folded categories of the deleted workspace only', async () => {
    createWorkspace('Work');
    setCollapsedCategories('default', ['projects']);
    setCollapsedCategories('work', ['areas']);

    await removeWorkspace('work', 'default');

    expect(getCollapsedCategories('work')).toEqual([]);
    expect(getCollapsedCategories('default')).toEqual(['projects']);
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
      store.dispatch({ type: 'create_note', id: `${id}-note`, now: at() });
      await store.close();
    }

    await removeWorkspace('work', 'default');

    expect((await readStore('transient-notes__default', 'notes')).map((n) => n.id)).toEqual([
      'default-note',
    ]);
  });
});

describe('announcing a change', () => {
  test('goes to the channel of that workspace only', async () => {
    /** @type {string[]} */
    const heard = [];
    const home = new BroadcastChannel('transient-notes-sync-default');
    const work = new BroadcastChannel('transient-notes-sync-work');
    home.onmessage = () => heard.push('default');
    work.onmessage = () => heard.push('work');

    announceWorkspaceChange('work');
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(heard).toEqual(['work']);
  });
});
