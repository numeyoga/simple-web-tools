// Workspaces: the list and the active id live in localStorage, managed by the registry of
// @simple-web-tools/storage (keys `chrono-workspaces` and `chrono-workspace-active`).
//
// Each workspace has its own IndexedDB (`chrono__<id>`) and its own localStorage fallback.
// Switching workspace reloads the page: the store is rebuilt. Every storage name starts with
// the app name (decision 0005).

import { createWorkspaceRegistry, workspaceDatabaseName } from '@simple-web-tools/storage';
import { workspaceV1ToV2 } from '../core/migrations.js';
import {
  APP,
  LEGACY_ACTIVE_KEY,
  LEGACY_WORKSPACES_KEY,
  noDemoKey,
  workspaceListKey,
} from './names.js';

/** @typedef {import('@simple-web-tools/storage').Workspace} Workspace */

/** The four collections of the state, which are four IndexedDB stores. */
export const STORE_NAMES = /** @type {const} */ (['projects', 'todos', 'sessions', 'attendance']);

/**
 * Ids of the workspaces that must not get the demo data on their first start.
 * @returns {string[]}
 */
function readNoDemoIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(noDemoKey()) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} id
 * @param {boolean} demo
 */
export function setDemoEnabled(id, demo) {
  const ids = readNoDemoIds().filter((other) => other !== id);
  if (!demo) ids.push(id);
  localStorage.setItem(noDemoKey(), JSON.stringify(ids));
}

/**
 * Does a fresh workspace start with the demo data? Yes, unless it was created without.
 * @param {string} id
 * @returns {boolean}
 */
export function isDemoEnabled(id) {
  return !readNoDemoIds().includes(id);
}

/**
 * Once: when the registry has no list yet and the version 1 keys exist, import the version 1
 * list (same ids, so the database names still match) and the active id. The version 1 keys
 * are left untouched.
 * @param {ReturnType<typeof createWorkspaceRegistry>} registry
 */
function migrateLegacyRegistry(registry) {
  if (localStorage.getItem(workspaceListKey()) !== null) return;
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_WORKSPACES_KEY) || 'null');
  } catch {
    return;
  }
  if (!Array.isArray(legacy)) return;
  const now = Date.now();
  const converted = legacy.map((entry) => workspaceV1ToV2(entry, now)).filter((e) => e !== null);
  const activeId = localStorage.getItem(LEGACY_ACTIVE_KEY);
  const imported = registry.importWorkspaces(
    converted.map((entry) => entry.workspace),
    activeId,
  );
  if (!imported) return;
  const kept = new Set(registry.list().map((w) => w.id));
  const noDemo = new Set(readNoDemoIds());
  for (const { workspace, demo } of converted)
    if (!demo && kept.has(workspace.id)) noDemo.add(workspace.id);
  if (noDemo.size) localStorage.setItem(noDemoKey(), JSON.stringify([...noDemo]));
}

/**
 * The registry over the current `localStorage`. Cheap and stateless: call it where needed.
 * The first call after an update imports the version 1 list.
 */
export function getRegistry() {
  const registry = createWorkspaceRegistry({
    app: APP,
    storage: localStorage,
    now: () => Date.now(),
    defaultLabel: 'Espace principal',
  });
  migrateLegacyRegistry(registry);
  return registry;
}

/** @returns {Workspace[]} */
export const wsLoadList = () => getRegistry().list();

/** @returns {string} */
export const wsActiveId = () => getRegistry().activeId();

/** @returns {Workspace} */
export const wsActive = () => getRegistry().active();

/** @param {string} id */
export const wsSetActiveId = (id) => getRegistry().setActive(id);

/** IndexedDB database name of a workspace: `chrono__<id>`. @param {string} id */
export const databaseNameFor = (id) => workspaceDatabaseName(APP, id);
