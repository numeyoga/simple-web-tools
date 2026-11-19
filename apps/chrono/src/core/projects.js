// Projects: add, edit, archive, delete (a deletion also removes the project's sessions and todos).

/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').Project} Project */

/**
 * @param {ChronoData} data
 * @param {{ name: string, client?: string, color?: string }} payload
 * @param {string} newId
 * @returns {ChronoData}
 */
export function addProject(data, { name, client = '', color = '#2563eb' }, newId) {
  return {
    ...data,
    projects: [...data.projects, { id: newId, name, client, color, archived: false }],
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string, patch: Partial<Project> }} payload
 * @returns {ChronoData}
 */
export function updateProject(data, { id, patch }) {
  return { ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

/**
 * Toggles the archived flag.
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @returns {ChronoData}
 */
export function toggleProjectArchived(data, { id }) {
  return {
    ...data,
    projects: data.projects.map((p) => (p.id === id ? { ...p, archived: !p.archived } : p)),
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string }} payload
 * @returns {ChronoData}
 */
export function deleteProject(data, { id }) {
  return {
    ...data,
    projects: data.projects.filter((p) => p.id !== id),
    sessions: data.sessions.filter((s) => s.projectId !== id),
    todos: data.todos.filter((t) => t.projectId !== id),
  };
}
