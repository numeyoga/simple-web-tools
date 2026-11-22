/** @import { Skipped } from '../types.d.ts' */

// The first start on a browser that ran the previous version of Favoris (roadmap step 8). It was
// served from the same origin, so its `localStorage` keys are readable here. When this app has no
// workspace yet and has not imported before, one workspace is created per old space, with its
// groups and links, the space that was open becomes the active workspace, and the old theme is
// kept when none is chosen. The old keys are only read: they are never changed or deleted, so
// they stay as a backup of the previous version.
//
// The databases are written first and the list of workspaces last: an import that fails halfway
// leaves no list (the next start tries again, and writes the same databases over). `favoris-
// legacy-import` records that the check ran, so it runs once. A Web Lock makes two tabs that
// start together take turns: the second finds the list and does nothing.

import { createWorkspaceRegistry } from '@simple-web-tools/storage';
import { LEGACY_KEYS, parseLegacyStorage, summarizeLegacyImport } from '../core/legacy.js';
import { StorageError, openWorkspaceDatabase, replaceWorkspace } from './idb.js';
import { newId } from './ids.js';
import { APP, legacyImportKey, legacyImportLockName, themeKey, workspaceListKey } from './names.js';

/**
 * @typedef {object} LegacyImportResult
 * @property {number} workspaces the workspaces created
 * @property {number} links the links imported
 * @property {Skipped} skipped what the old records left out
 * @property {number} unreadable the spaces whose stored data was not valid JSON (imported empty)
 */

/**
 * @typedef {object} ImportEnvironment
 * @property {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>} storage `localStorage` (the old keys are only read)
 * @property {string} defaultLabel the name of the single space of a browser that has no list
 * @property {number} now epoch milliseconds, for a space that has no `createdAt`
 * @property {(workspaceId: string, data: import('../types.d.ts').WorkspaceData) => Promise<void>} [writeWorkspace]
 *   writes one workspace database (default: IndexedDB)
 * @property {() => string} [makeId]
 */

/**
 * Whether the old data has to be looked for: this app has no workspace list and has not
 * imported before.
 * @param {Pick<Storage, 'getItem'>} storage
 * @returns {boolean}
 */
export function needsLegacyImport(storage) {
  return (
    storage.getItem(workspaceListKey()) === null && storage.getItem(legacyImportKey()) === null
  );
}

/** @param {import('../types.d.ts').WorkspaceData} data @param {string} workspaceId */
async function writeToIndexedDb(workspaceId, data) {
  const db = await openWorkspaceDatabase(workspaceId);
  try {
    await replaceWorkspace(db, data);
  } finally {
    db.close();
  }
}

/**
 * Imports the previous version's data once. Resolves to what was imported, or `null` when there
 * was nothing to import or it already ran. Rejects (a `StorageError`) when a database cannot be
 * written: nothing is recorded, so the next start tries again.
 * @param {ImportEnvironment} env
 * @returns {Promise<LegacyImportResult | null>}
 */
async function importOnce({
  storage,
  defaultLabel,
  now,
  writeWorkspace = writeToIndexedDb,
  makeId = newId,
}) {
  if (!needsLegacyImport(storage)) return null;

  const legacy = parseLegacyStorage(
    {
      spaces: storage.getItem(LEGACY_KEYS.spaces),
      currentSpace: storage.getItem(LEGACY_KEYS.currentSpace),
      singleSpace: storage.getItem(LEGACY_KEYS.singleSpace),
      theme: storage.getItem(LEGACY_KEYS.theme),
      dataOf: (id) => storage.getItem(`${LEGACY_KEYS.dataPrefix}${id}`),
    },
    { makeId, defaultLabel, now },
  );
  if (!legacy) {
    storage.setItem(legacyImportKey(), '1');
    return null;
  }

  try {
    for (const workspace of legacy.workspaces) await writeWorkspace(workspace.id, workspace.data);
  } catch (error) {
    throw error instanceof StorageError ? error : new StorageError('unavailable', error);
  }

  // The list of workspaces, with the one that was open, written by the registry itself.
  createWorkspaceRegistry({ app: APP, storage, now: () => now, defaultLabel }).importWorkspaces(
    legacy.workspaces.map(({ id, label, createdAt }) => ({ id, label, createdAt })),
    legacy.activeId,
  );
  if (legacy.theme && storage.getItem(themeKey()) === null)
    storage.setItem(themeKey(), legacy.theme);
  storage.setItem(legacyImportKey(), '1');

  const { workspaces, links, skipped, unreadable } = summarizeLegacyImport(legacy);
  return { workspaces, links, skipped, unreadable };
}

/**
 * Runs the import under a Web Lock, when the browser has them.
 * @param {ImportEnvironment} env
 * @returns {Promise<LegacyImportResult | null>}
 */
export async function runLegacyImport(env) {
  if (!needsLegacyImport(env.storage)) return null;
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return importOnce(env);
  return locks.request(legacyImportLockName(), () => importOnce(env));
}
