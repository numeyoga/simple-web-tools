// The screens of the app and the `#/...` addresses that name them. Pure: the adapter reads
// `location.hash` and calls these.
//
//   #/app/<application id>          an application
//   #/admin/templates[/<id>]        the templates, one selected
//   #/admin/metadata[/<id>]         the metadata fields of a template
//   #/admin/tags                    the tags
//   #/admin/data                    export and import
//   #/admin/settings                the settings of the workspace
//   (anything else)                 the application opened at the start

/** The admin screens, in the order the sidebar lists them. */
export const ADMIN_PAGES = /** @type {const} */ ([
  'templates',
  'metadata',
  'tags',
  'data',
  'settings',
]);

/** @typedef {typeof ADMIN_PAGES[number]} AdminPage */
/**
 * @typedef {{ screen: 'app', appId: string | null }
 *   | { screen: 'admin', page: AdminPage, templateId: string | null }} Route
 */

/**
 * @param {string} hash `location.hash`, with or without the `#`
 * @returns {Route}
 */
export function parseRoute(hash) {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter((part) => part !== '')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  if (parts[0] === 'admin') {
    const page = ADMIN_PAGES.find((candidate) => candidate === parts[1]);
    if (page) {
      return {
        screen: 'admin',
        page,
        templateId: page === 'templates' || page === 'metadata' ? (parts[2] ?? null) : null,
      };
    }
  }
  if (parts[0] === 'app' && parts[1]) return { screen: 'app', appId: parts[1] };
  return { screen: 'app', appId: null };
}

/**
 * The address of a route, as a hash.
 * @param {Route} route
 * @returns {string}
 */
export function routeHash(route) {
  if (route.screen === 'app') {
    return route.appId ? `#/app/${encodeURIComponent(route.appId)}` : '#/';
  }
  const suffix = route.templateId ? `/${encodeURIComponent(route.templateId)}` : '';
  return `#/admin/${route.page}${suffix}`;
}

/**
 * @param {Route} a
 * @param {Route} b
 */
export function sameRoute(a, b) {
  return routeHash(a) === routeHash(b);
}
