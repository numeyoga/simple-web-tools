/** @import { AssetMeta, BackupAsset, BackupSkipped, Folder, Note } from '../types.d.ts' */

// JSON backup of a workspace, on the envelope of @simple-web-tools/storage (`createExportEnvelope`,
// `parseExport`): format `transient-notes-workspace`, version 1. The pictures travel inside the
// file as base64 text, so a restored backup shows its images. The rules that check and clean the
// content are in `core/backup.js`; this module converts the Blobs and wraps the envelope.

import { createExportEnvelope, parseExport, serializeExport } from '@simple-web-tools/storage';
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  buildBackupData,
  validateBackupData,
} from '../core/backup.js';

/**
 * @typedef {object} WorkspaceContent
 * @property {readonly Folder[]} folders
 * @property {readonly Note[]} notes
 * @property {readonly { meta: AssetMeta, blob: Blob }[]} assets
 */

/** Bytes of a picture, as base64 text (no `data:` prefix). @param {Blob} blob */
export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // In chunks: `String.fromCharCode(...bytes)` overflows the stack on a large picture.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * @param {string} data base64 text
 * @param {string} mime
 * @returns {Blob}
 */
export function base64ToBlob(data, mime) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * The backup file of a workspace.
 * @param {WorkspaceContent} content
 * @param {string} exportedAt ISO 8601 timestamp of the export
 * @returns {Promise<import('@simple-web-tools/storage').ExportEnvelope>}
 */
export async function buildBackup({ folders, notes, assets }, exportedAt) {
  /** @type {BackupAsset[]} */
  const withData = await Promise.all(
    assets.map(async ({ meta, blob }) => ({ ...meta, data: await blobToBase64(blob) })),
  );
  return createExportEnvelope({
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: buildBackupData({ folders, notes, assets: withData }),
  });
}

/**
 * The text of a backup file.
 * @param {import('@simple-web-tools/storage').ExportEnvelope} envelope
 * @returns {string}
 */
export const serializeBackup = serializeExport;

/**
 * Reads and validates a backup file (JSON text or an already parsed value). Throws an
 * `ExportError` (the envelope: invalid JSON, another app, a newer version...) or a `BackupError`
 * (the content), both fit for `importErrorMessage`.
 * @param {string | unknown} input
 * @returns {WorkspaceContent & { skipped: BackupSkipped }}
 */
export function readBackup(input) {
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
  const { data } = parseExport(value, {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    upgrades: {},
  });
  const { data: valid, skipped } = validateBackupData(data);
  return {
    folders: valid.folders,
    notes: valid.notes,
    assets: valid.assets.map(({ data: base64, ...meta }) => ({
      meta,
      blob: base64ToBlob(base64, meta.mime),
    })),
    skipped,
  };
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
