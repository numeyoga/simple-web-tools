// The build side of the offline shell: a Vite plugin for an app's `vite.config.js`. Node only
// (`node:crypto`, `node:fs`): never import it from code that runs in the browser.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { BUILD_ID_PLACEHOLDER, splitShellUrls } from './index.js';

/** @param {string} dir @returns {string[]} files of the folder, `/` separated, relative to it */
export function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}

/**
 * @typedef {object} BundleChunk the part of a Rollup chunk that `lazyChunksOf` reads
 * @property {string} type `chunk` (assets are ignored)
 * @property {string} fileName
 * @property {boolean} [isEntry]
 * @property {readonly string[]} [imports] files loaded with the chunk
 * @property {readonly string[]} [dynamicImports] files that an `import()` may load
 * @property {readonly string[]} [moduleIds] the modules bundled in the chunk
 */

/**
 * The chunks that only a lazy library needs: those holding a module whose path matches one of
 * `modules`, and everything that only they (and each other) load. A library split in dozens of
 * hashed chunks (Mermaid: one per diagram type, plus its helpers) is listed without naming them,
 * and a chunk that the app's own code also uses (statically from an entry, or from its other lazy
 * chunks) stays out, so it can still be precached.
 * @param {Record<string, BundleChunk | { type: string, fileName: string }>} bundle
 * @param {readonly RegExp[]} modules matched on module ids (`/node_modules/mermaid/`)
 * @returns {Set<string>} output file names (`assets/mermaid.core-1a2b.js`)
 */
export function lazyChunksOf(bundle, modules) {
  /** @type {Map<string, BundleChunk>} */
  const chunks = new Map();
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk') chunks.set(item.fileName, /** @type {BundleChunk} */ (item));
  }
  /** @param {BundleChunk} chunk */
  const loads = (chunk) => [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])];
  /** @param {Iterable<string>} from @param {(chunk: BundleChunk) => readonly string[]} edges */
  const reach = (from, edges) => {
    const seen = new Set(from);
    for (const name of seen) {
      for (const next of chunks.get(name)
        ? edges(/** @type {BundleChunk} */ (chunks.get(name)))
        : []) {
        if (chunks.has(next)) seen.add(next);
      }
    }
    return seen;
  };
  // What is loaded with the page itself: never on demand.
  const eager = reach(
    [...chunks.values()].filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName),
    (chunk) => chunk.imports ?? [],
  );
  const seeds = [...chunks.values()].filter(
    (chunk) =>
      !eager.has(chunk.fileName) &&
      (chunk.moduleIds ?? []).some((id) => modules.some((pattern) => pattern.test(id))),
  );
  const lazy = reach(
    seeds.map((chunk) => chunk.fileName),
    loads,
  );
  for (const name of eager) lazy.delete(name);
  const seedNames = new Set(seeds.map((chunk) => chunk.fileName));
  // A chunk that is not a seed and that something outside the set loads is shared with the app.
  for (let changed = true; changed;) {
    changed = false;
    for (const chunk of chunks.values()) {
      for (const next of loads(chunk)) {
        if (lazy.has(next) && !seedNames.has(next) && !lazy.has(chunk.fileName)) {
          lazy.delete(next);
          changed = true;
        }
      }
    }
  }
  return lazy;
}

/**
 * Hash of the shell's files, precached or on demand (their URL, and their content but for the
 * start URL), cut to ten hexadecimal characters: the build id of the worker and of the shell
 * cache. On-demand files count: a new Mermaid is a new build, even though install does not fetch it.
 * @param {string} outDir the build output folder
 * @param {readonly string[]} urls the precached URLs, then the on-demand ones
 */
export function buildIdOf(outDir, urls) {
  const hash = createHash('sha256');
  for (const url of urls) {
    hash.update(url);
    if (url !== './') hash.update(readFileSync(join(outDir, url)));
  }
  return hash.digest('hex').slice(0, 10);
}

/**
 * The offline shell of an app, at build time (`vite build` only):
 *
 * - adds the worker source as a second entry, emitted as `sw.js` (not hashed, not in a folder:
 *   its URL fixes its scope). Nothing else imports its code, so it has no import left. The
 *   app's own `index.html` stays the first entry;
 * - injects `csp` as a `<meta http-equiv="Content-Security-Policy">` into `index.html`;
 * - once the whole output (public files included) is on disk, writes `precache-manifest.json`
 *   and stamps `sw.js` with a build id that hashes every precached file, so the worker changes
 *   whenever the shell does. Without the stamp the worker stays byte-identical across releases:
 *   the browser never installs a new one and the old cache keeps serving the previous
 *   `index.html` on every normal navigation.
 *
 * The app keeps its policy in its own `vite.config.js` (it differs per app) and passes the same
 * string to `preview.headers` if it wants the header as well.
 *
 * Files left **on demand** are not precached: the worker caches them the first time the page asks
 * for them (a heavy lazy library that most sessions never load). They are still hashed into the
 * build id, and the manifest becomes `{ precache, onDemand }`. Without any, it stays the plain
 * array of precached URLs it has always been.
 *
 * @param {{ appId: string, csp: string, worker?: string, onDemand?: ReadonlyArray<RegExp | ((path: string) => boolean)>, onDemandModules?: readonly RegExp[] }} options
 *   `appId` names the plugin (`<app id>-csp-and-precache`); `worker` is the source of the
 *   worker, relative to the project root (default `src/sw/sw.js`); `onDemand` matches output
 *   paths (`assets/mermaid.core-1a2b.js`), by regular expression or by function;
 *   `onDemandModules` matches module paths (`/node_modules\/mermaid\//`) and takes every chunk
 *   that only those modules need (see `lazyChunksOf`), whatever the chunks are called
 * @returns {import('vite').Plugin}
 */
export function pwaPlugin({
  appId,
  csp,
  worker = 'src/sw/sw.js',
  onDemand = [],
  onDemandModules = [],
}) {
  let outDir = '';
  /** @type {Set<string>} */
  let lazyChunks = new Set();
  return {
    name: `${appId}-csp-and-precache`,
    apply: 'build',
    enforce: 'post',
    config() {
      return {
        build: {
          rollupOptions: {
            input: { index: 'index.html', sw: worker },
            output: {
              entryFileNames: (/** @type {{ name: string }} */ chunk) =>
                chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
            },
          },
        },
      };
    },
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      lazyChunks = onDemandModules.length > 0 ? lazyChunksOf(bundle, onDemandModules) : new Set();
    },
    transformIndexHtml(html) {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
      return html.replace(/(<meta\s+charset=["']utf-8["']\s*\/?>)/i, `$1\n    ${tag}`);
    },
    closeBundle() {
      const { precache, onDemand: lazy } = splitShellUrls(
        listFiles(outDir),
        (path) =>
          lazyChunks.has(path) ||
          onDemand.some((rule) => (typeof rule === 'function' ? rule(path) : rule.test(path))),
      );
      const buildId = buildIdOf(outDir, [...precache, ...lazy]);
      const manifest = lazy.length > 0 ? { precache, onDemand: lazy } : precache;
      writeFileSync(
        join(outDir, 'precache-manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      const script = join(outDir, 'sw.js');
      writeFileSync(script, readFileSync(script, 'utf8').replaceAll(BUILD_ID_PLACEHOLDER, buildId));
    },
  };
}
