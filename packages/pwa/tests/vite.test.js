// The Vite plugin, driven by hand against a temporary output folder: the hooks Vite calls, in the
// order it calls them, with the file system a build leaves behind.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIdOf, lazyChunksOf, listFiles, pwaPlugin } from '../src/vite.js';

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

describe('pwaPlugin with on-demand files', () => {
  /** @param {Parameters<typeof pwaPlugin>[0]} options */
  const build = (options) => {
    put('index.html', '<html></html>');
    put('assets/index-a1.js', 'app');
    put('assets/mermaid.core-b2.js', 'mermaid');
    put('assets/katex-c3.js', 'katex');
    put('sw.js', 'const CACHE = "x-shell-__BUILD_ID__"');
    const plugin = pwaPlugin(options);
    closeBundle(plugin);
    return JSON.parse(readFileSync(join(root, 'dist', 'precache-manifest.json'), 'utf8'));
  };

  it('keeps the manifest a plain array when nothing is on demand', () => {
    expect(build({ appId: 'x', csp: CSP })).toEqual([
      './',
      './assets/index-a1.js',
      './assets/katex-c3.js',
      './assets/mermaid.core-b2.js',
      './index.html',
    ]);
  });

  it('lists the files that match a pattern or a function in a second list', () => {
    const manifest = build({
      appId: 'x',
      csp: CSP,
      onDemand: [/^assets\/mermaid/, (path) => path === 'assets/katex-c3.js'],
    });

    expect(manifest).toEqual({
      precache: ['./', './assets/index-a1.js', './index.html'],
      onDemand: ['./assets/katex-c3.js', './assets/mermaid.core-b2.js'],
    });
  });

  it('hashes the on-demand files into the build id, though they are not precached', () => {
    build({ appId: 'x', csp: CSP, onDemand: [/mermaid/] });
    const stamped = () => readFileSync(join(root, 'dist', 'sw.js'), 'utf8');
    const before = stamped();
    expect(before).not.toContain('__BUILD_ID__');

    put('sw.js', 'const CACHE = "x-shell-__BUILD_ID__"');
    put('assets/mermaid.core-b2.js', 'a new mermaid');
    closeBundle(pwaPlugin({ appId: 'x', csp: CSP, onDemand: [/mermaid/] }));

    expect(stamped()).not.toBe(before);
  });

  it('takes the chunks that only the lazy modules need, from the bundle', () => {
    const plugin = pwaPlugin({
      appId: 'x',
      csp: CSP,
      onDemandModules: [/node_modules\/mermaid\//],
    });
    const generateBundle = /** @type {(options: unknown, bundle: unknown) => void} */ (
      plugin.generateBundle
    );
    generateBundle.call(
      {},
      {},
      {
        'assets/index-a1.js': chunk('assets/index-a1.js', {
          isEntry: true,
          dynamicImports: ['assets/mermaid.core-b2.js'],
        }),
        'assets/mermaid.core-b2.js': chunk('assets/mermaid.core-b2.js', {
          moduleIds: ['/p/node_modules/mermaid/x.js'],
          imports: ['assets/katex-c3.js'],
        }),
        'assets/katex-c3.js': chunk('assets/katex-c3.js', {
          moduleIds: ['/p/node_modules/katex/k.js'],
        }),
      },
    );
    put('index.html', '<html></html>');
    put('assets/index-a1.js', 'app');
    put('assets/mermaid.core-b2.js', 'mermaid');
    put('assets/katex-c3.js', 'katex');
    put('sw.js', '__BUILD_ID__');
    closeBundle(plugin);

    const manifest = JSON.parse(readFileSync(join(root, 'dist', 'precache-manifest.json'), 'utf8'));
    expect(manifest.onDemand).toEqual(['./assets/katex-c3.js', './assets/mermaid.core-b2.js']);
    expect(manifest.precache).toEqual(['./', './assets/index-a1.js', './index.html']);
  });
});

/** @param {string} fileName @param {Record<string, unknown>} [parts] */
function chunk(fileName, parts = {}) {
  return {
    type: 'chunk',
    fileName,
    isEntry: false,
    imports: [],
    dynamicImports: [],
    moduleIds: [],
    ...parts,
  };
}

describe('lazyChunksOf', () => {
  const lib = [/node_modules\/lib\//];

  it('takes the lib chunks and what only they load', () => {
    const bundle = {
      'index.js': chunk('index.js', { isEntry: true, dynamicImports: ['lib.js'] }),
      'lib.js': chunk('lib.js', {
        moduleIds: ['/node_modules/lib/a.js'],
        dynamicImports: ['diagram.js'],
        imports: ['helper.js'],
      }),
      'diagram.js': chunk('diagram.js', {
        moduleIds: ['/node_modules/lib/d.js'],
        imports: ['helper.js'],
      }),
      'helper.js': chunk('helper.js', { moduleIds: ['/node_modules/other/h.js'] }),
    };

    expect([...lazyChunksOf(bundle, lib)].sort()).toEqual(['diagram.js', 'helper.js', 'lib.js']);
  });

  it('leaves out what the app also loads: statically from an entry, or from its own lazy chunk', () => {
    const bundle = {
      'index.js': chunk('index.js', {
        isEntry: true,
        imports: ['shared.js'],
        dynamicImports: ['lib.js', 'example.js'],
      }),
      'lib.js': chunk('lib.js', {
        moduleIds: ['/node_modules/lib/a.js'],
        imports: ['shared.js', 'also-example.js', 'only-lib.js'],
      }),
      'example.js': chunk('example.js', { imports: ['also-example.js'] }),
      'shared.js': chunk('shared.js', { moduleIds: ['/node_modules/lib/s.js'] }),
      'also-example.js': chunk('also-example.js', { imports: ['deep.js'] }),
      'deep.js': chunk('deep.js'),
      'only-lib.js': chunk('only-lib.js'),
    };

    expect([...lazyChunksOf(bundle, lib)].sort()).toEqual(['lib.js', 'only-lib.js']);
  });

  it('ignores assets and finds nothing when no module matches', () => {
    const bundle = {
      'index.js': chunk('index.js', { isEntry: true }),
      'logo.svg': { type: 'asset', fileName: 'logo.svg' },
    };

    expect(lazyChunksOf(bundle, lib).size).toBe(0);
  });
});

describe('listFiles', () => {
  it('lists every file, `/` separated, sorted, relative to the folder', () => {
    put('b.txt', '');
    put('assets/a.js', '');

    expect(listFiles(join(root, 'dist'))).toEqual(['assets/a.js', 'b.txt']);
  });
});
