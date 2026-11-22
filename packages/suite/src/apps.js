/**
 * The apps of the suite. Pure: no DOM, no storage, no clock.
 *
 * App names are proper nouns, the same in every language, so they live here and not in a
 * translation catalog (decision 0002). Add every new app to this list: a test compares it
 * with the folders of `apps/`.
 */

/**
 * @typedef {object} SuiteApp
 * @property {string} id Folder name under `apps/` and path segment on the assembled site.
 * @property {string} name Display name.
 * @property {string} icon Phosphor icon name, without the `ph-` prefix.
 */

/** @type {readonly Readonly<SuiteApp>[]} */
export const APPS = Object.freeze([
  Object.freeze({ id: 'chrono', name: 'Chrono', icon: 'timer' }),
  Object.freeze({ id: 'locavern', name: 'Locavern', icon: 'kanban' }),
  Object.freeze({ id: 'transient-notes', name: 'Transient Notes', icon: 'note-pencil' }),
]);

/**
 * The app with this id.
 * @param {string} id
 * @returns {Readonly<SuiteApp>}
 * @throws {Error} when no app has this id.
 */
export function findApp(id) {
  const app = APPS.find((candidate) => candidate.id === id);
  if (!app) throw new Error(`Unknown app: ${id}`);
  return app;
}

/**
 * The URL of an app, relative to the root of the current app (`<site>/<app>/`). A fragment
 * such as `#tasks` does not change how it resolves. It only works on the assembled site.
 * @param {string} id
 * @returns {string}
 * @throws {Error} when no app has this id.
 */
export function appHref(id) {
  return `../${findApp(id).id}/`;
}
