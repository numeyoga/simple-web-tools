// Projects: add, edit, archive, delete (a deletion also removes the project's sessions and todos).

import { isCategory, nextCategory, normalizeHex } from './categories.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').Project} Project */

/**
 * The colour of a project as the two stored fields: the chosen category, else the free colour,
 * else the next category of the default order (see `nextCategory`).
 * @param {ChronoData} data
 * @param {{ category?: number | null, customColor?: string | null }} choice
 * @returns {Pick<Project, 'category' | 'customColor'>}
 */
function resolveColor(data, { category, customColor }) {
  if (isCategory(category)) return { category, customColor: null };
  const custom = normalizeHex(customColor);
  if (custom !== null) return { category: null, customColor: custom };
  return { category: nextCategory(data.projects), customColor: null };
}

/**
 * A new project. Without a `category` or a `customColor` it takes the next category of the
 * default order.
 * @param {ChronoData} data
 * @param {{ name: string, client?: string, category?: number | null, customColor?: string | null }} payload
 * @param {string} newId
 * @returns {ChronoData}
 */
export function addProject(data, { name, client = '', category, customColor }, newId) {
  const color = resolveColor(data, { category, customColor });
  return {
    ...data,
    projects: [...data.projects, { id: newId, name, client, ...color, archived: false }],
  };
}

/**
 * @param {ChronoData} data
 * @param {{ id: string, patch: Partial<Project> }} payload
 * @returns {ChronoData}
 */
export function updateProject(data, { id, patch }) {
  return {
    ...data,
    projects: data.projects.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      // A patch that names a colour keeps exactly one of the two fields.
      if ('category' in patch || 'customColor' in patch)
        Object.assign(next, resolveColor(data, patch));
      return next;
    }),
  };
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
