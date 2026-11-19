// Todos: add, toggle, delete, edit.

/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').Todo} Todo */

/**
 * Adds a todo at the top of the list.
 * @param {ChronoData} data
 * @param {{ title: string, projectId?: string | null, dueDate?: string | null, description?: string }} payload
 * @param {number} now creation time
 * @param {string} newId
 * @returns {ChronoData}
 */
export function addTodo(data, { title, projectId, dueDate = null, description = '' }, now, newId) {
  return {
    ...data,
    todos: [
      {
        id: newId,
        title,
        description: (description || '').slice(0, 2000),
        done: false,
        projectId: projectId || null,
        dueDate,
        createdAt: now,
      },
      ...data.todos,
    ],
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @returns {ChronoData}
 */
export function toggleTodo(data, { id }) {
  return { ...data, todos: data.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @returns {ChronoData}
 */
export function deleteTodo(data, { id }) {
  return { ...data, todos: data.todos.filter((t) => t.id !== id) };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string, patch: Partial<Todo> }} payload
 * @returns {ChronoData}
 */
export function updateTodo(data, { id, patch }) {
  return { ...data, todos: data.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}
