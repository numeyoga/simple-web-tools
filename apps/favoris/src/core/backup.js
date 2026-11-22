/** @import { Group, Link, Skipped, WorkspaceData } from '../types.d.ts' */

// The JSON backup of a workspace: what goes into `data` of the export envelope of
// `@simple-web-tools/storage` (the envelope itself is built in `adapters/backup.js`), and the
// validation of what comes back, record by record. Also the file the old app exported,
// `{ space, tags, links }` with no version, which an import accepts. Pure.
//
// Schema version 1: `{ groups: Group[], links: Link[] }`.

import { cleanData } from './model.js';

/** App, format and version written in the envelope. Bump the version with a migration. */
export const BACKUP_APP = 'favoris';
export const BACKUP_FORMAT = 'favoris-workspace';
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

/**
 * The `data` of a backup.
 * @param {{ groups: readonly Group[], links: readonly Link[] }} input
 * @returns {WorkspaceData}
 */
export function buildBackupData({ groups, links }) {
  return { groups: [...groups], links: [...links] };
}

/**
 * Validates the `data` of a backup and returns it cleaned, with what was left out. Records that
 * cannot be used are skipped, not fatal.
 * @param {unknown} raw
 * @param {() => string} makeId gives an id to a record that has none
 * @returns {{ data: WorkspaceData, skipped: Skipped }}
 * @throws {BackupError} `invalid-data` when `data` is not an object with a `groups` list and a
 *   `links` list
 */
export function validateBackupData(raw, makeId) {
  if (!raw || typeof raw !== 'object') {
    throw new BackupError('invalid-data', 'The backup has no data.');
  }
  const { groups, links } = /** @type {Record<string, unknown>} */ (raw);
  if (!Array.isArray(groups) || !Array.isArray(links)) {
    throw new BackupError('invalid-data', 'The backup needs a list of groups and a list of links.');
  }
  return cleanData({ groups, links }, { makeId });
}

/* ------------------------------------------------------------------ */
/* The old app's data: `{ tags, links }` */

/**
 * Whether a parsed JSON value is what the old app exported: an object with a list of `tags` and
 * a list of `links` and no envelope.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyExport(value) {
  if (!value || typeof value !== 'object') return false;
  const { tags, links, app, format } = /** @type {Record<string, unknown>} */ (value);
  return Array.isArray(tags) && Array.isArray(links) && app === undefined && format === undefined;
}

/**
 * The records of the old app's data (`{ tags, links }`), as `cleanData` reads them: a tag is a
 * group (its hex `color` becomes a category), the `tag` of a link is its group. A link that
 * names a tag the file does not define gets a group made from that name, as the old app showed
 * one; an empty `tag` is a link with no group.
 * @param {{ tags?: unknown, links?: unknown }} legacy
 * @returns {{ groups: unknown[], links: unknown[] }}
 */
export function legacyRecords(legacy) {
  const tags = Array.isArray(legacy.tags) ? legacy.tags : [];
  const oldLinks = Array.isArray(legacy.links) ? legacy.links : [];
  /** @type {unknown[]} */
  const groups = tags.map((tag) =>
    tag && typeof tag === 'object'
      ? {
          id: /** @type {Record<string, unknown>} */ (tag).id,
          label: /** @type {Record<string, unknown>} */ (tag).label,
          color: /** @type {Record<string, unknown>} */ (tag).color,
          featured: /** @type {Record<string, unknown>} */ (tag).featured,
          collapsed: /** @type {Record<string, unknown>} */ (tag).collapsed,
        }
      : tag,
  );
  const known = new Set(
    groups.flatMap((g) => {
      const id = /** @type {Record<string, unknown> | null} */ (g)?.id;
      return typeof id === 'string' ? [id] : [];
    }),
  );
  const links = oldLinks.map((link) => {
    if (!link || typeof link !== 'object') return link;
    const { id, name, url, tag } = /** @type {Record<string, unknown>} */ (link);
    if (typeof tag === 'string' && tag !== '' && !known.has(tag)) {
      known.add(tag);
      groups.push({ id: tag, label: tag });
    }
    return { id, name, url, groupId: typeof tag === 'string' && tag !== '' ? tag : null };
  });
  return { groups, links };
}

/**
 * Reads the old app's data (`{ tags, links }`) as workspace data.
 * @param {{ tags?: unknown, links?: unknown }} legacy
 * @param {() => string} makeId
 * @returns {{ data: WorkspaceData, skipped: Skipped }}
 */
export function readLegacyData(legacy, makeId) {
  return cleanData(legacyRecords(legacy), { makeId });
}

/**
 * The name of a backup file: `favoris-<workspace id>-<YYYY-MM-DD>.json`. The date is the local
 * calendar date, passed in.
 * @param {{ workspaceId: string, date: string }} input
 * @returns {string}
 */
export function backupFileName({ workspaceId, date }) {
  return `${BACKUP_APP}-${workspaceId}-${date}.json`;
}
