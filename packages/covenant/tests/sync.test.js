import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FILES,
  FOLDERS,
  SOURCE_DIR,
  TARGET_DIR,
  TRANSFORMS,
  expectedFiles,
  findDifferences,
  sync,
} from '../scripts/sync.mjs';

/** @type {string[]} */
const tmpDirs = [];

/** @returns {string} */
function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), 'covenant-sync-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the package files against the skill assets', () => {
  it('match the skill byte for byte, except the documented differences', () => {
    // If this fails, run: npm run sync -w @simple-web-tools/covenant
    // (or, if the package must change on purpose, document it: see TRANSFORMS in scripts/sync.mjs).
    expect(findDifferences()).toEqual([]);
  });

  it('cover the tokens, the components, the behaviours and every logo', () => {
    const paths = [...expectedFiles().keys()];
    expect(paths).toEqual(expect.arrayContaining([...FILES]));
    expect(paths.filter((path) => path.startsWith('logos/')).length).toBeGreaterThanOrEqual(3);
    expect(FOLDERS).toEqual(['logos']);
  });

  it('document every difference in the README', () => {
    const readme = readFileSync(join(TARGET_DIR, '../README.md'), 'utf8');
    expect(readme).toContain('## Differences from the skill');
    for (const path of Object.keys(TRANSFORMS)) expect(readme).toContain(path);
  });
});

describe('the guard itself', () => {
  it('reports a changed, a missing and an extra file, then sync repairs them', () => {
    const target = makeTmpDir();
    sync(SOURCE_DIR, target);
    expect(findDifferences(SOURCE_DIR, target)).toEqual([]);

    writeFileSync(join(target, 'covenant.css'), '/* drifted */');
    rmSync(join(target, 'covenant.js'));
    writeFileSync(join(target, 'logos', 'stale.svg'), '<svg/>');
    expect(findDifferences(SOURCE_DIR, target)).toEqual([
      'differs: covenant.css',
      'missing: covenant.js',
      'extra: logos/stale.svg',
    ]);

    sync(SOURCE_DIR, target);
    expect(findDifferences(SOURCE_DIR, target)).toEqual([]);
  });
});
