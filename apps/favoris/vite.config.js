import { pwaPlugin } from '@simple-web-tools/pwa/vite';
import { defineConfig } from 'vite';

// Strict Content Security Policy (decision 0004): nothing is allowed unless it is listed.
// - script-src 'self': the bundle and theme-init.js, never inline script or handlers.
// - style-src 'self': Vite's extracted stylesheet. No 'unsafe-inline': the app and Covenant only
//   set styles through the CSSOM (`element.style.x = ...`), which a CSP allows; there is no
//   `style` attribute in markup and no <style> element.
// - img-src 'self' + Google's favicon service: the favicon and the manifest icons, and, only while
//   the person turns on "Load site icons from Google" in the preferences, the icon of each link.
//   The service answers `www.google.com/s2/favicons` with a redirect to `t0`-`t3.gstatic.com`, and
//   a CSP is checked again after each redirect, so those four hosts are listed too. Google is the
//   only third party of the app and it is allowed in `img-src` and nowhere else (decision 0008).
// - font-src 'self': IBM Plex and Phosphor, bundled by @simple-web-tools/covenant.
// - connect-src 'self': the page fetches nothing (the worker reads its own manifest).
// - worker-src 'self' and manifest-src 'self': sw.js and manifest.webmanifest.
// JSON downloads are blob: links followed by the browser as downloads, which CSP does not govern,
// so they need no source of their own.
const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' https://www.google.com https://t0.gstatic.com https://t1.gstatic.com https://t2.gstatic.com https://t3.gstatic.com",
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
  plugins: [pwaPlugin({ appId: 'favoris', csp: PROD_CSP })],
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
    port: 4176,
    strictPort: true,
    headers: {
      'Content-Security-Policy': PROD_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
});
