// Name prefixing (decision 0005). All apps share one origin, so every name the browser keeps
// for an app (IndexedDB database, localStorage key, Web Lock, BroadcastChannel) starts with
// the app name. This module is the only place in the package that builds such a name.

const APP_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SUFFIX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WORKSPACE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_APP_NAME_LENGTH = 32;

/**
 * Check an app name: lowercase letters, digits and single hyphens, starting with a letter.
 * @param {string} app
 * @returns {string} the app name, unchanged
 */
export function assertAppName(app) {
  if (typeof app !== 'string' || app.length > MAX_APP_NAME_LENGTH || !APP_NAME.test(app)) {
    throw new TypeError(
      `Invalid app name ${JSON.stringify(app)}: use lowercase letters, digits and hyphens, starting with a letter.`,
    );
  }
  return app;
}

/**
 * Check a workspace id (same alphabet as a suffix).
 * @param {string} id
 * @returns {string} the id, unchanged
 */
export function assertWorkspaceId(id) {
  if (typeof id !== 'string' || id.length > 40 || !WORKSPACE_ID.test(id)) {
    throw new TypeError(
      `Invalid workspace id ${JSON.stringify(id)}: use lowercase letters, digits and hyphens.`,
    );
  }
  return id;
}

/**
 * Build a persisted name: `<app>-<suffix>`.
 * @param {string} app
 * @param {string} suffix lowercase letters, digits and hyphens
 * @returns {string}
 */
export function storageName(app, suffix) {
  assertAppName(app);
  if (typeof suffix !== 'string' || !SUFFIX.test(suffix)) {
    throw new TypeError(
      `Invalid name suffix ${JSON.stringify(suffix)}: use lowercase letters, digits and hyphens.`,
    );
  }
  return `${app}-${suffix}`;
}

/** Default IndexedDB database of an app: `<app>-db`. @param {string} app */
export const databaseName = (app) => storageName(app, 'db');

/** Web Lock held by the single writer tab: `<app>-write-lock`. @param {string} app */
export const writeLockName = (app) => storageName(app, 'write-lock');

/** BroadcastChannel that announces a lock release: `<app>-lock-channel`. @param {string} app */
export const lockChannelName = (app) => storageName(app, 'lock-channel');

/**
 * IndexedDB database of one workspace: `<app>__<id>` (decision 0005 names `chrono__default`).
 * @param {string} app
 * @param {string} workspaceId
 * @returns {string}
 */
export function workspaceDatabaseName(app, workspaceId) {
  assertAppName(app);
  return `${app}__${assertWorkspaceId(workspaceId)}`;
}
