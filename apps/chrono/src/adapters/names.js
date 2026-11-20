// Persisted names of Chrono, besides the ones built by the registry of workspaces. Every name
// is built with `storageName` of @simple-web-tools/storage, so it starts with the app name
// (decision 0005). The `legacy*` names are the ones of the version 1 layout: they are only
// read, to migrate, and never deleted.

import { storageName } from '@simple-web-tools/storage';

export const APP = 'chrono';

/** localStorage fallback of a workspace (data in the version 2 layout): `chrono-fallback-<id>-v2`. @param {string} id */
export const fallbackKey = (id) => storageName(APP, `fallback-${id}-v2`);

/** BroadcastChannel announcing a write to the other tabs of a workspace: `chrono-sync-<id>`. @param {string} id */
export const channelName = (id) => storageName(APP, `sync-${id}`);

/** Workspace list key of the registry of @simple-web-tools/storage (`chrono-workspaces`). */
export const workspaceListKey = () => storageName(APP, 'workspaces');

/**
 * Workspaces whose id was repaired during the migration of the version 1 list, with the state
 * of the copy of their database (JSON `{ from, to, copied }[]`): `chrono-legacy-workspaces`.
 */
export const legacyWorkspacesKey = () => storageName(APP, 'legacy-workspaces');

/** Ids of the removed workspaces, whose old fallback must not come back: `chrono-fallback-skipped`. */
export const fallbackSkippedKey = () => storageName(APP, 'fallback-skipped');

/** Raw name of a version 1 database, which may not be a valid workspace id: `chrono__<id>`. @param {string} legacyId */
export const legacyDatabaseName = (legacyId) => `${APP}__${legacyId}`;

/** Version 1 workspace list, `{ id, label, creeLe, seedOnInit }[]`. */
export const LEGACY_WORKSPACES_KEY = 'chrono.workspaces';
/** Version 1 active workspace id. */
export const LEGACY_ACTIVE_KEY = 'chrono.workspace.active';
/** Version 1 localStorage fallback of a workspace (data in the version 1 layout). @param {string} id */
export const legacyFallbackKey = (id) => `chrono.fallback.${id}.v1`;

/** Theme chosen in the preferences: `light` or `dark`; absent, the theme follows the system. `chrono-theme`. */
export const themeKey = () => storageName(APP, 'theme');

/** Text size chosen in the preferences: `standard`, `comfortable` or `large`; absent, automatic. `chrono-text-size`. */
export const textSizeKey = () => storageName(APP, 'text-size');

/** Single-key shortcuts (Space, N, S): `1` on, `0` off; absent, on. `chrono-single-key-shortcuts`. */
export const singleKeyShortcutsKey = () => storageName(APP, 'single-key-shortcuts');

/** Totals shown on the project cards: `1` shown, `0` hidden; absent, hidden. `chrono-show-project-totals`. */
export const showProjectTotalsKey = () => storageName(APP, 'show-project-totals');

/** Version 1 key of the project totals preference (same `1` / `0` values). Read once, never deleted. */
export const LEGACY_PROJECT_TOTALS_KEY = 'chrono.prefs.projetsTotaux';

/** Language chosen in the preferences: `en` or `fr`; absent, the browser's language. `chrono-locale`. */
export const localeKey = () => storageName(APP, 'locale');
