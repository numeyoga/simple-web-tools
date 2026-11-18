/**
 * @typedef {FileSystemDirectoryHandle & {
 *   requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
 * }} ExportDirectoryHandle
 */

const META_KEY = 'exportDirectory';
/** @type {ExportDirectoryHandle | null} */
let directory = null;
/** @type {import('idb').IDBPDatabase | null} */
let database = null;

export function supportsExportDirectory() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof (/** @type {{ showDirectoryPicker?: unknown }} */ (window).showDirectoryPicker) ===
      'function'
  );
}

/** Restore the handle without prompting for disk access at startup.
 * @param {import('idb').IDBPDatabase} db
 */
export async function initializeExportDirectory(db) {
  database = db;
  directory = null;
  if (!supportsExportDirectory()) return;
  try {
    const row = await db.get('meta', META_KEY);
    if (row?.value?.kind === 'directory') directory = row.value;
  } catch {
    // A storage policy must not prevent the rest of the application from opening.
  }
}

export function getExportDirectoryName() {
  return directory?.name ?? null;
}

/** Must be invoked directly from a user gesture. */
export async function chooseExportDirectory() {
  if (!supportsExportDirectory())
    throw new Error('La sauvegarde dans un dossier est indisponible.');
  const picker =
    /** @type {{ showDirectoryPicker: (options: unknown) => Promise<ExportDirectoryHandle> }} */ (
      /** @type {unknown} */ (window)
    );
  const selected = await picker.showDirectoryPicker({ id: 'locavern-exports', mode: 'readwrite' });
  directory = selected;
  try {
    if (!database) throw new Error('Stockage indisponible');
    await database.put('meta', { key: META_KEY, value: selected });
    return { remembered: true };
  } catch {
    return { remembered: false };
  }
}

export async function forgetExportDirectory() {
  // Clear persisted access before reporting that the choice has been forgotten.
  if (database) await database.delete('meta', META_KEY);
  directory = null;
}

/** Call before asynchronous export generation, while user activation is available. */
export async function ensureExportDirectoryPermission() {
  const selected = directory;
  if (!selected) return;
  const permission = await selected.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    throw new DOMException(
      'Autorisez l’accès au dossier ou retirez ce dossier dans Sauvegardes.',
      'NotAllowedError',
    );
  }
}

/** @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<boolean>} false when no directory is configured.
 */
export async function saveBlobToExportDirectory(blob, filename) {
  const selected = directory;
  if (!selected) return false;
  if (
    !filename.trim() ||
    filename === '.' ||
    filename === '..' ||
    /[\\/]/u.test(filename) ||
    Array.from(filename).some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new TypeError('Nom de fichier invalide.');
  }
  await ensureExportDirectoryPermission();
  const handle = await selected.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch {
      /* Preserve the original write error. */
    }
    throw error;
  }
  return true;
}
