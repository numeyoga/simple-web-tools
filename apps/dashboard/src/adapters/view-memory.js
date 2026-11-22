// The application and the environment the person looked at last, per workspace, in `localStorage`
// (`dashboard-view-<workspace id>`). Reads and writes never throw: a browser that refuses the
// storage forgets them between visits.

import { emptyViewMemory, parseViewMemory, rememberView } from '../core/view.js';
import { viewKey } from './names.js';

/** @typedef {import('../core/view.js').ViewMemory} ViewMemory */

/**
 * @param {string} workspaceId
 * @returns {ViewMemory}
 */
export function readViewMemory(workspaceId) {
  try {
    return parseViewMemory(localStorage.getItem(viewKey(workspaceId)));
  } catch {
    return emptyViewMemory();
  }
}

/**
 * Remembers that an application was opened on an environment (`null`: the application only).
 * @param {string} workspaceId
 * @param {string} appId
 * @param {string | null} envKey
 */
export function writeViewMemory(workspaceId, appId, envKey) {
  const before = readViewMemory(workspaceId);
  const after = rememberView(before, appId, envKey);
  if (after === before) return;
  try {
    localStorage.setItem(viewKey(workspaceId), JSON.stringify(after));
  } catch {
    // Not remembered.
  }
}

/**
 * Forgets what was looked at in a workspace (it was deleted).
 * @param {string} workspaceId
 */
export function forgetViewMemory(workspaceId) {
  try {
    localStorage.removeItem(viewKey(workspaceId));
  } catch {
    // Nothing to forget.
  }
}
