// Copies the Covenant files from the skill's assets, the single source of truth, into
// `src/`. Run it with `npm run sync -w @simple-web-tools/covenant` after the skill changes.
// `--check` only compares and exits with 1 on a difference.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const SOURCE_DIR = resolve(here, '../../../.claude/skills/covenant-design-system/assets');
export const TARGET_DIR = resolve(here, '../src');

/** Files copied one to one. `fonts/` and `phosphor/` are not copied: see `src/fonts.js`. */
export const FILES = ['covenant-tokens.css', 'covenant.css', 'covenant.js'];
/** Folders copied one to one (every file in them). */
export const FOLDERS = ['logos'];

/**
 * The documented differences from the skill: path (relative to the assets folder) to a
 * function that turns the skill's content into the package's. Every entry needs a paragraph in
 * the README ("Differences from the skill"). There is none today: the skill's files bundle as
 * they are.
 * @type {Record<string, (content: Buffer) => Buffer>}
 */
export const TRANSFORMS = {};

/**
 * Every relative path the package must hold, with the content the skill implies.
 * @param {string} [sourceDir]
 * @returns {Map<string, Buffer>}
 */
export function expectedFiles(sourceDir = SOURCE_DIR) {
  /** @type {string[]} */
  const paths = [...FILES];
  for (const folder of FOLDERS) {
    for (const name of readdirSync(join(sourceDir, folder)).sort()) paths.push(`${folder}/${name}`);
  }
  return new Map(
    paths.map((path) => {
      const content = readFileSync(join(sourceDir, path));
      const transform = TRANSFORMS[path];
      return [path, transform ? transform(content) : content];
    }),
  );
}

/**
 * Compares `targetDir` with the expected files.
 * @param {string} [sourceDir]
 * @param {string} [targetDir]
 * @returns {string[]} one message per missing, different or extra file
 */
export function findDifferences(sourceDir = SOURCE_DIR, targetDir = TARGET_DIR) {
  const expected = expectedFiles(sourceDir);
  /** @type {string[]} */
  const problems = [];
  for (const [path, content] of expected) {
    const file = join(targetDir, path);
    if (!existsSync(file)) problems.push(`missing: ${path}`);
    else if (!readFileSync(file).equals(content)) problems.push(`differs: ${path}`);
  }
  for (const folder of FOLDERS) {
    const dir = join(targetDir, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!expected.has(`${folder}/${name}`)) problems.push(`extra: ${folder}/${name}`);
    }
  }
  return problems;
}

/**
 * Replaces the copied files in `targetDir` with the skill's.
 * @param {string} [sourceDir]
 * @param {string} [targetDir]
 * @returns {string[]} the relative paths written
 */
export function sync(sourceDir = SOURCE_DIR, targetDir = TARGET_DIR) {
  const expected = expectedFiles(sourceDir);
  for (const folder of FOLDERS) rmSync(join(targetDir, folder), { recursive: true, force: true });
  for (const [path, content] of expected) {
    const file = join(targetDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return [...expected.keys()];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const problems = findDifferences();
    for (const problem of problems) console.error(problem);
    process.exitCode = problems.length > 0 ? 1 : 0;
  } else {
    const written = sync();
    // eslint-disable-next-line no-console -- the script reports what it did
    console.log(`Copied ${written.length} files from ${SOURCE_DIR}`);
  }
}
