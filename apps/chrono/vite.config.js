import { defineConfig } from 'vite';

// TODO (docs/roadmap.md, step 4 "Strict CSP, PWA"): add the Content Security
// Policy as Locavern does. Nothing blocks it since step 3: fonts and icons are bundled by the
// Covenant package, and the app makes no request outside its own origin.
export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  // Keep the port in sync with `preview` in package.json and playwright.config.js.
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
