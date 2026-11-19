// Presence clock-in: state machine of the day and the events that drive the timers.

import { startOfDay } from './dates.js';
import { tronquerSurPresence } from './sessions.js';

/** @typedef {import('../types.js').Donnees} Donnees */
/** @typedef {import('../types.js').Pointage} Pointage */
/** @typedef {import('../types.js').Session} Session */
/** @typedef {import('../types.js').EtatPointage} EtatPointage */
/** @typedef {import('../types.js').TypePointage} TypePointage */

/**
 * State of today's clock-in.
 * @param {Pointage[]} pointage
 * @param {number} now
 * @returns {EtatPointage}
 */
export function etatPointage(pointage, now) {
  const today = startOfDay(now);
  const events = pointage.filter((p) => p.at >= today).sort((a, b) => a.at - b.at);
  const last = events[events.length - 1];
  if (!last) return { statut: 'pas_arrive', events };
  if (last.type === 'arrivee' || last.type === 'pause_fin') {
    return { statut: 'present', depuis: last.at, events };
  }
  if (last.type === 'pause_debut') return { statut: 'pause', depuis: last.at, events };
  if (last.type === 'depart') return { statut: 'parti', events };
  return { statut: 'present', events };
}

/**
 * Records a clock-in event now, and applies its effect on the timers:
 * - `depart`: stops EVERY active timer (no automatic resume the next day), then truncates
 *   them on the presence;
 * - `pause_debut`: pauses every running timer and remembers which, to resume exactly those;
 * - `pause_fin`: resumes the timers suspended by the last `pause_debut` of the day, if they
 *   are still paused.
 * @param {Donnees} data
 * @param {{ type: TypePointage }} payload
 * @param {number} now
 * @param {string} newId id of the new event
 * @returns {Donnees}
 */
export function pointer(data, { type }, now, newId) {
  /** @type {Pointage} */
  const evt = { id: newId, type, at: now };
  let sessions = data.sessions;
  /** @type {string[]} */
  const departEndedIds = [];

  if (type === 'depart') {
    const arretees = sessions.map((s) => {
      if (s.statut === 'terminee') return s;
      departEndedIds.push(s.id);
      const addDuree = s.statut === 'en_cours' ? now - /** @type {number} */ (s.dernierDebut) : 0;
      return /** @type {Session} */ ({
        ...s,
        fin: now,
        duree: (s.duree || 0) + addDuree,
        dernierDebut: null,
        statut: 'terminee',
      });
    });
    if (departEndedIds.length) sessions = arretees;
  }

  if (type === 'pause_debut') {
    /** @type {string[]} */
    const suspendus = [];
    const pausees = sessions.map((s) => {
      if (s.statut !== 'en_cours') return s;
      suspendus.push(s.id);
      return /** @type {Session} */ ({
        ...s,
        duree: (s.duree || 0) + (now - /** @type {number} */ (s.dernierDebut)),
        dernierDebut: null,
        statut: 'en_pause',
      });
    });
    if (suspendus.length) {
      evt.sessionsSuspenduesIds = suspendus;
      sessions = pausees;
    }
  }

  if (type === 'pause_fin') {
    const today = startOfDay(now);
    const lastDebut = data.pointage
      .filter((p) => p.type === 'pause_debut' && p.at >= today)
      .sort((a, b) => a.at - b.at)
      .slice(-1)[0];
    // Backward compatibility: old singular field sessionSuspendueId.
    const ids = lastDebut
      ? lastDebut.sessionsSuspenduesIds ||
        (lastDebut.sessionSuspendueId ? [lastDebut.sessionSuspendueId] : [])
      : [];
    if (ids.length) {
      const setIds = new Set(ids);
      sessions = sessions.map((s) =>
        setIds.has(s.id) && s.statut === 'en_pause'
          ? /** @type {Session} */ ({ ...s, statut: 'en_cours', dernierDebut: now })
          : s,
      );
    }
  }

  const apres = { ...data, sessions, pointage: [...data.pointage, evt] };
  // The departure has just closed the presence: trim the sessions just stopped if needed so
  // that the work does not exceed the presence.
  if (type === 'depart' && departEndedIds.length) {
    return tronquerSurPresence(apres, departEndedIds, now);
  }
  return apres;
}

/**
 * @param {Donnees} data
 * @param {{ type: TypePointage, at: number }} payload
 * @param {string} newId
 * @returns {Donnees}
 */
export function ajouterPointage(data, { type, at }, newId) {
  return { ...data, pointage: [...data.pointage, { id: newId, type, at }] };
}

/**
 * @param {Donnees} data
 * @param {{ id: string, patch: Partial<Pointage> }} payload
 * @returns {Donnees}
 */
export function majPointage(data, { id, patch }) {
  return { ...data, pointage: data.pointage.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @returns {Donnees}
 */
export function supprimerPointage(data, { id }) {
  return { ...data, pointage: data.pointage.filter((p) => p.id !== id) };
}
