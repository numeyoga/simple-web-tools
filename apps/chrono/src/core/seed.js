// Demo data and the empty data set. The clock is passed in.

import { fmtDateISO } from './dates.js';
import { echeanceRelativeVersDate } from './echeances.js';

/** @typedef {import('../types.js').Donnees} Donnees */

/**
 * @returns {Donnees}
 */
export function emptyData() {
  return { projets: [], todos: [], sessions: [], pointage: [] };
}

/**
 * Demo data, built around `now`.
 * @param {number} now
 * @returns {Donnees}
 */
export function seed(now) {
  /**
   * Timestamp at `h:m` local, `offsetDays` days from today.
   * @param {number} h
   * @param {number} [m]
   * @param {number} [offsetDays]
   */
  const at = (h, m = 0, offsetDays = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };

  const projets = [
    {
      id: 'p1',
      nom: 'Refonte site — Orion SAS',
      client: 'Orion SAS',
      couleur: '#ea580c',
      archive: false,
    },
    {
      id: 'p2',
      nom: 'Design system interne',
      client: 'Interne',
      couleur: '#2563eb',
      archive: false,
    },
    { id: 'p3', nom: 'App mobile Helios', client: 'Helios', couleur: '#16a34a', archive: false },
    { id: 'p4', nom: 'Audit UX — Atlas', client: 'Atlas Co.', couleur: '#9333ea', archive: false },
    { id: 'p5', nom: 'Admin & compta', client: 'Interne', couleur: '#71717a', archive: false },
    {
      id: 'p6',
      nom: 'Migration v2 — Phoenix',
      client: 'Phoenix Ltd',
      couleur: '#0891b2',
      archive: true,
    },
  ];

  // Absolute due dates. Same results as the old relative labels anchored on creeLe.
  const jour = (/** @type {number} */ offset) => fmtDateISO(new Date(at(0, 0, offset)));
  const todos = [
    {
      id: 't1',
      titre: 'Valider la palette avec Orion',
      fait: false,
      projetId: 'p1',
      echeance: jour(-1),
      creeLe: at(8, 30, -1),
    },
    {
      id: 't2',
      titre: 'Maquette écran « panier »',
      fait: false,
      projetId: 'p1',
      echeance: jour(-1),
      creeLe: at(9, 0, -1),
    },
    {
      id: 't3',
      titre: 'Composants Input + Select v2',
      fait: false,
      projetId: 'p2',
      echeance: jour(-1),
      creeLe: at(14, 0, -2),
    },
    {
      id: 't4',
      titre: 'Spec écran onboarding Helios',
      fait: false,
      projetId: 'p3',
      echeance: echeanceRelativeVersDate('fri', at(10, 0, -3)),
      creeLe: at(10, 0, -3),
    },
    {
      id: 't5',
      titre: 'Facture Orion — octobre',
      fait: false,
      projetId: 'p5',
      echeance: jour(0),
      creeLe: at(8, 0),
    },
    {
      id: 't6',
      titre: 'Kick-off call Atlas',
      fait: true,
      projetId: 'p4',
      echeance: null,
      creeLe: at(9, 0, -2),
    },
    {
      id: 't7',
      titre: 'Trier les références concurrentes',
      fait: true,
      projetId: 'p4',
      echeance: null,
      creeLe: at(11, 0, -2),
    },
    {
      id: 't8',
      titre: 'Tokens de couleur — contraste AA',
      fait: false,
      projetId: 'p2',
      echeance: null,
      creeLe: at(15, 0, -2),
    },
  ];

  /** @type {import('../types.js').Session[]} */
  const sessions = [
    {
      id: 's1',
      projetId: 'p1',
      description: 'Maquette homepage v3',
      debut: at(9, 5),
      fin: at(10, 30),
      duree: (10 * 60 + 30 - 9 * 60 - 5) * 60_000,
      statut: 'terminee',
    },
    {
      id: 's2',
      projetId: 'p5',
      description: 'Facture Orion — octobre',
      debut: at(10, 35),
      fin: at(11, 20),
      duree: (11 * 60 + 20 - 10 * 60 - 35) * 60_000,
      statut: 'terminee',
    },
    {
      id: 's3',
      projetId: 'p1',
      description: 'Revue wireframes panier',
      debut: at(11, 30),
      fin: at(12, 45),
      duree: (12 * 60 + 45 - 11 * 60 - 30) * 60_000,
      statut: 'terminee',
    },
    {
      id: 's4',
      projetId: 'p3',
      description: 'Onboarding — flow',
      debut: at(9, 15, -1),
      fin: at(11, 30, -1),
      duree: (11 * 60 + 30 - 9 * 60 - 15) * 60_000,
      statut: 'terminee',
    },
    {
      id: 's5',
      projetId: 'p2',
      description: 'Tokens couleur',
      debut: at(13, 30, -1),
      fin: at(15, 20, -1),
      duree: (15 * 60 + 20 - 13 * 60 - 30) * 60_000,
      statut: 'terminee',
    },
    {
      id: 's6',
      projetId: 'p4',
      description: 'Atlas — premières notes',
      debut: at(15, 40, -1),
      fin: at(17, 10, -1),
      duree: (17 * 60 + 10 - 15 * 60 - 40) * 60_000,
      statut: 'terminee',
    },
    {
      id: 's7',
      projetId: 'p1',
      description: 'Brief client',
      debut: at(10, 0, -2),
      fin: at(12, 0, -2),
      duree: 2 * 3600_000,
      statut: 'terminee',
    },
    {
      id: 's8',
      projetId: 'p3',
      description: 'Helios — wireframes',
      debut: at(14, 0, -2),
      fin: at(17, 30, -2),
      duree: 3.5 * 3600_000,
      statut: 'terminee',
    },
    {
      id: 's9',
      projetId: 'p2',
      description: 'DS — revue composants',
      debut: at(9, 30, -3),
      fin: at(12, 15, -3),
      duree: (12 * 60 + 15 - 9 * 60 - 30) * 60_000,
      statut: 'terminee',
    },
    {
      id: 's10',
      projetId: 'p1',
      description: 'Corrections maquettes',
      debut: at(14, 0, -3),
      fin: at(15, 45, -3),
      duree: 1.75 * 3600_000,
      statut: 'terminee',
    },
    {
      id: 's11',
      projetId: 'p4',
      description: 'Audit Atlas — écrans',
      debut: at(9, 0, -4),
      fin: at(12, 30, -4),
      duree: 3.5 * 3600_000,
      statut: 'terminee',
    },
    {
      id: 's12',
      projetId: 'p5',
      description: 'Note de frais',
      debut: at(14, 0, -4),
      fin: at(14, 40, -4),
      duree: 40 * 60_000,
      statut: 'terminee',
    },
    // Today: a session that OVERLAPS the others (shows the parallel lanes on the timeline).
    {
      id: 's13',
      projetId: 'p3',
      description: 'Helios — atelier specs',
      debut: at(9, 30),
      fin: at(12, 0),
      duree: (12 * 60 - 9 * 60 - 30) * 60_000,
      statut: 'terminee',
    },
  ];

  // Two ACTIVE timers in parallel right now (one running, one paused).
  /** @type {import('../types.js').Session[]} */
  const liveSessions = [
    {
      id: 's14',
      projetId: 'p2',
      description: 'Design system — tokens v2',
      debut: now - 38 * 60_000,
      dernierDebut: now - 38 * 60_000,
      fin: null,
      duree: 0,
      statut: 'en_cours',
    },
    {
      id: 's15',
      projetId: 'p4',
      description: 'Atlas — synthèse audit',
      debut: now - 72 * 60_000,
      dernierDebut: null,
      fin: null,
      duree: 26 * 60_000,
      statut: 'en_pause',
    },
  ];

  /** @type {import('../types.js').Pointage[]} */
  const pointage = [
    { id: 'pt1', type: 'arrivee', at: at(8, 58) },
    { id: 'pt2', type: 'pause_debut', at: at(12, 45) },
    { id: 'pt7', type: 'pause_fin', at: at(13, 30) },
    { id: 'pt3', type: 'arrivee', at: at(9, 2, -1) },
    { id: 'pt4', type: 'pause_debut', at: at(12, 30, -1) },
    { id: 'pt5', type: 'pause_fin', at: at(13, 15, -1) },
    { id: 'pt6', type: 'depart', at: at(18, 5, -1) },
  ];

  return { projets, todos, sessions: [...sessions, ...liveSessions], pointage };
}
