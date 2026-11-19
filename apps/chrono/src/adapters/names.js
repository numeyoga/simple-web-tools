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

/** Workspaces created without demo data (JSON list of ids): `chrono-workspaces-no-demo`. */
export const noDemoKey = () => storageName(APP, 'workspaces-no-demo');

/** Version 1 workspace list, `{ id, label, creeLe, seedOnInit }[]`. */
export const LEGACY_WORKSPACES_KEY = 'chrono.workspaces';
/** Version 1 active workspace id. */
export const LEGACY_ACTIVE_KEY = 'chrono.workspace.active';
/** Version 1 localStorage fallback of a workspace (data in the version 1 layout). @param {string} id */
export const legacyFallbackKey = (id) => `chrono.fallback.${id}.v1`;
