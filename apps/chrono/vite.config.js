import { pwaPlugin } from '@simple-web-tools/pwa/vite';
import { defineConfig } from 'vite';

// Strict Content Security Policy (decision 0004): nothing is allowed unless it is listed.
// - script-src 'self': the bundle and theme-init.js, never inline script or handlers.
// - style-src 'self': Vite's extracted stylesheet. No 'unsafe-inline': the app and Covenant only
//   set styles through the CSSOM (`element.style.x = ...`), which a CSP allows; there is no
//   `style` attribute in markup and no <style> element.
// - img-src 'self': the favicon and the manifest icons (the app draws no image of its own).
// - font-src 'self': IBM Plex and Phosphor, bundled by @simple-web-tools/covenant.
// - connect-src 'self': the page fetches nothing (the worker reads its own manifest).
// - worker-src 'self' and manifest-src 'self': sw.js and manifest.webmanifest.
// CSV and JSON downloads are blob: links followed by the browser as downloads, which CSP does
// not govern, so they need no source.
const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  base: './',
  plugins: [pwaPlugin({ appId: 'chrono', csp: PROD_CSP })],
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    headers: { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
  },
  // Keep the port in sync with `preview` in package.json and playwright.config.js. The same
  // policy as the meta tag, as a header.
  preview: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    headers: {
      'Content-Security-Policy': PROD_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
});
