// Registry of named workspaces, taken from Chrono's `WORKSPACES`: each workspace has its own
// IndexedDB database, and the list plus the active id live in a key-value store (Chrono uses
// localStorage). The registry never opens or deletes a database: it only tells which names
// exist, and `deleteDatabase` (database.js) removes the data of a removed workspace.

import { assertAppName, assertWorkspaceId, storageName, workspaceDatabaseName } from './names.js';

/**
 * Key-value store with the `localStorage` surface, injectable for tests.
 * @typedef {object} KeyValueStorage
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/**
 * @typedef {object} Workspace
 * @property {string} id stable slug, part of the database name
 * @property {string} label name shown to the user
 * @property {number} createdAt epoch milliseconds, from the injected clock
 */

/**
 * @typedef {object} WorkspaceRegistryOptions
 * @property {string} app
 * @property {KeyValueStorage} storage usually `localStorage`
 * @property {() => number} now clock, injected so the package never reads the time itself
 * @property {string} [defaultLabel] label of the workspace created on first use
 */

const DEFAULT_ID = 'default';
const MAX_LABEL_LENGTH = 80;

/**
 * Turn a label into a workspace id: lowercase ASCII, hyphen separated, at most 40 characters.
 * @param {string} label
 * @returns {string}
 */
export function slugifyWorkspaceLabel(label) {
  return (
    String(label)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'workspace'
  );
}

/**
 * @param {string} label
 * @returns {string}
 */
function cleanLabel(label) {
  const trimmed = String(label).trim();
  if (trimmed === '') throw new Error('A workspace needs a name.');
  return trimmed.slice(0, MAX_LABEL_LENGTH);
}

/**
 * @param {unknown} value
 * @returns {value is Workspace}
 */
function isWorkspace(value) {
  if (typeof value !== 'object' || value === null) return false;
  const { id, label, createdAt } = /** @type {Record<string, unknown>} */ (value);
  if (typeof id !== 'string' || typeof label !== 'string' || typeof createdAt !== 'number') {
    return false;
  }
  try {
    assertWorkspaceId(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {WorkspaceRegistryOptions} options
 */
export function createWorkspaceRegistry({ app, storage, now, defaultLabel = 'Main workspace' }) {
  assertAppName(app);
  const listKey = storageName(app, 'workspaces');
  const activeKey = storageName(app, 'workspace-active');
  const unreadableKey = storageName(app, 'workspaces-unreadable');

  /** @param {readonly Workspace[]} workspaces */
  function save(workspaces) {
    storage.setItem(listKey, JSON.stringify(workspaces));
  }

  /**
   * Never empty: a missing list becomes the default one and is saved. An unreadable list is
   * not overwritten here: its raw value is kept under the `workspaces-unreadable` key, so the
   * ids of the other workspaces, and therefore their databases, can still be recovered.
   * @returns {Workspace[]}
   */
  function list() {
    const raw = storage.getItem(listKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isWorkspace);
          if (valid.length > 0) return valid;
        }
      } catch {
        // Unreadable list: handled below.
      }
      if (storage.getItem(unreadableKey) === null) storage.setItem(unreadableKey, raw);
      return [{ id: DEFAULT_ID, label: defaultLabel, createdAt: now() }];
    }
    const fresh = [{ id: DEFAULT_ID, label: defaultLabel, createdAt: now() }];
    save(fresh);
    return fresh;
  }

  /** @returns {string} the stored active id when it still exists, else the first workspace */
  function activeId() {
    const workspaces = list();
    const stored = storage.getItem(activeKey);
    if (stored && workspaces.some((w) => w.id === stored)) return stored;
    return /** @type {Workspace} */ (workspaces[0]).id;
  }

  /** @param {string} id */
  function find(id) {
    return list().find((w) => w.id === id);
  }

  return {
    /** @returns {Workspace[]} */
    list,
    activeId,
    /** @returns {Workspace} */
    active() {
      const id = activeId();
      return /** @type {Workspace} */ (find(id));
    },
    /** @param {string} id */
    get: (id) => find(id),
    /** @param {string} id */
    setActive(id) {
      if (!find(id)) throw new Error(`Unknown workspace "${id}".`);
      storage.setItem(activeKey, id);
    },
    /**
     * Add a workspace. The id is derived from the label and made unique.
     * @param {string} label
     * @returns {Workspace}
     */
    create(label) {
      const workspaces = list();
      const clean = cleanLabel(label);
      const base = slugifyWorkspaceLabel(clean);
      let id = base;
      for (let n = 2; workspaces.some((w) => w.id === id); n += 1) id = `${base}-${n}`;
      const workspace = { id, label: clean, createdAt: now() };
      save([...workspaces, workspace]);
      return workspace;
    },
    /**
     * @param {string} id
     * @param {string} label
     * @returns {Workspace}
     */
    rename(id, label) {
      const workspaces = list();
      const index = workspaces.findIndex((w) => w.id === id);
      if (index < 0) throw new Error(`Unknown workspace "${id}".`);
      const renamed = { .../** @type {Workspace} */ (workspaces[index]), label: cleanLabel(label) };
      workspaces[index] = renamed;
      save(workspaces);
      return renamed;
    },
    /**
     * Remove a workspace from the registry. The last workspace cannot be removed. If it was
     * the active one, the first remaining workspace becomes active. The caller deletes the
     * data with `deleteDatabase(registry.databaseName(id))` (and any other name it owns).
     * @param {string} id
     * @returns {Workspace[]} the remaining workspaces
     */
    remove(id) {
      const workspaces = list();
      if (!workspaces.some((w) => w.id === id)) throw new Error(`Unknown workspace "${id}".`);
      if (workspaces.length <= 1) throw new Error('The last workspace cannot be removed.');
      const remaining = workspaces.filter((w) => w.id !== id);
      save(remaining);
      if (storage.getItem(activeKey) === id) {
        storage.setItem(activeKey, /** @type {Workspace} */ (remaining[0]).id);
      }
      return remaining;
    },
    /**
     * IndexedDB database name of a workspace.
     * @param {string} id
     * @returns {string}
     */
    databaseName: (id) => workspaceDatabaseName(app, id),
  };
}
