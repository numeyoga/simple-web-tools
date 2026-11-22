// Workspaces: several independent dashboards, called profiles in the earlier version of
// the app (a key of its IndexedDB). The list and the active id live in localStorage, managed by the registry of
// @simple-web-tools/storage (keys `dashboard-workspaces` and `dashboard-workspace-active`). Each
// workspace has its own IndexedDB database (`dashboard__<id>`), created when it is first opened. Switching reloads the
// page: the store is rebuilt on the other database.
//
// Creating, renaming and deleting a workspace change data that is not the active database (or
// the list every tab shares), so only the writer tab calls them: the views disable them in a
// read-only tab, and the lock is the one of the whole app.

import { createWorkspaceRegistry, deleteDatabase } from '@simple-web-tools/storage';
import { cleanData } from '../core/model.js';
import { t } from './i18n.js';
import { openWorkspaceDatabase, readWorkspace, replaceWorkspace } from './idb.js';
import { APP, channelName, databaseNameFor } from './names.js';
import { startingSettings } from './starting.js';
import { forgetViewMemory } from './view-memory.js';

/** @typedef {import('@simple-web-tools/storage').Workspace} Workspace */

/** The registry over the current `localStorage`. Cheap and stateless: call it where needed. */
export function getRegistry() {
  return createWorkspaceRegistry({
    app: APP,
    storage: localStorage,
    now: () => Date.now(),
    // Written once, in the language of the first start.
    defaultLabel: t('workspaces.defaultLabel'),
  });
}

/** @returns {Workspace[]} */
export const listWorkspaces = () => getRegistry().list();

/** @returns {string} */
export const activeWorkspaceId = () => getRegistry().activeId();

/** @returns {Workspace} */
export const activeWorkspace = () => getRegistry().active();

/**
 * Adds a workspace (the registry makes its id from the label). Its database is created when it
 * is first opened. Throws when the label is blank.
 * @param {string} label
 * @returns {Workspace}
 */
export function createWorkspace(label) {
  return getRegistry().create(label);
}

/**
 * @param {string} id
 * @param {string} label
 * @returns {Workspace}
 */
export function renameWorkspace(id, label) {
  return getRegistry().rename(id, label);
}

/**
 * Makes a workspace the active one and reloads the page. Pending writes of the store must be
 * flushed first (the views do it: `store.flush()`).
 * @param {string} id
 */
export function switchWorkspace(id) {
  getRegistry().setActive(id);
  location.reload();
}

/**
 * Deletes a workspace and all its data. Neither the last workspace nor the active one (nor the
 * one this tab shows, which differs when another tab switched) can be deleted. Returns `false`
 * when another connection kept the database open: the workspace is then gone from the list but
 * its data stays until that tab lets go.
 * @param {string} id
 * @param {string} shownId the workspace this tab has open
 * @returns {Promise<boolean>} whether the database was deleted
 */
export async function removeWorkspace(id, shownId) {
  const registry = getRegistry();
  if (id === registry.activeId() || id === shownId) {
    throw new Error('The active workspace cannot be deleted.');
  }
  registry.remove(id); // throws for the last workspace and for an unknown id
  forgetViewMemory(id);
  return deleteDatabase(databaseNameFor(id));
}

/**
 * Copies a workspace under a new name: a new registry entry and a new database holding the same
 * data. The pending writes of the store must be flushed first. Returns the new
 * workspace (it is not made the active one).
 * @param {string} sourceId
 * @param {string} label the name of the copy
 * @returns {Promise<Workspace>}
 */
export async function duplicateWorkspace(sourceId, label) {
  const source = await openWorkspaceDatabase(sourceId);
  /** @type {import('../types.d.ts').WorkspaceData} */
  let data;
  try {
    const read = await readWorkspace(source);
    data = cleanData(
      { ...read, settings: read.settings ?? startingSettings() },
      { sorted: true },
    ).data;
  } finally {
    source.close();
  }
  const workspace = getRegistry().create(label);
  try {
    const target = await openWorkspaceDatabase(workspace.id);
    try {
      await replaceWorkspace(target, data);
    } finally {
      target.close();
    }
  } catch (error) {
    // Do not leave a registry entry without its data.
    getRegistry().remove(workspace.id);
    await deleteDatabase(databaseNameFor(workspace.id));
    throw error;
  }
  return workspace;
}

/**
 * Adds a workspace that starts with the given data (an import into a new workspace). Returns the
 * new workspace (it is not made the active one). Nothing is left behind when it fails.
 * @param {string} label
 * @param {import('../types.d.ts').WorkspaceData} data already validated
 * @returns {Promise<Workspace>}
 */
export async function createWorkspaceWithData(label, data) {
  const workspace = getRegistry().create(label);
  try {
    const target = await openWorkspaceDatabase(workspace.id);
    try {
      await replaceWorkspace(target, data);
    } finally {
      target.close();
    }
  } catch (error) {
    getRegistry().remove(workspace.id);
    await deleteDatabase(databaseNameFor(workspace.id));
    throw error;
  }
  return workspace;
}

/**
 * Tells the other tabs of workspace `id` that its database changed: they re-read it.
 * @param {string} id
 */
export function announceWorkspaceChange(id) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(channelName(id));
    channel.postMessage('update');
    channel.close();
  } catch {
    // The other tabs re-read at their next start.
  }
}
