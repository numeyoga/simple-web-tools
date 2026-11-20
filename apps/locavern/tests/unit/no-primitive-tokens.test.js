// Covenant rule: component CSS and markup use semantic tokens only. A primitive scale token
// (`--cv-neutral-*`, `--cv-accent-<n>`, `--cv-<status>-<n>`) does not follow the theme and has no
// role. The same search as the skill's checklist, over everything the app ships.
import { describe, expect, test } from 'vitest';

/** The command of the Covenant checklist, as a regular expression. */
const PRIMITIVE_TOKEN = /var\(--cv-(neutral|accent|success|warning|danger|info)-[0-9]+\)/g;

/**
 * The files are read from disk: Vitest hands CSS imported with `?raw` back empty. The Node types
 * are not a dependency of this repository, so the file system comes from the running process
 * (Node 26 or later, see the engines of the root package).
 * @type {{
 *   readdirSync: (dir: URL, options: { recursive: true }) => string[];
 *   readFileSync: (file: URL, encoding: 'utf8') => string;
 * }}
 */
const fs = /** @type {any} */ (globalThis).process.getBuiltinModule('node:fs');

const appRoot = new URL('../../', import.meta.url);

/** @returns {Record<string, string>} every CSS, JS and HTML file the application ships */
function readSources() {
  const files = fs
    .readdirSync(new URL('src/', appRoot), { recursive: true })
    .filter((name) => /\.(css|js|html)$/.test(name))
    .map((name) => `src/${name.replaceAll('\\', '/')}`);
  files.push('index.html');
  return Object.fromEntries(
    files.map((name) => [name, fs.readFileSync(new URL(name, appRoot), 'utf8')]),
  );
}

const sources = readSources();

/** @param {string} text */
const findPrimitives = (text) => [...text.matchAll(PRIMITIVE_TOKEN)].map((match) => match[0]);

describe('the guard against primitive Covenant tokens', () => {
  test('finds a primitive scale token and lets the semantic roles through', () => {
    expect(findPrimitives('color: var(--cv-accent-500);')).toEqual(['var(--cv-accent-500)']);
    expect(findPrimitives('border: 1px solid var(--cv-warning-600);')).toHaveLength(1);
    expect(findPrimitives('fill: var(--cv-neutral-0); stroke: var(--cv-info-100);')).toHaveLength(
      2,
    );
    expect(findPrimitives('color: var(--cv-danger-700)')).toHaveLength(1);
    expect(findPrimitives('color: var(--cv-fg-danger);')).toEqual([]);
    expect(findPrimitives('border-color: var(--cv-warning-border);')).toEqual([]);
    expect(findPrimitives('background: var(--cv-accent-fill);')).toEqual([]);
    expect(
      findPrimitives('stroke: var(--cv-brand-accent); --x: var(--lc-wb-accent-line);'),
    ).toEqual([]);
  });

  test('the files of the application are included in the search', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        'src/styles/app.css',
        'src/adapters/whiteboard-canvas.js',
        'src/main.js',
        'index.html',
      ]),
    );
    // A file read as empty would pass the search for nothing.
    expect(sources['src/styles/app.css']?.length).toBeGreaterThan(10_000);
  });

  test('no file of the application uses a primitive token', () => {
    /** @type {string[]} */
    const found = [];
    for (const [name, text] of Object.entries(sources)) {
      for (const token of findPrimitives(text)) found.push(`${name}: ${token}`);
    }
    expect(found).toEqual([]);
  });
});
