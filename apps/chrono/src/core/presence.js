// Live duration of a session and presence computed from the clock-in events.

/** @typedef {import('../types.js').Session} Session */
/** @typedef {import('../types.js').Pointage} Pointage */
/** @typedef {import('../types.js').Plage} Plage */

/**
 * Live duration of a session: adds the time since `dernierDebut` when it is running.
 * @param {Session | null | undefined} session
 * @param {number} now
 * @returns {number}
 */
export function dureeVivante(session, now) {
  if (!session) return 0;
  if (session.statut === 'en_cours' && session.dernierDebut) {
    return (session.duree || 0) + (now - session.dernierDebut);
  }
  return session.duree || 0;
}

/**
 * Presence ranges of a day from its clock-in events. `arrivee` and `pause_fin` open a range,
 * `pause_debut` and `depart` close it; a range still open ends at `now`.
 * @param {Pick<Pointage, 'type' | 'at'>[] | null | undefined} events
 * @param {number} now
 * @returns {Plage[]}
 */
export function plagesPresence(events, now) {
  const evs = (events || []).slice().sort((a, b) => a.at - b.at);
  /** @type {Plage[]} */
  const plages = [];
  /** @type {number | null} */
  let openAt = null;
  for (const e of evs) {
    if (e.type === 'arrivee' || e.type === 'pause_fin') {
      if (openAt == null) openAt = e.at;
    } else if (e.type === 'pause_debut' || e.type === 'depart') {
      if (openAt != null) {
        plages.push({ debut: openAt, fin: Math.max(openAt, e.at) });
        openAt = null;
      }
    }
  }
  if (openAt != null) plages.push({ debut: openAt, fin: Math.max(openAt, now) });
  return plages;
}

/**
 * Presence duration of a day: sum of the ranges. When the day is not closed, the last range
 * runs until `now`.
 * @param {Pick<Pointage, 'type' | 'at'>[] | null | undefined} events
 * @param {number} now
 * @returns {number}
 */
export function dureePresence(events, now) {
  return plagesPresence(events, now).reduce((total, p) => total + (p.fin - p.debut), 0);
}
