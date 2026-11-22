// The workspaces of the app: the registry over localStorage, and what creating, switching and
// deleting a workspace does to the databases. Every workspace has its own IndexedDB database.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  activeWorkspace,
  activeWorkspaceId,
  announceWorkspaceChange,
  createWorkspace,
  duplicateWorkspace,
  listWorkspaces,
  removeWorkspace,
  renameWorkspace,
  switchWorkspace,
} from '../../src/adapters/workspaces.js';
import { createAppStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { readStore } from './support/idb.js';

const NOW = new Date(2026, 10, 18, 10, 0).getTime();

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: NOW });
});
afterEach(uninstallBrowser);

describe('the list', () => {
  test('a first start has one workspace, "default", named in the language of the page', () => {
    expect(listWorkspaces()).toEqual([{ id: 'default', label: 'My bookmarks', createdAt: NOW }]);
    expect(activeWorkspaceId()).toBe('default');
    expect(activeWorkspace().label).toBe('My bookmarks');
    expect(nav.localStorage.keys()).toEqual(['favoris-workspaces']);
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
    expect(nav.localStorage.getItem('favoris-workspace-active')).toBe('work');
    expect(nav.reload).toHaveBeenCalledTimes(1);
  });

  test('an unknown workspace cannot be switched to', () => {
    expect(() => switchWorkspace('nope')).toThrow();
    expect(nav.reload).not.toHaveBeenCalled();
  });

  test('the links of two workspaces are separate', async () => {
    createWorkspace('Work');
    const home = createAppStore({ workspaceId: 'default' });
    await home.init();
    home.dispatch({
      type: 'create_link',
      id: 'home-link',
      name: 'h',
      url: 'home.example',
      groupId: null,
    });
    await home.close();
    const work = createAppStore({ workspaceId: 'work' });
    await work.init();
    work.dispatch({
      type: 'create_link',
      id: 'work-link',
      name: 'w',
      url: 'work.example',
      groupId: null,
    });
    await work.close();

    expect((await readStore('favoris__default', 'links')).map((n) => n.id)).toEqual(['home-link']);
    expect((await readStore('favoris__work', 'links')).map((n) => n.id)).toEqual(['work-link']);
  });
});

describe('deleting', () => {
  test('removes the workspace from the list and deletes its database', async () => {
    createWorkspace('Work');
    const store = createAppStore({ workspaceId: 'work' });
    await store.init();
    store.dispatch({ type: 'create_link', id: 'n1', name: 'n', url: 'n.example', groupId: null });
    await store.close();

    expect(await removeWorkspace('work', 'default')).toBe(true);

    expect(listWorkspaces().map((w) => w.id)).toEqual(['default']);
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain('favoris__work');
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
      store.dispatch({
        type: 'create_link',
        id: `${id}-link`,
        name: id,
        url: `${id}.example`,
        groupId: null,
      });
      await store.close();
    }

    await removeWorkspace('work', 'default');

    expect((await readStore('favoris__default', 'links')).map((n) => n.id)).toEqual([
      'default-link',
    ]);
  });
});

describe('duplicating', () => {
  test('copies the groups and links under a new name, in their order, and leaves the source alone', async () => {
    const source = createAppStore({ workspaceId: 'default' });
    await source.init();
    source.dispatch({ type: 'create_group', id: 'g', label: 'Docs', category: 5, featured: true });
    for (const id of ['b', 'a']) {
      source.dispatch({ type: 'create_link', id, name: id, url: `${id}.example`, groupId: 'g' });
    }
    await source.flush();

    const copy = await duplicateWorkspace('default', 'My bookmarks (copy)');

    expect(copy).toMatchObject({ id: 'my-bookmarks-copy', label: 'My bookmarks (copy)' });
    expect(listWorkspaces().map((w) => w.id)).toEqual(['default', 'my-bookmarks-copy']);
    expect(activeWorkspaceId()).toBe('default'); // the copy is not made the active workspace
    const copied = createAppStore({ workspaceId: copy.id });
    await copied.init(); // read-only: the first store holds the lock
    expect(copied.getState().groups).toEqual(source.getState().groups);
    expect(copied.getState().links).toEqual(source.getState().links);
    expect(copied.getState().links.map((l) => l.id)).toEqual(['b', 'a']);
    await copied.close();
    await source.close();
    expect((await readStore('favoris__default', 'links')).map((l) => l.id).sort()).toEqual([
      'a',
      'b',
    ]);
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
    const home = new BroadcastChannel('favoris-sync-default');
    const work = new BroadcastChannel('favoris-sync-work');
    home.onmessage = () => heard.push('default');
    work.onmessage = () => heard.push('work');

    announceWorkspaceChange('work');
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(heard).toEqual(['work']);
  });
});
