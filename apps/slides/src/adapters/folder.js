// Reading a presentation: the files of a chosen or dropped folder in, a presentation and the object
// URLs of its images out. The files stay on the machine: `slides.md` is read as text, and each image
// becomes a `blob:` URL (no copy, no base64) that is revoked when the presentation is closed or
// replaced, and when the page goes away.
import { MAX_SOURCE_BYTES, planFolder } from '../core/folder.js';
import { PresentationError } from '../core/errors.js';
import { parsePresentation } from '../core/parser.js';

/**
 * @typedef {{ file: File, path: string }} FolderFile
 *   `path` is the browser's path: `<folder name>/slides.md`, `<folder name>/assets/logo.png`
 */

/**
 * The files of the `<input webkitdirectory>` that was just chosen.
 * @param {FileList} files
 * @returns {FolderFile[]}
 */
export function fromInput(files) {
  return Array.from(files, (file) => ({ file, path: file.webkitRelativePath || file.name }));
}

/** Folders that never hold a presentation's files and can hold thousands. */
const SKIPPED_FOLDERS = new Set(['node_modules', '.git']);
/** A dropped folder with more files than this is not a presentation. */
const MAX_DROPPED_FILES = 5000;

/** @param {FileSystemFileEntry} entry @returns {Promise<File>} */
const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject));

/** @param {FileSystemDirectoryEntry} entry @returns {Promise<FileSystemEntry[]>} */
async function childrenOf(entry) {
  const reader = entry.createReader();
  /** @type {FileSystemEntry[]} */
  const all = [];
  // `readEntries` hands over a batch (100 at most) and returns an empty one at the end.
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!Array.isArray(batch) || batch.length === 0) return all;
    all.push(...batch);
  }
}

/**
 * The files of a dropped folder. The entries of the drop must be taken synchronously, inside the
 * event handler, before anything is awaited: the browser forgets them afterwards.
 * @param {DataTransfer} dataTransfer
 * @returns {Promise<FolderFile[]>} empty when the drop holds no folder
 */
export async function fromDrop(dataTransfer) {
  const roots = [...dataTransfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry) => entry?.isDirectory);
  const [root] = roots;
  if (!root || roots.length !== 1) return [];

  /** @type {FolderFile[]} */
  const found = [];
  /** @param {FileSystemEntry} entry @param {string} base */
  async function walk(entry, base) {
    if (found.length > MAX_DROPPED_FILES) return;
    const path = `${base}${entry.name}`;
    if (entry.isFile) {
      found.push({ file: await fileOf(/** @type {FileSystemFileEntry} */ (entry)), path });
    } else if (entry.isDirectory && !SKIPPED_FOLDERS.has(entry.name)) {
      for (const child of await childrenOf(/** @type {FileSystemDirectoryEntry} */ (entry))) {
        await walk(child, `${path}/`);
      }
    }
  }
  await walk(/** @type {FileSystemEntry} */ (root), '');
  return found;
}

/**
 * Reads `slides.md`, parses it and makes the object URLs of the images.
 * @param {readonly FolderFile[]} files
 * @returns {Promise<{ presentation: import('../core/parser.js').Presentation, assets: Record<string, string> }>}
 * @throws {PresentationError}
 */
export async function loadPresentation(files) {
  const { mainIndex, assets } = planFolder(files.map(({ path }) => path));
  const main = /** @type {FolderFile} */ (files[mainIndex]).file;
  if (main.size > MAX_SOURCE_BYTES) throw new PresentationError('source-too-large');

  /** @type {string} */
  let source;
  try {
    source = await main.text();
  } catch (error) {
    throw new PresentationError('unreadable', error instanceof Error ? error.message : '');
  }
  const presentation = parsePresentation(source);

  /** @type {Record<string, string>} */
  const urls = {};
  for (const { index, path, type } of assets) {
    const { file } = /** @type {FolderFile} */ (files[index]);
    urls[path] = URL.createObjectURL(new Blob([file], { type }));
  }
  return { presentation, assets: urls };
}

/** @param {Iterable<string>} urls */
export function revokeAssets(urls) {
  for (const url of urls) URL.revokeObjectURL(url);
}

/**
 * Why a load failed, as the store records it: a presentation error keeps its code, anything else
 * (the browser refused to read a file) is `unreadable`.
 * @param {unknown} error
 * @returns {import('../core/store.js').LoadFailure}
 */
export function failureOf(error) {
  if (error instanceof PresentationError) return { code: error.code, detail: error.detail };
  return { code: 'unreadable', detail: error instanceof Error ? error.message : '' };
}
