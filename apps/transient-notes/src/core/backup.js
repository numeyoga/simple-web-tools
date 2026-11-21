/** @import { BackupAsset, BackupData, BackupSkipped, Folder, Note, RichTextDoc } from '../types.d.ts' */
/** @import { RichTextNode } from '@simple-web-tools/rich-text' */

// The JSON backup of a workspace: what goes into `data` of the export envelope of
// `@simple-web-tools/storage` (the envelope itself is built in `adapters/backup.js`), and the
// validation of what comes back. Pure: pictures are base64 text here, the adapter converts
// them from and to Blobs.
//
// Schema version 1: `{ folders: Folder[], notes: Note[], assets: (AssetMeta & { data })[] }`.
// A backup holds the assets that a note references and no others.

import { sanitizeRichTextDoc } from '@simple-web-tools/rich-text';
import {
  EPOCH,
  referencedAssetIds,
  sanitizeAssetMeta,
  sanitizeFolder,
  sanitizeNote,
  uniqueById,
} from './model.js';

/** App, format and version written in the envelope. Bump the version with a migration. */
export const BACKUP_APP = 'transient-notes';
export const BACKUP_FORMAT = 'transient-notes-workspace';
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

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Number of bytes a base64 text decodes to, or `null` when the text is not valid base64
 * (padded, no whitespace).
 * @param {unknown} data
 * @returns {number | null}
 */
export function base64ByteLength(data) {
  if (typeof data !== 'string' || data.length === 0 || data.length % 4 !== 0) return null;
  if (!BASE64.test(data)) return null;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

/**
 * The `data` of a backup: folders, notes, and the assets the notes reference.
 * @param {{ folders: readonly Folder[], notes: readonly Note[], assets: readonly BackupAsset[] }} input
 *   `assets` carry their picture as base64 `data`
 * @returns {BackupData}
 */
export function buildBackupData({ folders, notes, assets }) {
  const used = referencedAssetIds(notes);
  return {
    folders: [...folders],
    notes: [...notes],
    assets: assets.filter((asset) => used.has(asset.id)),
  };
}

/**
 * @param {RichTextNode} node
 * @param {ReadonlySet<string>} known
 * @returns {RichTextNode | null} the node without the pictures that are not in the backup
 */
function dropUnknownImages(node, known) {
  if (node.type === 'localImage') {
    const assetId = node.attrs?.assetId;
    return typeof assetId === 'string' && known.has(assetId) ? node : null;
  }
  if (!node.content) return node;
  const content = node.content
    .map((child) => dropUnknownImages(child, known))
    .filter((child) => child !== null);
  return { ...node, content };
}

/**
 * A document without the pictures that the backup does not carry (a broken image would be all
 * that is left of them).
 * @param {RichTextDoc} doc
 * @param {ReadonlySet<string>} known
 * @returns {RichTextDoc}
 */
function withoutUnknownImages(doc, known) {
  const cleaned = dropUnknownImages(/** @type {RichTextNode} */ (doc), known);
  return sanitizeRichTextDoc(cleaned);
}

/**
 * Validates the `data` of a backup and returns it cleaned, with what was left out. Records that
 * cannot be used are skipped, not fatal: a duplicate id, a folder with an unknown category, an
 * asset that is not a valid base64 picture of an allowed type. A note whose folder is missing is
 * left with no folder, and a picture that the backup does not carry is removed from its note.
 * @param {unknown} raw
 * @returns {{ data: BackupData, skipped: BackupSkipped }}
 * @throws {BackupError} `invalid-data` when `data` is not an object with a `folders` list and a
 *   `notes` list
 */
export function validateBackupData(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new BackupError('invalid-data', 'The backup has no data.');
  }
  const {
    folders: rawFolders,
    notes: rawNotes,
    assets: rawAssets,
  } = /** @type {Record<string, unknown>} */ (raw);
  if (!Array.isArray(rawFolders) || !Array.isArray(rawNotes)) {
    throw new BackupError(
      'invalid-data',
      'The backup needs a list of folders and a list of notes.',
    );
  }
  if (rawAssets !== undefined && !Array.isArray(rawAssets)) {
    throw new BackupError('invalid-data', 'The assets of the backup must be a list.');
  }
  const assetRecords = /** @type {unknown[]} */ (rawAssets ?? []);

  const folders = uniqueById(rawFolders.map((f) => sanitizeFolder(f, EPOCH)));
  const folderIds = new Set(folders.map((f) => f.id));

  /** @type {BackupAsset[]} */
  const assets = [];
  for (const record of assetRecords) {
    const meta = sanitizeAssetMeta(record, EPOCH);
    const data = /** @type {{ data?: unknown } | null} */ (record)?.data;
    const size = base64ByteLength(data);
    if (!meta || size === null) continue;
    // The size of the picture is what the data says, whatever the file claims.
    assets.push({ ...meta, size, data: /** @type {string} */ (data) });
  }
  const uniqueAssets = uniqueById(assets);
  const knownAssets = new Set(uniqueAssets.map((a) => a.id));

  const notes = uniqueById(rawNotes.map((n) => sanitizeNote(n, EPOCH))).map((note) => {
    const folderId = note.folderId !== null && folderIds.has(note.folderId) ? note.folderId : null;
    return { ...note, folderId, doc: withoutUnknownImages(note.doc, knownAssets) };
  });

  return {
    data: { folders, notes, assets: uniqueAssets },
    skipped: {
      folders: rawFolders.length - folders.length,
      notes: rawNotes.length - notes.length,
      assets: assetRecords.length - uniqueAssets.length,
    },
  };
}
