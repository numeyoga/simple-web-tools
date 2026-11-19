// JSON export payload and import validation. The format is versioned (`version: 1`).

import { migrerEcheancesTodos } from './echeances.js';

/** @typedef {import('../types.js').Donnees} Donnees */
/** @typedef {import('../types.js').ExportJSON} ExportJSON */
/** @typedef {import('../types.js').EspaceDeSauvegarde} EspaceDeSauvegarde */

const STATUTS_SESSION = ['terminee', 'en_cours', 'en_pause'];

/**
 * Keeps "object with a text id" items.
 * @param {unknown} x
 * @returns {boolean}
 */
const estObjetAvecId = (x) =>
  !!x &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  typeof (/** @type {{ id?: unknown }} */ (x).id) === 'string';

/**
 * Same, with a known status for sessions.
 * @param {unknown} x
 * @returns {boolean}
 */
const estSessionValide = (x) =>
  estObjetAvecId(x) &&
  STATUTS_SESSION.includes(/** @type {{ statut?: string }} */ (x).statut ?? '');

/**
 * Builds the export payload of a workspace.
 * @param {Donnees} data
 * @param {EspaceDeSauvegarde} workspace
 * @param {number} now export time
 * @returns {ExportJSON}
 */
export function construireExport(data, workspace, now) {
  return {
    version: 1,
    exporteLe: new Date(now).toISOString(),
    workspace,
    data: {
      projets: data.projets,
      todos: data.todos,
      sessions: data.sessions,
      pointage: data.pointage,
    },
  };
}

/**
 * Validates and cleans an imported payload (an export file, or its `data` part). Invalid
 * items are dropped, old due dates are migrated. Throws when the format is wrong or when
 * nothing valid remains.
 * @param {unknown} payload
 * @param {number} now
 * @returns {Donnees}
 */
export function validerImport(payload, now) {
  const racine = /** @type {{ data?: unknown } | null | undefined} */ (payload);
  const data = /** @type {Partial<Record<keyof Donnees, unknown>> | null | undefined} */ (
    racine?.data || payload
  );
  if (!data || typeof data !== 'object') throw new Error('format invalide');
  const brut = {
    projets: Array.isArray(data.projets) ? data.projets : [],
    todos: Array.isArray(data.todos) ? data.todos : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    pointage: Array.isArray(data.pointage) ? data.pointage : [],
  };
  const projets = brut.projets.filter(estObjetAvecId);
  const todos = migrerEcheancesTodos(brut.todos.filter(estObjetAvecId), now).todos;
  const sessions = brut.sessions.filter(estSessionValide);
  const pointage = brut.pointage.filter(estObjetAvecId);
  const nbBrut =
    brut.projets.length + brut.todos.length + brut.sessions.length + brut.pointage.length;
  if (nbBrut > 0 && projets.length + todos.length + sessions.length + pointage.length === 0) {
    throw new Error('aucune donnée valide');
  }
  return { projets, todos, sessions, pointage };
}
