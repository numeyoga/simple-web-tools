/** @import { Skipped, WorkspaceData } from '../types.d.ts' */

// JSON backup of a workspace, on the envelope of @simple-web-tools/storage (`createExportEnvelope`,
// `parseExport`): format `dashboard-workspace`, version 1. The rules that check and clean the
// content are in `core/backup.js`; this module wraps the envelope. An import also accepts the
// file the previous version of the app exported, `{ space, tags, links }`, which has no envelope.

import { parseExport, serializeExport } from '@simple-web-tools/storage';
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  legacyDashboard,
  readLegacyData,
  validateBackupData,
} from '../core/backup.js';
import { newId } from './ids.js';

/**
 * The text of a backup file.
 * @param {import('@simple-web-tools/storage').ExportEnvelope} envelope
 * @returns {string}
 */
export const serializeBackup = serializeExport;

/**
 * Reads and validates a file (JSON text or an already parsed value), record by record. Throws an
 * `ExportError` (the envelope: invalid JSON, another app, a newer version...) or a `BackupError`
 * (the content), both fit for `importErrorMessage`.
 * @param {string | unknown} input
 * @param {() => string} [makeId] gives an id to a record that has none (default: a new UUID)
 * @returns {{ data: WorkspaceData, skipped: Skipped, legacy: boolean }}
 */
export function readBackup(input, makeId = newId) {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
      // A JSON text that holds a string would be parsed a second time by parseExport.
      if (typeof value === 'string') value = null;
    } catch {
      // parseExport reports the invalid JSON with its own error code.
    }
  }
  const legacy = legacyDashboard(value);
  if (legacy) return { ...readLegacyData(legacy, makeId), legacy: true };
  const { data } = parseExport(value, {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    upgrades: {},
  });
  return { ...validateBackupData(data, makeId), legacy: false };
}

/**
 * Message of an import failure for a toast, in the language of `t`.
 * @param {unknown} error
 * @param {(key: string) => string} t the translator of the interface
 * @returns {string}
 */
export function importErrorMessage(error, t) {
  const code = /** @type {{ code?: string } | null} */ (error)?.code;
  if (error instanceof BackupError) return t('importErrors.invalidData');
  switch (code) {
    case 'invalid-json':
      return t('importErrors.invalidJson');
    case 'not-an-envelope':
    case 'invalid-version':
    case 'wrong-format':
      return t('importErrors.invalidFormat');
    case 'wrong-app':
      return t('importErrors.wrongApp');
    case 'newer-version':
      return t('importErrors.newerVersion');
    case 'unsupported-version':
    case 'upgrade-failed':
      return t('importErrors.cannotConvert');
    default:
      return error instanceof Error ? error.message : String(error);
  }
}
