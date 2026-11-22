// Every persisted or shared name of Dashboard. All the apps live on one origin, so every name
// starts with the app name (decision 0005), and each one is built with the helpers of
// `@simple-web-tools/storage`, never concatenated by hand elsewhere. `tests/unit/names.test.js`
// asserts the prefix of each name, of the ones this module builds and of the ones the shared
// packages build for the app (workspace list, write lock, language).
//
//   IndexedDB       dashboard__<workspace id>    one database per workspace
//   Web Lock        dashboard-write-lock         one lock for the whole app
//   Lock channel    dashboard-lock-channel       lock released (storage package)
//   BroadcastChannel dashboard-sync-<id>         a workspace was written
//   localStorage    dashboard-workspaces, -workspace-active (registry of the storage package),
//                   -theme, -text-size, -density, -single-key-shortcuts, -view-<id>,
//                   -locale (i18n package)
//   Cache Storage   dashboard-shell-<build id>   the offline shell (@simple-web-tools/pwa)
//
// The earlier version of the app (GitLab Pages, another origin) shared nothing with this one: its
// data comes over by its JSON export.

import {
  lockChannelName,
  storageName,
  workspaceDatabaseName,
  writeLockName,
} from '@simple-web-tools/storage';

export const APP = 'dashboard';

/** IndexedDB database of a workspace: `dashboard__<id>`. @param {string} id */
export const databaseNameFor = (id) => workspaceDatabaseName(APP, id);

/** The one Web Lock of the app (the single writer): `dashboard-write-lock`. */
export const lockName = () => writeLockName(APP);

/** BroadcastChannel that tells the read-only tabs the lock was released. */
export const lockChannelNameFor = () => lockChannelName(APP);

/** BroadcastChannel announcing a write to the other tabs of a workspace: `dashboard-sync-<id>`. @param {string} id */
export const channelName = (id) => storageName(APP, `sync-${id}`);

/** Workspace list (registry of @simple-web-tools/storage): `dashboard-workspaces`. */
export const workspaceListKey = () => storageName(APP, 'workspaces');

/** Active workspace id (registry of @simple-web-tools/storage): `dashboard-workspace-active`. */
export const activeWorkspaceKey = () => storageName(APP, 'workspace-active');

/** Theme chosen in the preferences: `light` or `dark`; absent, the theme follows the system. `dashboard-theme`. */
export const themeKey = () => storageName(APP, 'theme');

/** Text size chosen in the preferences: `standard`, `comfortable` or `large`; absent, automatic. */
export const textSizeKey = () => storageName(APP, 'text-size');

/** Single-key shortcuts: `1` on, `0` off; absent, on. `dashboard-single-key-shortcuts`. */
export const singleKeyShortcutsKey = () => storageName(APP, 'single-key-shortcuts');

/** Language chosen in the preferences: `en` or `fr`; absent, the browser's language. */
export const localeKey = () => storageName(APP, 'locale');

/** Density chosen in the preferences: `comfortable` or `compact`; absent, comfortable. `dashboard-density`. */
export const densityKey = () => storageName(APP, 'density');

/**
 * What the person looked at last in a workspace: `{ appId, envs: { <appId>: <env key> } }`, used
 * for "the last application" and "remember the environment". `dashboard-view-<workspace id>`.
 * @param {string} id
 */
export const viewKey = (id) => storageName(APP, `view-${id}`);
