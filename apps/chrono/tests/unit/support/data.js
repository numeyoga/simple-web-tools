// Small builders shared by the unit tests.

/** @typedef {import('../../../src/types.js').ChronoData} ChronoData */
/** @typedef {import('../../../src/types.js').Session} Session */

export const H = 3600_000;

/**
 * Local timestamp on Wednesday 2026-11-18.
 * @param {number} hh
 * @param {number} [mm]
 */
export const h = (hh, mm = 0) => new Date(2026, 10, 18, hh, mm).getTime();

/** @returns {ChronoData} */
export const emptyData = () => ({ projects: [], todos: [], sessions: [], attendance: [] });

/**
 * @param {ChronoData} data
 * @param {string} id
 * @returns {Session}
 */
export function session(data, id) {
  const s = data.sessions.find((x) => x.id === id);
  if (!s) throw new Error(`session ${id} not found`);
  return s;
}

/**
 * A finished session, with overrides.
 * @param {Partial<Session>} [extra]
 * @returns {Session}
 */
export const finishedSession = (extra = {}) => ({
  id: 's1',
  projectId: 'p1',
  description: '',
  start: h(9),
  lastStart: null,
  end: h(17),
  duration: 7 * H,
  status: 'done',
  ...extra,
});
