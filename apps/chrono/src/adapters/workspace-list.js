// Workspaces: the list and the active id live in localStorage, managed by the registry of
// @simple-web-tools/storage (keys `chrono-workspaces` and `chrono-workspace-active`).
//
// Each workspace has its own IndexedDB (`chrono__<id>`). Switching workspace reloads the page:
// the store is rebuilt. Every storage name starts with the app name (decision 0005).

import { createTranslator } from '@simple-web-tools/i18n';
import { createWorkspaceRegistry, workspaceDatabaseName } from '@simple-web-tools/storage';
import { planLegacyWorkspaces } from '../core/migrations.js';
import { catalogs } from '../i18n/index.js';
import {
  APP,
  LEGACY_ACTIVE_KEY,
  LEGACY_WORKSPACES_KEY,
  legacyWorkspacesKey,
  workspaceListKey,
} from './names.js';

/** @typedef {import('@simple-web-tools/storage').Workspace} Workspace */

/** The four collections of the state, which are four IndexedDB stores. */
export const STORE_NAMES = /** @type {const} */ (['projects', 'todos', 'sessions', 'attendance']);

/**
 * A workspace of the version 1 list whose id the registry refuses, and the database that holds
 * its data.
 * @typedef {object} LegacyWorkspace
 * @property {string} from version 1 id: the database is `chrono__<from>`
 * @property {string} to id in the registry
 * @property {boolean} copied whether the content of the old database is in `chrono__<to>`
 */

/**
 * The repaired workspaces recorded by the migration of the version 1 list.
 * @returns {LegacyWorkspace[]}
 */
export function readLegacyWorkspaces() {
  try {
    const parsed = JSON.parse(localStorage.getItem(legacyWorkspacesKey()) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.from === 'string' && typeof e.to === 'string' && e.from !== e.to,
    );
  } catch {
    return [];
  }
}

/** @param {LegacyWorkspace[]} entries */
export function writeLegacyWorkspaces(entries) {
  localStorage.setItem(legacyWorkspacesKey(), JSON.stringify(entries));
}

/**
 * Once: when the registry has no list yet and the version 1 keys exist, import the version 1
 * list and the active id. A workspace whose version 1 id the registry refuses gets a valid
 * id; it is recorded (see `readLegacyWorkspaces`) so that its database is copied. The version 1
 * keys are left untouched.
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
  const plan = planLegacyWorkspaces(legacy, Date.now());
  const legacyActive = localStorage.getItem(LEGACY_ACTIVE_KEY);
  const renamedActive = plan.renames.find((r) => r.from === legacyActive);
  const imported = registry.importWorkspaces(plan.workspaces, renamedActive?.to ?? legacyActive);
  if (!imported) return;
  const kept = new Set(registry.list().map((w) => w.id));
  const pending = plan.renames.filter((r) => kept.has(r.to));
  if (pending.length) writeLegacyWorkspaces(pending.map((r) => ({ ...r, copied: false })));
}

/**
 * Name of the workspace created on the first start: written once, in the language of that
 * moment. French until the app tells otherwise (`setDefaultWorkspaceLabel`).
 */
let defaultLabel = createTranslator({ locale: 'fr', catalogs }).t('workspaces.defaultLabel');

/** @param {string} label the name of the first workspace, in the language of the interface */
export function setDefaultWorkspaceLabel(label) {
  defaultLabel = label;
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
    defaultLabel,
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
