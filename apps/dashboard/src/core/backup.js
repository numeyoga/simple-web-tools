/** @import { Skipped, WorkspaceData } from '../types.d.ts' */

// The JSON backup of a workspace: what goes into `data` of the export envelope of
// `@simple-web-tools/storage` (the envelope itself is built in `adapters/backup.js`), and the
// validation of what comes back, record by record. Also the file the earlier version exported,
// `{ version: 1, exportedAt, data }` or the bare dashboard object, which an import accepts. Pure.
//
// Schema version 1: `{ settings: Settings, templates: Template[], apps: App[] }`.

import { cleanData } from './model.js';

/** App, format and version written in the envelope. Bump the version with a migration. */
export const BACKUP_APP = 'dashboard';
export const BACKUP_FORMAT = 'dashboard-workspace';
export const BACKUP_VERSION = 1;

/** A file that is not a usable backup. `code` is for the interface, the message for developers. */
export class BackupError extends Error {
  /** @param {'invalid-data'} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * The `data` of a backup.
 * @param {WorkspaceData} data
 * @returns {WorkspaceData}
 */
export function buildBackupData({ settings, templates, apps }) {
  return { settings, templates: [...templates], apps: [...apps] };
}

/**
 * Validates the `data` of a backup and returns it cleaned, with what was left out. Records that
 * cannot be used are skipped, not fatal.
 * @param {unknown} raw
 * @param {() => string} makeId gives an id to a record that has none
 * @returns {{ data: WorkspaceData, skipped: Skipped }}
 * @throws {BackupError} `invalid-data` when `data` is not an object with a list of templates and
 *   a list of applications
 */
export function validateBackupData(raw, makeId) {
  if (!isRecord(raw)) throw new BackupError('invalid-data', 'The backup has no data.');
  const { settings, templates, apps } = raw;
  if (!Array.isArray(templates) || !Array.isArray(apps)) {
    throw new BackupError(
      'invalid-data',
      'The backup needs a list of templates and a list of applications.',
    );
  }
  return cleanData({ settings: isRecord(settings) ? settings : {}, templates, apps }, { makeId });
}

/* ------------------------------------------------------------------ */
/* The earlier version's export */

/**
 * The dashboard object of a file the earlier version exported: the bare object, or the `data` of
 * `{ version, exportedAt, data }`. `null` when the value is neither. Requires the two lists, as
 * the earlier version's import did. A file with an `app` or a `format` is this version's own.
 * @param {unknown} value a parsed JSON value
 * @returns {Record<string, unknown> | null}
 */
export function legacyDashboard(value) {
  if (!isRecord(value) || value.app !== undefined || value.format !== undefined) return null;
  const candidate = isRecord(value.data) ? value.data : value;
  return Array.isArray(candidate.apps) && Array.isArray(candidate.templates) ? candidate : null;
}

/**
 * Reads the earlier version's dashboard object as workspace data. Its theme and density are
 * preferences of the person here, not data: they are left out.
 * @param {Record<string, unknown>} dashboard from `legacyDashboard`
 * @param {() => string} makeId
 * @returns {{ data: WorkspaceData, skipped: Skipped }}
 */
export function readLegacyData(dashboard, makeId) {
  return cleanData(
    {
      dashboardName: dashboard.dashboardName,
      defaultAppId: dashboard.defaultAppId,
      defaultEnv: dashboard.defaultEnv,
      tags: dashboard.tags,
      templates: dashboard.templates,
      apps: dashboard.apps,
    },
    { makeId },
  );
}

/**
 * The name of a backup file: `dashboard-<workspace id>-<YYYY-MM-DD>.json`. The date is the local
 * calendar date, passed in.
 * @param {{ workspaceId: string, date: string }} input
 * @returns {string}
 */
export function backupFileName({ workspaceId, date }) {
  return `${BACKUP_APP}-${workspaceId}-${date}.json`;
}
