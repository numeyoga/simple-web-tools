// Every persisted or shared name of Transient Notes. All the apps live on one origin, so every
// name starts with the app name (decision 0005), and each one is built with the helpers of
// `@simple-web-tools/storage`, never concatenated by hand elsewhere. `tests/unit/names.test.js`
// asserts the prefix of each name, of the ones this module builds and of the ones the shared
// packages build for the app (workspace list, write lock, language).
//
//   IndexedDB       transient-notes__<workspace id>    one database per workspace
//   Web Lock        transient-notes-write-lock         one lock for the whole app
//   Lock channel    transient-notes-lock-channel       lock released (storage package)
//   BroadcastChannel transient-notes-sync-<id>         a workspace was written
//   localStorage    transient-notes-workspaces, -workspace-active (registry of the storage
//                   package), -theme, -text-size, -single-key-shortcuts, -locale (i18n package)
//   Cache Storage   transient-notes-shell-<build id>   the offline shell (src/core/pwa.js)

import {
  lockChannelName,
  storageName,
  workspaceDatabaseName,
  writeLockName,
} from '@simple-web-tools/storage';

export const APP = 'transient-notes';

/** IndexedDB database of a workspace: `transient-notes__<id>`. @param {string} id */
export const databaseNameFor = (id) => workspaceDatabaseName(APP, id);

/** The one Web Lock of the app (the single writer): `transient-notes-write-lock`. */
export const lockName = () => writeLockName(APP);

/** BroadcastChannel that tells the read-only tabs the lock was released. */
export const lockChannelNameFor = () => lockChannelName(APP);

/** BroadcastChannel announcing a write to the other tabs of a workspace: `transient-notes-sync-<id>`. @param {string} id */
export const channelName = (id) => storageName(APP, `sync-${id}`);

/** Workspace list (registry of @simple-web-tools/storage): `transient-notes-workspaces`. */
export const workspaceListKey = () => storageName(APP, 'workspaces');

/** Active workspace id (registry of @simple-web-tools/storage): `transient-notes-workspace-active`. */
export const activeWorkspaceKey = () => storageName(APP, 'workspace-active');

/** Theme chosen in the preferences: `light` or `dark`; absent, the theme follows the system. `transient-notes-theme`. */
export const themeKey = () => storageName(APP, 'theme');

/** Text size chosen in the preferences: `standard`, `comfortable` or `large`; absent, automatic. */
export const textSizeKey = () => storageName(APP, 'text-size');

/** Single-key shortcuts: `1` on, `0` off; absent, on. `transient-notes-single-key-shortcuts`. */
export const singleKeyShortcutsKey = () => storageName(APP, 'single-key-shortcuts');

/** Language chosen in the preferences: `en` or `fr`; absent, the browser's language. */
export const localeKey = () => storageName(APP, 'locale');

/** The categories of the tree the user folded, per workspace: `transient-notes-collapsed-<id>`. @param {string} id */
export const collapsedCategoriesKey = (id) => storageName(APP, `collapsed-${id}`);
