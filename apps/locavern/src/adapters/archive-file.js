/** @import { AllowedImageMimeType, BackupData, BackupManifest } from '../types.d.ts' */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { validateArchiveContents } from '../core/backup.js';
import {
  decryptArchiveBytes,
  encryptArchiveBytes,
  parseEncryptionHeader,
} from '../core/crypto-archive.js';
import { ALLOWED_IMAGE_MIMES } from '../core/model.js';
import { MAX_ARCHIVE_BYTES, MAX_ASSET_BYTES } from '../core/schema.js';
import { saveBlobToExportDirectory } from './export-directory.js';

/**
 * Create a ZIP archive Blob containing manifest.json, data.json and assets/*.
 * When `password` is provided, encrypts the ZIP payload with AES-GCM + PBKDF2.
 * @param {{
 *   manifest: BackupManifest;
 *   data: BackupData;
 *   assetBlobs: ReadonlyMap<string, Blob>;
 *   password?: string;
 * }} input
 * @returns {Promise<Blob>}
 */
export async function buildArchiveZipBlob({ manifest, data, assetBlobs, password }) {
  /** @type {Record<string, Uint8Array>} */
  const files = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'data.json': strToU8(JSON.stringify(data, null, 2)),
  };

  for (const meta of data.assets) {
    const blob = assetBlobs.get(meta.id);
    if (blob) {
      const buf = await blob.arrayBuffer();
      files[`assets/${meta.id}`] = new Uint8Array(buf);
    }
  }

  const zipped = zipSync(files, { level: 6 });

  if (typeof password === 'string' && password.length > 0) {
    const { header, ciphertext } = await encryptArchiveBytes(zipped, password);
    const outerZip = zipSync(
      {
        'encryption.json': strToU8(JSON.stringify(header, null, 2)),
        'payload.enc': ciphertext,
      },
      { level: 0 },
    );
    const encryptedCopy = new Uint8Array(outerZip.byteLength);
    encryptedCopy.set(outerZip);
    return new Blob([encryptedCopy.buffer], { type: 'application/zip' });
  }

  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy.buffer], { type: 'application/zip' });
}

/**
 * Trigger a browser download for an archive Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerArchiveDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @typedef {{
 *   createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
 * }} SaveFileHandleLike
 */

/**
 * Resolve window.showSaveFilePicker when natively usable.
 * Headless Chromium exposes the API on localhost yet auto-aborts without a UI,
 * so skip only the unmocked native stub under HeadlessChrome while keeping explicit mocks active.
 * @returns {((options?: unknown) => Promise<SaveFileHandleLike>) | null}
 */
function resolveWindowSavePicker() {
  if (typeof window === 'undefined') return null;
  const candidate = /** @type {{ showSaveFilePicker?: unknown }} */ (window).showSaveFilePicker;
  if (typeof candidate !== 'function') return null;

  const isHeadlessChrome =
    typeof navigator !== 'undefined' && navigator.userAgent.includes('HeadlessChrome');
  if (isHeadlessChrome) {
    try {
      if (Function.prototype.toString.call(candidate).includes('[native code]')) {
        return null;
      }
    } catch {
      return null;
    }
  }

  return /** @type {{ showSaveFilePicker: (options?: unknown) => Promise<SaveFileHandleLike> }} */ (
    /** @type {unknown} */ (window)
  ).showSaveFilePicker.bind(window);
}

/**
 * Save a Blob via File System Access API (showSaveFilePicker) when available,
 * falling back to standard anchor download when unsupported or blocked.
 * Respects user cancellation (AbortError) without triggering a fallback download.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {{
 *   showSaveFilePicker?: (options?: unknown) => Promise<SaveFileHandleLike>;
 *   fallbackDownload?: (blob: Blob, filename: string) => void;
 *   pickerTypes?: Array<{ description: string; accept: Record<string, string[]> }>;
 * }} [deps]
 * @returns {Promise<{ saved: true; method: 'directory' | 'picker' | 'download' } | { saved: false; cancelled: true }>}
 */
export async function saveArchiveBlob(blob, filename, deps = {}) {
  if (await saveBlobToExportDirectory(blob, filename)) {
    return { saved: true, method: 'directory' };
  }
  const picker = deps.showSaveFilePicker ?? resolveWindowSavePicker();
  const downloadFn = deps.fallbackDownload ?? triggerArchiveDownload;
  const types = deps.pickerTypes ?? [
    {
      description: 'Archive Locavern (ZIP)',
      accept: { 'application/zip': ['.zip'] },
    },
  ];

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, method: 'picker' };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        return { saved: false, cancelled: true };
      }
      if (
        name === 'SecurityError' ||
        name === 'NotAllowedError' ||
        name === 'NotSupportedError' ||
        name === 'TypeError'
      ) {
        downloadFn(blob, filename);
        return { saved: true, method: 'download' };
      }
      throw err;
    }
  }

  downloadFn(blob, filename);
  return { saved: true, method: 'download' };
}

/**
 * Read, extract and validate a backup ZIP archive from a Blob or File (optionally password-protected).
 * @param {Blob} file
 * @param {{ password?: string }} [options]
 * @returns {Promise<
 *   | { ok: true; manifest: BackupManifest; data: BackupData; blobs: Map<string, Blob>; encrypted: boolean }
 *   | { ok: false; error: string; needsPassword?: boolean; wrongPassword?: boolean }
 * >}
 */
export async function parseArchiveFile(file, options = {}) {
  if (file.size === 0) {
    return { ok: false, error: 'Impossible d’importer l’archive. Le fichier est vide.' };
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return {
      ok: false,
      error: 'Impossible d’importer l’archive. Le fichier dépasse la limite de 25 Mio.',
    };
  }

  /** @type {Record<string, Uint8Array>} */
  let entries;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    entries = unzipSync(bytes);
  } catch {
    return {
      ok: false,
      error: 'Impossible d’ouvrir l’archive. Le fichier ZIP est corrompu ou invalide.',
    };
  }

  let encrypted = false;
  const encryptionMetaBytes = entries['encryption.json'];
  if (encryptionMetaBytes) {
    /** @type {unknown} */
    let rawHeader;
    try {
      rawHeader = JSON.parse(strFromU8(encryptionMetaBytes));
    } catch {
      return {
        ok: false,
        error: 'Métadonnées de chiffrement illisibles dans l’archive.',
      };
    }
    const headerCheck = parseEncryptionHeader(rawHeader);
    if (!headerCheck.ok) {
      return headerCheck;
    }
    const ciphertextBytes = entries['payload.enc'];
    if (!ciphertextBytes || ciphertextBytes.byteLength < 16) {
      return {
        ok: false,
        error: 'Archive chiffrée incomplète. Le fichier payload.enc est manquant.',
      };
    }
    if (typeof options.password !== 'string' || options.password.length === 0) {
      return {
        ok: false,
        needsPassword: true,
        error: 'Cette archive est protégée par mot de passe.',
      };
    }

    const decrypted = await decryptArchiveBytes(rawHeader, ciphertextBytes, options.password);
    if (!decrypted.ok) {
      return {
        ok: false,
        needsPassword: Boolean(decrypted.wrongPassword),
        ...(decrypted.wrongPassword ? { wrongPassword: true } : {}),
        error: decrypted.error,
      };
    }

    if (decrypted.plaintextZipBytes.byteLength > MAX_ARCHIVE_BYTES) {
      return {
        ok: false,
        error: 'L’archive déchiffrée dépasse la limite autorisée de 25 Mio.',
      };
    }

    try {
      entries = unzipSync(decrypted.plaintextZipBytes);
    } catch {
      return {
        ok: false,
        error: 'Archive déchiffrée invalide ou corrompue.',
      };
    }
    encrypted = true;
  }

  const manifestBytes = entries['manifest.json'];
  const dataBytes = entries['data.json'];
  if (!manifestBytes || !dataBytes) {
    return {
      ok: false,
      error: 'Archive incomplète. Les fichiers manifest.json et data.json sont requis.',
    };
  }

  /** @type {unknown} */
  let rawManifest;
  /** @type {unknown} */
  let rawData;
  try {
    rawManifest = JSON.parse(strFromU8(manifestBytes));
    rawData = JSON.parse(strFromU8(dataBytes));
  } catch {
    return {
      ok: false,
      error: 'Impossible de lire les données. Le contenu JSON de l’archive est invalide.',
    };
  }

  /** @type {Map<string, Uint8Array>} */
  const binaryAssets = new Map();
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith('assets/') && bytes.byteLength > 0) {
      const id = path.slice('assets/'.length);
      if (id && !id.includes('/')) {
        binaryAssets.set(id, bytes);
      }
    }
  }

  const validated = validateArchiveContents(rawManifest, rawData, binaryAssets);
  if (!validated.ok) {
    return validated;
  }

  /** @type {Map<string, Blob>} */
  const blobs = new Map();
  for (const meta of validated.data.assets) {
    const bytes = binaryAssets.get(meta.id);
    if (bytes) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      blobs.set(meta.id, new Blob([copy.buffer], { type: meta.mimeType }));
    }
  }

  return {
    ok: true,
    manifest: /** @type {BackupManifest} */ (rawManifest),
    data: validated.data,
    blobs,
    encrypted,
  };
}

/**
 * Validate a user-selected or pasted image File before storing it locally.
 * @param {File} file
 * @returns {{ ok: true; mimeType: AllowedImageMimeType } | { ok: false; error: string }}
 */
export function validateImageFile(file) {
  const mimeType = /** @type {AllowedImageMimeType} */ (file.type);
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    return {
      ok: false,
      error: 'Format d’image non pris en charge. Utilisez PNG, JPEG, WebP ou GIF.',
    };
  }
  if (file.size === 0 || file.size > MAX_ASSET_BYTES) {
    return {
      ok: false,
      error: 'L’image doit être non vide et ne pas dépasser 5 Mio.',
    };
  }
  return { ok: true, mimeType };
}
