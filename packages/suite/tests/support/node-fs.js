// Node's `fs` without @types/node (the repository does not install it): same approach as
// the rich-text tests.

/**
 * @type {{
 *   readFileSync: (file: URL, encoding: 'utf8') => string,
 *   readdirSync: (dir: URL, options: { withFileTypes: true }) => { name: string, isDirectory: () => boolean }[],
 * }}
 */
export const fs = /** @type {any} */ (globalThis).process.getBuiltinModule('node:fs');

/** @param {string} relative Path relative to the package folder. */
export const fromPackage = (relative) => new URL(`../../${relative}`, import.meta.url);
