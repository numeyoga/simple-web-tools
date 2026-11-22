import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig } from 'vite';
import { precacheUrls } from './src/core/pwa.js';

const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** @param {string} dir @returns {string[]} files of the folder, `/` separated, relative to it */
function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}

/**
 * Production only: injects the CSP into index.html, then, once the whole output (public files
 * included) is on disk, writes `precache-manifest.json` and stamps `sw.js` with a build id that
 * hashes every precached file, so the worker changes whenever the shell does. Without the stamp
 * the worker stays byte-identical across releases: the browser never installs a new one and the
 * old cache keeps serving the previous `index.html` on every normal navigation.
 * @returns {import('vite').Plugin}
 */
function productionPlugin() {
  let outDir = '';
  return {
    name: 'locavern-csp-and-precache',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      const metaTag = `    <meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />\n`;
      return html.replace(/(<meta\s+charset=["']utf-8["']\s*\/?>)/i, `$1\n${metaTag}`);
    },
    closeBundle() {
      const urls = precacheUrls(listFiles(outDir));
      const hash = createHash('sha256');
      for (const url of urls) {
        hash.update(url);
        if (url !== './') hash.update(readFileSync(join(outDir, url)));
      }
      const buildId = hash.digest('hex').slice(0, 10);
      writeFileSync(join(outDir, 'precache-manifest.json'), `${JSON.stringify(urls, null, 2)}\n`);
      const worker = join(outDir, 'sw.js');
      writeFileSync(worker, readFileSync(worker, 'utf8').replaceAll('__BUILD_ID__', buildId));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [productionPlugin()],
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      // The service worker is a second entry, emitted as `sw.js` (not hashed, not in a folder:
      // its URL fixes its scope). Nothing else imports its code, so it has no import left.
      input: { index: 'index.html', sw: 'src/sw/sw.js' },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  server: {
    headers: {
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': PROD_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
});
