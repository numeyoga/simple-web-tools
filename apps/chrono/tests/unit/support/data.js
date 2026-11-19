// Small builders shared by the unit tests.

/** @typedef {import('../../../src/types.js').Donnees} Donnees */
/** @typedef {import('../../../src/types.js').Session} Session */

export const H = 3600_000;

/**
 * Local timestamp on Wednesday 2026-11-18.
 * @param {number} hh
 * @param {number} [mm]
 */
export const h = (hh, mm = 0) => new Date(2026, 10, 18, hh, mm).getTime();

/** @returns {Donnees} */
export const vide = () => ({ projets: [], todos: [], sessions: [], pointage: [] });

/**
 * @param {Donnees} data
 * @param {string} id
 * @returns {Session}
 */
export function session(data, id) {
  const s = data.sessions.find((x) => x.id === id);
  if (!s) throw new Error(`session ${id} introuvable`);
  return s;
}

/**
 * A finished session, with overrides.
 * @param {Partial<Session>} [extra]
 * @returns {Session}
 */
export const terminee = (extra = {}) => ({
  id: 's1',
  projetId: 'p1',
  description: '',
  debut: h(9),
  dernierDebut: null,
  fin: h(17),
  duree: 7 * H,
  statut: 'terminee',
  ...extra,
});
