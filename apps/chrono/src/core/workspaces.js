// Pure helpers for the workspace list.

/** @typedef {import('../types.js').EspaceDeSauvegarde} EspaceDeSauvegarde */

/**
 * @param {string} s
 * @returns {string}
 */
export function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'espace'
  );
}

/**
 * @param {string} base
 * @param {{ id: string }[]} list
 * @returns {string}
 */
export function uniqueId(base, list) {
  let id = base;
  let n = 2;
  while (list.some((w) => w.id === id)) id = `${base}-${n++}`;
  return id;
}

/**
 * The workspace list of a fresh install.
 * @param {number} now
 * @returns {EspaceDeSauvegarde[]}
 */
export function listeParDefaut(now) {
  return [{ id: 'default', label: 'Espace principal', creeLe: now }];
}
