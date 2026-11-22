import { pwaPlugin } from '@simple-web-tools/pwa/vite';
import { defineConfig } from 'vite';

// Strict Content Security Policy (decision 0004): nothing is allowed unless it is listed.
// - script-src 'self': the bundle, its lazy chunks (Mermaid) and theme-init.js, never inline script
//   or handlers. No 'unsafe-eval': Mermaid draws without it (tests/e2e/mermaid.spec.js listens for
//   violations).
// - style-src 'self' 'unsafe-inline': the one directive that is looser than in the other apps, and
//   only here. Mermaid's SVG carries `<style>` elements and `style` attributes, which a CSP refuses
//   unless 'unsafe-inline' is allowed; without it a diagram loses its colours and its layout.
//   The rest of the app sets styles through the CSSOM (`element.style.x = ...`), which a CSP allows.
//   The risk is bounded: slide HTML is sanitized (DOMPurify removes `style` attributes and
//   `<style>` elements), `script-src` stays strict, and `img-src` and `default-src` stop any
//   request an injected style could make.
// - img-src 'self' blob:: the favicon and the manifest icons, and the images of the chosen folder,
//   which the app turns into object URLs (no copy, nothing sent anywhere). No `data:` and no
//   host: an image from the web is replaced by a placeholder that says why (see
//   src/adapters/dom/slide-html.js), and Mermaid needs no `data:` image.
// - font-src 'self': IBM Plex and Phosphor, bundled by @simple-web-tools/covenant.
// - connect-src 'self': the page fetches nothing (the worker reads its own manifest).
// - worker-src 'self' and manifest-src 'self': sw.js and manifest.webmanifest.
// Links in a presentation are opened by the person (`<a target="_blank">`, a navigation, which
// `default-src` does not govern); the app never fetches them.
const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
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

export default defineConfig({
  base: './',
  plugins: [
    pwaPlugin({
      appId: 'slides',
      csp: PROD_CSP,
      // Mermaid and what only it loads (about ninety chunks, 5 MB) are cached the first time a
      // diagram is shown, not at install: most talks have none.
      onDemandModules: [/[\\/]node_modules[\\/]mermaid[\\/]/],
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
    // Mermaid and its diagram types are lazy chunks, some of them large: that is the point of the
    // split (the first load stays small), so Vite's 500 kB warning does not apply to them.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    headers: { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
  },
  // Keep the port in sync with `preview` in package.json and playwright.config.js. The same
  // policy as the meta tag, as a header.
  preview: {
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
    headers: {
      'Content-Security-Policy': PROD_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  },
});
