import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig } from 'vite';
import { precacheUrls } from './src/core/pwa.js';

// Strict Content Security Policy (decision 0004): nothing is allowed unless it is listed.
// - script-src 'self': the bundle and theme-init.js, never inline script or handlers.
// - style-src 'self': Vite's extracted stylesheet. No 'unsafe-inline': the app and Covenant only
//   set styles through the CSSOM (`element.style.x = ...`), which a CSP allows; there is no
//   `style` attribute in markup and no <style> element.
// - img-src 'self' blob:: the favicon and the manifest icons, and the pictures of the notes. A note
//   keeps its images as Blobs in IndexedDB and shows them through `URL.createObjectURL`, which
//   gives a `blob:` URL. `blob:` is the narrowest source that allows it: no `data:` (the images
//   are never inlined in a document) and no remote host (the editor refuses remote images).
// - font-src 'self': IBM Plex and Phosphor, bundled by @simple-web-tools/covenant.
// - connect-src 'self': the page fetches nothing (the worker reads its own manifest).
// - worker-src 'self' and manifest-src 'self': sw.js and manifest.webmanifest.
// Text, Markdown and JSON downloads are blob: links followed by the browser as downloads, which
// CSP does not govern, so they need no source of their own.
const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob:",
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
 * hashes every precached file, so the worker changes whenever the shell does.
 * @returns {import('vite').Plugin}
 */
function productionPlugin() {
  let outDir = '';
  return {
    name: 'transient-notes-csp-and-precache',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />`;
      return html.replace(/(<meta\s+charset=["']utf-8["']\s*\/?>)/i, `$1\n    ${tag}`);
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
    headers: { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
  },
  // Keep the port in sync with `preview` in package.json and playwright.config.js. The same
  // policy as the meta tag, as a header.
  preview: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
    headers: {
      'Content-Security-Policy': PROD_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
});
