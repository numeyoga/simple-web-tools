// localStorage fallback, used when IndexedDB is unavailable or does not open.

import { lsKeyFor, wsActiveId } from './workspace-list.js';

/** @returns {Partial<import('../types.js').Donnees> | null} */
export function lsLoad() {
  try {
    return JSON.parse(localStorage.getItem(lsKeyFor(wsActiveId())) || 'null');
  } catch {
    return null;
  }
}

/** @param {import('../types.js').Donnees} state */
export function lsSave(state) {
  try {
    localStorage.setItem(
      lsKeyFor(wsActiveId()),
      JSON.stringify({
        projets: state.projets,
        todos: state.todos,
        sessions: state.sessions,
        pointage: state.pointage,
      }),
    );
  } catch {
    /* quota or private mode: nothing to do */
  }
}
