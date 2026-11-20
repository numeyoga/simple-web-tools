// JSON export and import of a workspace, on the envelope of @simple-web-tools/storage.
// Export: `createExportEnvelope` (format `chrono-workspace`, version 3). Import: `parseExport`
// with the upgrades 1 to 2 and 2 to 3, chained, after wrapping the legacy files (which are not
// envelopes).

import { createTranslator } from '@simple-web-tools/i18n';
import { createExportEnvelope, parseExport } from '@simple-web-tools/storage';
import {
  EXPORT_APP,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  ImportError,
  isLegacyExport,
  toExportData,
  validateImport,
  wrapLegacyExport,
} from '../core/import-export.js';
import { v1ToV2, v2ToV3 } from '../core/migrations.js';
import { catalogs } from '../i18n/index.js';

const frenchText = createTranslator({ locale: 'fr', catalogs }).t;

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
 * `newer-version`), or an `ImportError` (French message, `code` for the interface) when the content is unusable.
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
    throw new ImportError('invalid-json', 'JSON invalide');
  }
  return validateImport(data, now);
}

/**
 * Message of an import failure for the toast, in the language of `t` (French by default).
 * @param {unknown} error
 * @param {(key: string) => string} [t] the translator of the interface
 * @returns {string}
 */
export function importErrorMessage(error, t = frenchText) {
  const code = /** @type {{ code?: string } | null} */ (error)?.code;
  switch (code) {
    case 'invalid-json':
      return t('importErrors.invalidJson');
    case 'not-an-envelope':
    case 'invalid-version':
    case 'wrong-format':
    case 'invalid-format':
      return t('importErrors.invalidFormat');
    case 'no-valid-data':
      return t('importErrors.noValidData');
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
