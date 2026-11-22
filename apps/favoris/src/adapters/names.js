// Every persisted or shared name of Favoris. All the apps live on one origin, so every name
// starts with the app name (decision 0005), and each one is built with the helpers of
// `@simple-web-tools/storage`, never concatenated by hand elsewhere. `tests/unit/names.test.js`
// asserts the prefix of each name, of the ones this module builds and of the ones the shared
// packages build for the app (workspace list, write lock, language).
//
//   IndexedDB       favoris__<workspace id>    one database per workspace
//   Web Lock        favoris-write-lock         one lock for the whole app
//   Lock channel    favoris-lock-channel       lock released (storage package)
//   Web Lock        favoris-legacy-import-lock held while the old data is imported
//   BroadcastChannel favoris-sync-<id>         a workspace was written
//   localStorage    favoris-workspaces, -workspace-active (registry of the storage package),
//                   -theme, -text-size, -single-key-shortcuts, -site-icons, -legacy-import,
//                   -locale (i18n package)
//   Cache Storage   favoris-shell-<build id>   the offline shell (@simple-web-tools/pwa)
//
// The keys of the previous version of the app (`favoris.spaces`, `favoris.v1:<id>`...) are not
// names of this app: they are read once, never written (src/core/legacy.js).

import {
  lockChannelName,
  storageName,
  workspaceDatabaseName,
  writeLockName,
} from '@simple-web-tools/storage';

export const APP = 'favoris';

/** IndexedDB database of a workspace: `favoris__<id>`. @param {string} id */
export const databaseNameFor = (id) => workspaceDatabaseName(APP, id);

/** The one Web Lock of the app (the single writer): `favoris-write-lock`. */
export const lockName = () => writeLockName(APP);

/** BroadcastChannel that tells the read-only tabs the lock was released. */
export const lockChannelNameFor = () => lockChannelName(APP);

/** BroadcastChannel announcing a write to the other tabs of a workspace: `favoris-sync-<id>`. @param {string} id */
export const channelName = (id) => storageName(APP, `sync-${id}`);

/** Workspace list (registry of @simple-web-tools/storage): `favoris-workspaces`. */
export const workspaceListKey = () => storageName(APP, 'workspaces');

/** Active workspace id (registry of @simple-web-tools/storage): `favoris-workspace-active`. */
export const activeWorkspaceKey = () => storageName(APP, 'workspace-active');

/** Theme chosen in the preferences: `light` or `dark`; absent, the theme follows the system. `favoris-theme`. */
export const themeKey = () => storageName(APP, 'theme');

/** Text size chosen in the preferences: `standard`, `comfortable` or `large`; absent, automatic. */
export const textSizeKey = () => storageName(APP, 'text-size');

/** Single-key shortcuts: `1` on, `0` off; absent, on. `favoris-single-key-shortcuts`. */
export const singleKeyShortcutsKey = () => storageName(APP, 'single-key-shortcuts');

/** Language chosen in the preferences: `en` or `fr`; absent, the browser's language. */
export const localeKey = () => storageName(APP, 'locale');

/**
 * Site icons from Google (decision 0008): `1` on; absent or `0`, off. `favoris-site-icons`.
 */
export const siteIconsKey = () => storageName(APP, 'site-icons');

/**
 * Set to `1` once the data of the previous version was imported (or found absent), so that the
 * import runs once. `favoris-legacy-import`.
 */
export const legacyImportKey = () => storageName(APP, 'legacy-import');

/** The Web Lock that makes two tabs importing the old data at once take turns. */
export const legacyImportLockName = () => storageName(APP, 'legacy-import-lock');
