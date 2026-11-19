// Short random ids. Lives in the adapters: core never generates ids, callers pass them in.

/**
 * @param {string} [p] prefix
 * @returns {string}
 */
export function uid(p = '') {
  return p + Math.random().toString(36).slice(2, 9);
}
