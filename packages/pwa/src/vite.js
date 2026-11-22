// The build side of the offline shell: a Vite plugin for an app's `vite.config.js`. Node only
// (`node:crypto`, `node:fs`): never import it from code that runs in the browser.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { BUILD_ID_PLACEHOLDER, precacheUrls } from './index.js';

/** @param {string} dir @returns {string[]} files of the folder, `/` separated, relative to it */
export function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}

/**
 * Hash of the precached files (their URL, and their content but for the start URL), cut to ten
 * hexadecimal characters: the build id of the worker and of the shell cache.
 * @param {string} outDir the build output folder
 * @param {readonly string[]} urls the result of `precacheUrls`
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
 * @param {{ appId: string, csp: string, worker?: string }} options
 *   `appId` names the plugin (`<app id>-csp-and-precache`); `worker` is the source of the
 *   worker, relative to the project root (default `src/sw/sw.js`)
 * @returns {import('vite').Plugin}
 */
export function pwaPlugin({ appId, csp, worker = 'src/sw/sw.js' }) {
  let outDir = '';
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
    transformIndexHtml(html) {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
      return html.replace(/(<meta\s+charset=["']utf-8["']\s*\/?>)/i, `$1\n    ${tag}`);
    },
    closeBundle() {
      const urls = precacheUrls(listFiles(outDir));
      const buildId = buildIdOf(outDir, urls);
      writeFileSync(join(outDir, 'precache-manifest.json'), `${JSON.stringify(urls, null, 2)}\n`);
      const script = join(outDir, 'sw.js');
      writeFileSync(script, readFileSync(script, 'utf8').replaceAll(BUILD_ID_PLACEHOLDER, buildId));
    },
  };
}
