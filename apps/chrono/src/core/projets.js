// Projects: add, edit, archive, delete (a deletion also removes the project's sessions and todos).

/** @typedef {import('../types.js').Donnees} Donnees */
/** @typedef {import('../types.js').Projet} Projet */

/**
 * @param {Donnees} data
 * @param {{ nom: string, client?: string, couleur?: string }} payload
 * @param {string} newId
 * @returns {Donnees}
 */
export function ajouterProjet(data, { nom, client = '', couleur = '#2563eb' }, newId) {
  return {
    ...data,
    projets: [...data.projets, { id: newId, nom, client, couleur, archive: false }],
  };
}

/**
 * @param {Donnees} data
 * @param {{ id: string, patch: Partial<Projet> }} payload
 * @returns {Donnees}
 */
export function majProjet(data, { id, patch }) {
  return { ...data, projets: data.projets.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

/**
 * Toggles the archived flag.
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @returns {Donnees}
 */
export function archiverProjet(data, { id }) {
  return {
    ...data,
    projets: data.projets.map((p) => (p.id === id ? { ...p, archive: !p.archive } : p)),
  };
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @returns {Donnees}
 */
export function supprimerProjet(data, { id }) {
  return {
    ...data,
    projets: data.projets.filter((p) => p.id !== id),
    sessions: data.sessions.filter((s) => s.projetId !== id),
    todos: data.todos.filter((t) => t.projetId !== id),
  };
}
