// Weekly report: aggregation per day and per project, and the CSV text.

import { dureeVivante } from './presence.js';

/** @typedef {import('../types.js').Session} Session */
/** @typedef {import('../types.js').Projet} Projet */

/**
 * @typedef {object} JourRapport
 * @property {Date} date
 * @property {Session[]} ss sessions that started that day
 * @property {Record<string, number>} parProjet duration per project id
 * @property {number} total
 */

/**
 * @typedef {object} Semaine
 * @property {Date} lundi
 * @property {Date} dimanche
 * @property {Session[]} sessionsSem sessions that started during the week
 * @property {JourRapport[]} parJour Monday to Sunday
 * @property {number} totalSemaine
 * @property {number} maxJour at least 8 hours
 * @property {number} objectifSem weekly target, in ms
 * @property {number} progObjectif 0..1
 * @property {{ id: string, duree: number, projet: Projet }[]} projetsTri projects of the week, longest first
 * @property {number} totalSessions
 * @property {number} joursActifs
 */

/**
 * Bounds of the week shifted by `semaineOffset` weeks from `now` (Monday 00:00 to Sunday 23:59:59.999).
 * Days are added with setDate: a daylight-saving day is not 24 h long.
 * @param {number} semaineOffset
 * @param {number} now
 * @returns {{ lundi: Date, dimanche: Date, jours: Date[] }}
 */
export function bornesSemaine(semaineOffset, now) {
  const ref = new Date(now);
  ref.setDate(ref.getDate() + semaineOffset * 7);
  const dow = (ref.getDay() + 6) % 7; // 0 = Monday
  const lundi = new Date(ref);
  lundi.setDate(ref.getDate() - dow);
  lundi.setHours(0, 0, 0, 0);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  dimanche.setHours(23, 59, 59, 999);
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    return d;
  });
  return { lundi, dimanche, jours };
}

/**
 * Aggregates the sessions of a week.
 * @param {Session[]} sessions
 * @param {Projet[]} projets
 * @param {number} semaineOffset 0 = this week, -1 = last week...
 * @param {number} now
 * @returns {Semaine}
 */
export function agregerSemaine(sessions, projets, semaineOffset, now) {
  const { lundi, dimanche, jours } = bornesSemaine(semaineOffset, now);

  const sessionsSem = sessions.filter(
    (s) => s.debut >= lundi.getTime() && s.debut <= dimanche.getTime(),
  );

  const parJour = jours.map((j) => {
    const dStart = new Date(j);
    dStart.setHours(0, 0, 0, 0);
    const dEnd = new Date(j);
    dEnd.setHours(23, 59, 59, 999);
    const ss = sessionsSem.filter((s) => s.debut >= dStart.getTime() && s.debut <= dEnd.getTime());
    /** @type {Record<string, number>} */
    const parProjet = {};
    for (const s of ss) parProjet[s.projetId] = (parProjet[s.projetId] || 0) + dureeVivante(s, now);
    const total = Object.values(parProjet).reduce((a, b) => a + b, 0);
    return { date: j, ss, parProjet, total };
  });

  const totalSemaine = parJour.reduce((s, j) => s + j.total, 0);
  const maxJour = Math.max(...parJour.map((j) => j.total), 8 * 3600_000);
  const objectifSem = 35 * 3600_000;
  const progObjectif = Math.min(1, totalSemaine / objectifSem);

  /** @type {Record<string, number>} */
  const parProjet = {};
  for (const s of sessionsSem)
    parProjet[s.projetId] = (parProjet[s.projetId] || 0) + dureeVivante(s, now);
  const projetsTri = Object.entries(parProjet)
    .map(([id, duree]) => ({ id, duree, projet: projets.find((p) => p.id === id) }))
    .filter(
      /** @returns {x is { id: string, duree: number, projet: Projet }} */ (x) => Boolean(x.projet),
    )
    .sort((a, b) => b.duree - a.duree);

  return {
    lundi,
    dimanche,
    sessionsSem,
    parJour,
    totalSemaine,
    maxJour,
    objectifSem,
    progObjectif,
    projetsTri,
    totalSessions: sessionsSem.length,
    joursActifs: parJour.filter((j) => j.total > 0).length,
  };
}

/**
 * Builds the CSV text of the report, ready for Excel in French: UTF-8 BOM (accents),
 * `;` separator, decimal comma, CRLF line ends.
 * @param {Session[] | null | undefined} sessions
 * @param {Pick<Projet, 'id' | 'nom' | 'client'>[] | null | undefined} projets
 * @param {number} now end of the running sessions
 * @returns {string}
 */
export function construireCSVRapport(sessions, projets, now) {
  // Neutralises formula injection: a text cell starting with = + - @ (or tab / carriage
  // return) would be interpreted as a formula by the spreadsheet.
  const texte = (/** @type {unknown} */ v) => {
    const t = String(v ?? '');
    return /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
  };
  const cell = (/** @type {unknown} */ v) => `"${String(v).replace(/"/g, '""')}"`;
  const hhmm = (/** @type {number} */ ts) =>
    new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const rows = [['Date', 'Projet', 'Client', 'Description', 'Début', 'Fin', 'Durée (h)']];
  for (const s of (sessions || []).slice().sort((a, b) => a.debut - b.debut)) {
    const p = (projets || []).find((pr) => pr.id === s.projetId);
    const heures = dureeVivante(s, now) / 3600_000;
    rows.push([
      new Date(s.debut).toLocaleDateString('fr-FR'),
      texte(p?.nom),
      texte(p?.client),
      texte(s.description),
      hhmm(s.debut),
      s.fin ? hhmm(s.fin) : '',
      heures.toFixed(2).replace('.', ','),
    ]);
  }
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
