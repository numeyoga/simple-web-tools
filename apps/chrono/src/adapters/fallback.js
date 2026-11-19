// localStorage fallback, used when IndexedDB is unavailable or does not open.
//
// It is written in the version 2 layout, under the `chrono-fallback-<id>-v2` key. A fallback
// written by version 1 (`chrono.fallback.<id>.v1`, French field names) is read when there is no
// version 2 one yet, converted with the same `v1ToV2` function, and left untouched.

import { v1ToV2 } from '../core/migrations.js';
import { fallbackKey, legacyFallbackKey } from './names.js';
import { wsActiveId } from './workspace-list.js';

/**
 * @param {string} key
 * @returns {unknown}
 */
function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

/**
 * The fallback data of the active workspace, in the version 2 layout; null when there is none.
 * @returns {Partial<import('../types.js').ChronoData> | null}
 */
export function loadFallback() {
  const id = wsActiveId();
  const current = readJson(fallbackKey(id));
  if (current) return /** @type {Partial<import('../types.js').ChronoData>} */ (current);
  const legacy = readJson(legacyFallbackKey(id));
  return legacy ? /** @type {Partial<import('../types.js').ChronoData>} */ (v1ToV2(legacy)) : null;
}

/** @param {import('../types.js').ChronoData} state */
export function saveFallback(state) {
  try {
    localStorage.setItem(
      fallbackKey(wsActiveId()),
      JSON.stringify({
        projects: state.projects,
        todos: state.todos,
        sessions: state.sessions,
        attendance: state.attendance,
      }),
    );
  } catch {
    /* quota or private mode: nothing to do */
  }
}
