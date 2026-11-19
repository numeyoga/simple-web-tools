// Todos: add, toggle, delete, edit.

/** @typedef {import('../types.js').Donnees} Donnees */
/** @typedef {import('../types.js').Todo} Todo */

/**
 * Adds a todo at the top of the list.
 * @param {Donnees} data
 * @param {{ titre: string, projetId?: string | null, echeance?: string | null, description?: string }} payload
 * @param {number} now creation time
 * @param {string} newId
 * @returns {Donnees}
 */
export function ajouterTodo(
  data,
  { titre, projetId, echeance = null, description = '' },
  now,
  newId,
) {
  return {
    ...data,
    todos: [
      {
        id: newId,
        titre,
        description: (description || '').slice(0, 2000),
        fait: false,
        projetId: projetId || null,
        echeance,
        creeLe: now,
      },
      ...data.todos,
    ],
  };
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @returns {Donnees}
 */
export function toggleTodo(data, { id }) {
  return { ...data, todos: data.todos.map((t) => (t.id === id ? { ...t, fait: !t.fait } : t)) };
}

/**
 * @param {Donnees} data
 * @param {{ id: string }} payload
 * @returns {Donnees}
 */
export function supprimerTodo(data, { id }) {
  return { ...data, todos: data.todos.filter((t) => t.id !== id) };
}

/**
 * @param {Donnees} data
 * @param {{ id: string, patch: Partial<Todo> }} payload
 * @returns {Donnees}
 */
export function majTodo(data, { id, patch }) {
  return { ...data, todos: data.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}
