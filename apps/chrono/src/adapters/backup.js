// JSON export and import of a workspace, on the envelope of @simple-web-tools/storage.
// Export: `createExportEnvelope` (format `chrono-workspace`, version 3). Import: `parseExport`
// with the upgrades 1 to 2 and 2 to 3, chained, after wrapping the legacy files (which are not
// envelopes).

import { createExportEnvelope, parseExport } from '@simple-web-tools/storage';
import {
  EXPORT_APP,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  isLegacyExport,
  toExportData,
  validateImport,
  wrapLegacyExport,
} from '../core/import-export.js';
import { v1ToV2, v2ToV3 } from '../core/migrations.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */

/**
 * The export file of a workspace.
 * @param {ChronoData} data
 * @param {number} now export time
 * @returns {import('@simple-web-tools/storage').ExportEnvelope}
 */
export function buildExport(data, now) {
  return createExportEnvelope({
    app: EXPORT_APP,
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    data: toExportData(data),
  });
}

/**
 * Read an export file (JSON text or an already parsed value): version 3 and 2 envelopes and
 * the legacy version 1 files. Throws an `ExportError` (package codes such as `wrong-app` or
 * `newer-version`), or an `Error` with a French message when the content is unusable.
 * @param {string | unknown} input
 * @param {number} now
 * @param {{ strict?: boolean }} [options] `strict`: also require a `projects` or `sessions`
 *   list, as the import dialog does before asking for a confirmation
 * @returns {ChronoData}
 */
export function readExport(input, now, { strict = false } = {}) {
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
  if (isLegacyExport(value)) value = wrapLegacyExport(/** @type {object} */ (value), now);
  const { data } = parseExport(value, {
    app: EXPORT_APP,
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    upgrades: { 1: v1ToV2, 2: v2ToV3 },
  });
  const collections = /** @type {{ projects?: unknown, sessions?: unknown }} */ (data);
  if (strict && !Array.isArray(collections.projects) && !Array.isArray(collections.sessions)) {
    throw new Error('JSON invalide');
  }
  return validateImport(data, now);
}

/**
 * French message of an import failure, for the toast.
 * @param {unknown} error
 * @returns {string}
 */
export function importErrorMessage(error) {
  const code = /** @type {{ code?: string } | null} */ (error)?.code;
  switch (code) {
    case 'invalid-json':
      return 'JSON invalide';
    case 'not-an-envelope':
    case 'invalid-version':
    case 'wrong-format':
      return 'format invalide';
    case 'wrong-app':
      return 'Ce fichier n’a pas été exporté par Chrono.';
    case 'newer-version':
      return 'Ce fichier vient d’une version plus récente de Chrono. Mets l’application à jour puis réessaie.';
    case 'unsupported-version':
    case 'upgrade-failed':
      return 'Ce fichier ne peut pas être converti.';
    default:
      return error instanceof Error ? error.message : String(error);
  }
}
