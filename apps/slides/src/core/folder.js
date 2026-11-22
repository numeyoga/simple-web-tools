// Which files of the chosen folder matter. The browser hands over the files of a folder with
// paths of the form `<folder name>/slides.md` and `<folder name>/assets/logo.png`; the first
// segment is the name the person gave the folder, so it is cut off and the rest is the path the
// Markdown uses (`assets/logo.png`). Pure: the caller reads the files.
import { PresentationError } from './errors.js';

/** The file that holds the slides, at the root of the folder. */
export const MAIN_FILE = 'slides.md';

/** The largest `slides.md` that is read, in bytes: a text file of this size is already far beyond a talk. */
export const MAX_SOURCE_BYTES = 5_000_000;

/** The images a presentation can use, by extension. SVG is shown through `<img>`, so it cannot run script. */
export const IMAGE_TYPES = Object.freeze(
  /** @type {Record<string, string>} */ ({
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  }),
);

/**
 * The path of a file inside the chosen folder: the browser's path without its first segment. A file
 * with no folder in its path (a browser that gives no relative path) keeps its name.
 * @param {string} browserPath
 * @returns {string}
 */
export function pathInFolder(browserPath) {
  const parts = browserPath.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : browserPath;
}

/**
 * The image type of a path, `null` when it is not an image the app uses.
 * @param {string} path
 * @returns {string | null}
 */
export function imageTypeOf(path) {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return null;
  return IMAGE_TYPES[path.slice(dot).toLowerCase()] ?? null;
}

/**
 * @typedef {{ index: number, path: string, type: string }} FolderAsset
 *   `index` is the position of the file in the list given to `planFolder`
 */

/**
 * Finds `slides.md` and the images in a list of browser paths.
 * @param {readonly string[]} browserPaths
 * @returns {{ mainIndex: number, assets: FolderAsset[] }}
 * @throws {PresentationError} `no-main-file` when the root of the folder has no `slides.md`
 */
export function planFolder(browserPaths) {
  let mainIndex = -1;
  /** @type {FolderAsset[]} */
  const assets = [];
  browserPaths.forEach((browserPath, index) => {
    const path = pathInFolder(browserPath);
    if (path === MAIN_FILE) mainIndex = index;
    const type = imageTypeOf(path);
    if (type) assets.push({ index, path, type });
  });
  if (mainIndex < 0) throw new PresentationError('no-main-file');
  return { mainIndex, assets };
}
