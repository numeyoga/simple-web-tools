// Session rules: start, pause, resume, stop, presence truncation, edits, manual entry.
// Every function takes the data, a payload and the time (and a new id when it creates a
// record) and returns NEW data; the input is never mutated. Unchanged records keep their
// reference, so the storage layer can write only what changed.
// When a function returns the very same `data` object, nothing changed.

import { startOfDay } from './dates.js';
import { plagesPresence } from './presence.js';

/** @typedef {import('../types.js').Donnees} Donnees */
/** @typedef {import('../types.js').Session} Session */

/**
 * Time elapsed since the session last started running.
 * @param {Session} s
 * @param {number} now
 */
const ecoule = (s, now) => now - /** @type {number} */ (s.dernierDebut);

/**
 * Pauses a running session: its elapsed time is added to the accumulated duration.
 * @param {Session} s
 * @param {number} now
 * @returns {Session}
 */
const mettreEnPause = (s, now) => ({
  ...s,
  duree: (s.duree || 0) + ecoule(s, now),
  dernierDebut: null,
  statut: 'en_pause',
});

/**
 * @param {Session} s
 * @param {number} now
 * @returns {Session}
 */
const terminer = (s, now) => {
  const addDuree = s.statut === 'en_cours' ? ecoule(s, now) : 0;
  return {
    ...s,
    fin: now,
    duree: (s.duree || 0) + addDuree,
    dernierDebut: null,
    statut: 'terminee',
  };
};

/**
 * Active timers: every session that is not 'terminee' (running or paused). Several timers can
 * run in parallel: starting one never stops the others.
 * @param {Session[]} sessions
 * @returns {Session[]}
 */
export function sessionsActives(sessions) {
  return sessions.filter((s) => s.statut !== 'terminee');
}

/**
 * Starts a timer.
 * @param {Donnees} data
 * @param {{ projetId: string, description?: string }} payload
 * @param {number} now
 * @param {string} newId id of the new session
 * @returns {Donnees}
 */
export function demarrer(data, { projetId, description = '' }, now, newId) {
  return {
    ...data,
    sessions: [
      ...data.sessions,
      {
        id: newId,
        projetId,
        description: description || '',
        debut: now,
        dernierDebut: now,
        fin: null,
        duree: 0,
        statut: 'en_cours',
      },
    ],
  };
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @param {number} now
 * @returns {Donnees}
 */
export function pauserSession(data, { id }, now) {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== id || s.statut !== 'en_cours') return s;
      return mettreEnPause(s, now);
    }),
  };
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @param {number} now
 * @returns {Donnees}
 */
export function reprendreSession(data, { id }, now) {
  return {
    ...data,
    sessions: data.sessions.map((s) =>
      s.id === id && s.statut === 'en_pause' ? { ...s, statut: 'en_cours', dernierDebut: now } : s,
    ),
  };
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @param {number} now
 * @returns {Donnees}
 */
export function arreterSession(data, { id }, now) {
  const arretee = {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== id || s.statut === 'terminee') return s;
      return terminer(s, now);
    }),
  };
  return tronquerSurPresence(arretee, [id], now);
}

/**
 * A working time greater than the presence makes no sense. For each session that has just
 * been stopped, the duration must not exceed the presence time overlapping its interval
 * [debut, fin] (parallel timers are therefore allowed: each session is judged on its own).
 * Without a clock-in for that day, nothing changes (presence unknown).
 * If the session was never paused (duree == fin - debut), `debut` is moved forward by the
 * amount cut so that the drawn block matches the counted time; otherwise only `duree` changes.
 * @param {Donnees} data
 * @param {string[]} endedIds
 * @param {number} now
 * @returns {Donnees} the same object when nothing is cut
 */
export function tronquerSurPresence(data, endedIds, now) {
  const jourDebut = startOfDay(new Date(now));
  const jourFin = jourDebut + 86400000;
  const events = data.pointage.filter((p) => p.at >= jourDebut && p.at < jourFin);
  if (!events.some((e) => e.type === 'arrivee')) return data;
  const plages = plagesPresence(events, now);
  /** @type {Map<string, { couvert: number, cut: number, sansPause: boolean }>} */
  const coupes = new Map();
  for (const s of data.sessions) {
    if (!endedIds.includes(s.id) || s.statut !== 'terminee') continue;
    if (s.debut < jourDebut || s.debut >= jourFin) continue;
    const fin = /** @type {number} */ (s.fin);
    const duree = s.duree || 0;
    const couvert = plages.reduce(
      (acc, p) => acc + Math.max(0, Math.min(fin, p.fin) - Math.max(s.debut, p.debut)),
      0,
    );
    if (duree > couvert + 1000) {
      // 1 s tolerance
      coupes.set(s.id, {
        couvert,
        cut: duree - couvert,
        sansPause: Math.abs(duree - (fin - s.debut)) <= 1000,
      });
    }
  }
  if (coupes.size === 0) return data;
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      const c = coupes.get(s.id);
      if (!c) return s;
      return { ...s, duree: c.couvert, debut: c.sansPause ? s.debut + c.cut : s.debut };
    }),
  };
}

/**
 * Pauses every running timer.
 * @param {Donnees} data
 * @param {number} now
 * @returns {Donnees} the same object when no timer is running
 */
export function pauserTout(data, now) {
  let changed = false;
  const sessions = data.sessions.map((s) => {
    if (s.statut !== 'en_cours') return s;
    changed = true;
    return mettreEnPause(s, now);
  });
  return changed ? { ...data, sessions } : data;
}

/**
 * Resumes every paused timer.
 * @param {Donnees} data
 * @param {number} now
 * @returns {Donnees} the same object when no timer is paused
 */
export function reprendreTout(data, now) {
  let changed = false;
  const sessions = data.sessions.map((s) => {
    if (s.statut !== 'en_pause') return s;
    changed = true;
    return /** @type {Session} */ ({ ...s, statut: 'en_cours', dernierDebut: now });
  });
  return changed ? { ...data, sessions } : data;
}

/**
 * Stops every active timer.
 * @param {Donnees} data
 * @param {number} now
 * @returns {Donnees} the same object when no timer is active
 */
export function arreterTout(data, now) {
  let changed = false;
  /** @type {string[]} */
  const endedIds = [];
  const sessions = data.sessions.map((s) => {
    if (s.statut === 'terminee') return s;
    changed = true;
    endedIds.push(s.id);
    return terminer(s, now);
  });
  return changed ? tronquerSurPresence({ ...data, sessions }, endedIds, now) : data;
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @returns {Donnees}
 */
export function supprimerSession(data, { id }) {
  return { ...data, sessions: data.sessions.filter((s) => s.id !== id) };
}

/**
 * Edits a session. For a finished session, the duration follows `debut` and `fin` unless it
 * is given explicitly; pauses already counted are kept.
 * @param {Donnees} data
 * @param {{ id: string, patch: Partial<Session> }} payload
 * @returns {Donnees}
 */
export function majSession(data, { id, patch }) {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      if (next.statut === 'terminee' && next.debut != null && next.fin != null) {
        if (patch.duree != null) {
          // explicit duration wins.
        } else if (s.statut === 'terminee' && s.debut != null && s.fin != null) {
          // Keep the pause time already counted (old block - old duration).
          const pauses = Math.max(0, s.fin - s.debut - (s.duree || 0));
          next.duree = Math.max(0, next.fin - next.debut - pauses);
        } else {
          next.duree = Math.max(0, next.fin - next.debut);
        }
      } else if (next.statut === 'en_cours' && patch.debut != null) {
        // A running session that was never paused (accumulated duration = 0 and
        // dernierDebut followed debut): resynchronise dernierDebut on the new debut so that
        // the live duration reflects the time correction at once and the block on the
        // timeline stays consistent.
        if ((s.duree || 0) === 0 && s.dernierDebut === s.debut) {
          next.dernierDebut = patch.debut;
        }
      }
      // A paused session: the accumulated duration is no longer tied to the start time, so
      // nothing is adjusted.
      return next;
    }),
  };
}

/**
 * Manual entry of an already finished session (correction / catch-up). It is NOT made
 * active: it has a start and an end, so status 'terminee' and the duration is computed at once.
 * @param {Donnees} data
 * @param {{ projetId: string, description?: string, debut: number, fin: number }} payload
 * @param {string} newId
 * @returns {Donnees} the same object when the entry is invalid
 */
export function ajouterSessionManuelle(data, { projetId, description = '', debut, fin }, newId) {
  if (!projetId || debut == null || fin == null) return data;
  if (fin < debut) return data;
  /** @type {Session} */
  const session = {
    id: newId,
    projetId,
    description: (description || '').trim(),
    debut,
    fin,
    dernierDebut: null,
    duree: Math.max(0, fin - debut),
    statut: 'terminee',
  };
  return { ...data, sessions: [...data.sessions, session] };
}
