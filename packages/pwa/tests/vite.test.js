// The Vite plugin, driven by hand against a temporary output folder: the hooks Vite calls, in the
// order it calls them, with the file system a build leaves behind.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIdOf, listFiles, pwaPlugin } from '../src/vite.js';

const CSP = "default-src 'none'; script-src 'self'";

/** @type {string} */
let root;

/** @param {string} path @param {string} content */
function put(path, content) {
  const file = join(root, 'dist', path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

/** Runs the hooks `closeBundle` depends on, as Vite does. @param {ReturnType<typeof pwaPlugin>} plugin */
function closeBundle(plugin) {
  const configResolved = /** @type {(config: unknown) => void} */ (plugin.configResolved);
  configResolved({ root, build: { outDir: 'dist' } });
  const hook = /** @type {() => void} */ (plugin.closeBundle);
  hook.call({});
}

/** @param {ReturnType<typeof pwaPlugin>} plugin @param {string} html */
function transformIndexHtml(plugin, html) {
  const hook = /** @type {(html: string) => string} */ (plugin.transformIndexHtml);
  return hook(html);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pwa-plugin-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('pwaPlugin', () => {
  it('is named after the app and only runs for a production build', () => {
    const plugin = pwaPlugin({ appId: 'chrono', csp: CSP });

    expect(plugin.name).toBe('chrono-csp-and-precache');
    expect(plugin.apply).toBe('build');
    expect(plugin.enforce).toBe('post');
  });

  it('adds the worker as a second entry, emitted as sw.js, with no hash and no folder', () => {
    const plugin = pwaPlugin({ appId: 'chrono', csp: CSP });
    const config = /** @type {() => any} */ (plugin.config)();
    const { input, output } = config.build.rollupOptions;

    expect(input).toEqual({ index: 'index.html', sw: 'src/sw/sw.js' });
    expect(output.entryFileNames({ name: 'sw' })).toBe('sw.js');
    expect(output.entryFileNames({ name: 'index' })).toBe('assets/[name]-[hash].js');
  });

  it('takes another worker source', () => {
    const plugin = pwaPlugin({ appId: 'x', csp: CSP, worker: 'src/worker.js' });
    const config = /** @type {() => any} */ (plugin.config)();

    expect(config.build.rollupOptions.input.sw).toBe('src/worker.js');
  });

  it('injects the policy right after the charset meta tag', () => {
    const plugin = pwaPlugin({ appId: 'chrono', csp: CSP });

    const html = transformIndexHtml(
      plugin,
      '<head>\n    <meta charset="utf-8" />\n    <title>x</title>',
    );

    expect(html).toBe(
      `<head>\n    <meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <title>x</title>`,
    );
  });

  it('writes the manifest and stamps the worker with the build id', () => {
    put('index.html', '<html></html>');
    put('assets/index-a1.js', 'console.log(1)');
    put('assets/index-a1.js.map', '{}');
    put('assets/Phosphor-AbC.woff', 'legacy');
    put('sw.js', "const CACHE = 'chrono-shell-__BUILD_ID__'; // __BUILD_ID__");
    const plugin = pwaPlugin({ appId: 'chrono', csp: CSP });

    closeBundle(plugin);

    const urls = ['./', './assets/index-a1.js', './index.html'];
    const manifest = readFileSync(join(root, 'dist', 'precache-manifest.json'), 'utf8');
    expect(manifest).toBe(`${JSON.stringify(urls, null, 2)}\n`);
    const buildId = buildIdOf(join(root, 'dist'), urls);
    expect(buildId).toMatch(/^[0-9a-f]{10}$/);
    expect(readFileSync(join(root, 'dist', 'sw.js'), 'utf8')).toBe(
      `const CACHE = 'chrono-shell-${buildId}'; // ${buildId}`,
    );
  });

  it('the build id changes with the content of a precached file, not with the worker', () => {
    put('index.html', 'one');
    put('sw.js', 'worker');
    const plugin = pwaPlugin({ appId: 'chrono', csp: CSP });
    closeBundle(plugin);
    const before = buildIdOf(join(root, 'dist'), ['./', './index.html']);

    put('sw.js', 'another worker');
    expect(buildIdOf(join(root, 'dist'), ['./', './index.html'])).toBe(before);

    put('index.html', 'two');
    expect(buildIdOf(join(root, 'dist'), ['./', './index.html'])).not.toBe(before);
  });
});

describe('listFiles', () => {
  it('lists every file, `/` separated, sorted, relative to the folder', () => {
    put('b.txt', '');
    put('assets/a.js', '');

    expect(listFiles(join(root, 'dist'))).toEqual(['assets/a.js', 'b.txt']);
  });
});
