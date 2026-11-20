// Demo data and the empty data set. The clock is passed in.

import { formatLocalDate } from './dates.js';
import { relativeLabelToDate } from './due-dates.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */

/**
 * @returns {ChronoData}
 */
export function emptyData() {
  return { projects: [], todos: [], sessions: [], attendance: [] };
}

/**
 * Demo data, built around `now`.
 * @param {number} now
 * @returns {ChronoData}
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

  const projects = [
    {
      id: 'p1',
      name: 'Refonte site — Orion SAS',
      client: 'Orion SAS',
      category: 1,
      customColor: null,
      archived: false,
    },
    {
      id: 'p2',
      name: 'Design system interne',
      client: 'Interne',
      category: 9,
      customColor: null,
      archived: false,
    },
    {
      id: 'p3',
      name: 'App mobile Helios',
      client: 'Helios',
      category: 5,
      customColor: null,
      archived: false,
    },
    {
      id: 'p4',
      name: 'Audit UX — Atlas',
      client: 'Atlas Co.',
      category: 12,
      customColor: null,
      archived: false,
    },
    {
      id: 'p5',
      name: 'Admin & compta',
      client: 'Interne',
      category: 16,
      customColor: null,
      archived: false,
    },
    {
      id: 'p6',
      name: 'Migration v2 — Phoenix',
      client: 'Phoenix Ltd',
      category: 7,
      customColor: null,
      archived: true,
    },
  ];

  // Absolute due dates. Same results as the old relative labels anchored on createdAt.
  const day = (/** @type {number} */ offset) => formatLocalDate(new Date(at(0, 0, offset)));
  const todos = [
    {
      id: 't1',
      title: 'Valider la palette avec Orion',
      done: false,
      projectId: 'p1',
      dueDate: day(-1),
      createdAt: at(8, 30, -1),
    },
    {
      id: 't2',
      title: 'Maquette écran « panier »',
      done: false,
      projectId: 'p1',
      dueDate: day(-1),
      createdAt: at(9, 0, -1),
    },
    {
      id: 't3',
      title: 'Composants Input + Select v2',
      done: false,
      projectId: 'p2',
      dueDate: day(-1),
      createdAt: at(14, 0, -2),
    },
    {
      id: 't4',
      title: 'Spec écran onboarding Helios',
      done: false,
      projectId: 'p3',
      dueDate: relativeLabelToDate('fri', at(10, 0, -3)),
      createdAt: at(10, 0, -3),
    },
    {
      id: 't5',
      title: 'Facture Orion — octobre',
      done: false,
      projectId: 'p5',
      dueDate: day(0),
      createdAt: at(8, 0),
    },
    {
      id: 't6',
      title: 'Kick-off call Atlas',
      done: true,
      projectId: 'p4',
      dueDate: null,
      createdAt: at(9, 0, -2),
    },
    {
      id: 't7',
      title: 'Trier les références concurrentes',
      done: true,
      projectId: 'p4',
      dueDate: null,
      createdAt: at(11, 0, -2),
    },
    {
      id: 't8',
      title: 'Tokens de couleur — contraste AA',
      done: false,
      projectId: 'p2',
      dueDate: null,
      createdAt: at(15, 0, -2),
    },
  ];

  /** @type {import('../types.js').Session[]} */
  const sessions = [
    {
      id: 's1',
      projectId: 'p1',
      description: 'Maquette homepage v3',
      start: at(9, 5),
      end: at(10, 30),
      duration: (10 * 60 + 30 - 9 * 60 - 5) * 60_000,
      status: 'done',
    },
    {
      id: 's2',
      projectId: 'p5',
      description: 'Facture Orion — octobre',
      start: at(10, 35),
      end: at(11, 20),
      duration: (11 * 60 + 20 - 10 * 60 - 35) * 60_000,
      status: 'done',
    },
    {
      id: 's3',
      projectId: 'p1',
      description: 'Revue wireframes panier',
      start: at(11, 30),
      end: at(12, 45),
      duration: (12 * 60 + 45 - 11 * 60 - 30) * 60_000,
      status: 'done',
    },
    {
      id: 's4',
      projectId: 'p3',
      description: 'Onboarding — flow',
      start: at(9, 15, -1),
      end: at(11, 30, -1),
      duration: (11 * 60 + 30 - 9 * 60 - 15) * 60_000,
      status: 'done',
    },
    {
      id: 's5',
      projectId: 'p2',
      description: 'Tokens couleur',
      start: at(13, 30, -1),
      end: at(15, 20, -1),
      duration: (15 * 60 + 20 - 13 * 60 - 30) * 60_000,
      status: 'done',
    },
    {
      id: 's6',
      projectId: 'p4',
      description: 'Atlas — premières notes',
      start: at(15, 40, -1),
      end: at(17, 10, -1),
      duration: (17 * 60 + 10 - 15 * 60 - 40) * 60_000,
      status: 'done',
    },
    {
      id: 's7',
      projectId: 'p1',
      description: 'Brief client',
      start: at(10, 0, -2),
      end: at(12, 0, -2),
      duration: 2 * 3600_000,
      status: 'done',
    },
    {
      id: 's8',
      projectId: 'p3',
      description: 'Helios — wireframes',
      start: at(14, 0, -2),
      end: at(17, 30, -2),
      duration: 3.5 * 3600_000,
      status: 'done',
    },
    {
      id: 's9',
      projectId: 'p2',
      description: 'DS — revue composants',
      start: at(9, 30, -3),
      end: at(12, 15, -3),
      duration: (12 * 60 + 15 - 9 * 60 - 30) * 60_000,
      status: 'done',
    },
    {
      id: 's10',
      projectId: 'p1',
      description: 'Corrections maquettes',
      start: at(14, 0, -3),
      end: at(15, 45, -3),
      duration: 1.75 * 3600_000,
      status: 'done',
    },
    {
      id: 's11',
      projectId: 'p4',
      description: 'Audit Atlas — écrans',
      start: at(9, 0, -4),
      end: at(12, 30, -4),
      duration: 3.5 * 3600_000,
      status: 'done',
    },
    {
      id: 's12',
      projectId: 'p5',
      description: 'Note de frais',
      start: at(14, 0, -4),
      end: at(14, 40, -4),
      duration: 40 * 60_000,
      status: 'done',
    },
    // Today: a session that OVERLAPS the others (shows the parallel lanes on the timeline).
    {
      id: 's13',
      projectId: 'p3',
      description: 'Helios — atelier specs',
      start: at(9, 30),
      end: at(12, 0),
      duration: (12 * 60 - 9 * 60 - 30) * 60_000,
      status: 'done',
    },
  ];

  // Two ACTIVE timers in parallel right now (one running, one paused).
  /** @type {import('../types.js').Session[]} */
  const liveSessions = [
    {
      id: 's14',
      projectId: 'p2',
      description: 'Design system — tokens v2',
      start: now - 38 * 60_000,
      lastStart: now - 38 * 60_000,
      end: null,
      duration: 0,
      status: 'running',
    },
    {
      id: 's15',
      projectId: 'p4',
      description: 'Atlas — synthèse audit',
      start: now - 72 * 60_000,
      lastStart: null,
      end: null,
      duration: 26 * 60_000,
      status: 'paused',
    },
  ];

  /** @type {import('../types.js').AttendanceEvent[]} */
  const attendance = [
    { id: 'pt1', type: 'arrival', at: at(8, 58) },
    { id: 'pt2', type: 'break_start', at: at(12, 45) },
    { id: 'pt7', type: 'break_end', at: at(13, 30) },
    { id: 'pt3', type: 'arrival', at: at(9, 2, -1) },
    { id: 'pt4', type: 'break_start', at: at(12, 30, -1) },
    { id: 'pt5', type: 'break_end', at: at(13, 15, -1) },
    { id: 'pt6', type: 'departure', at: at(18, 5, -1) },
  ];

  return { projects, todos, sessions: [...sessions, ...liveSessions], attendance };
}
