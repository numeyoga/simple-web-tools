import { defineConfig } from 'vite';

// TODO (docs/roadmap.md, step 4 "Bundled fonts, strict CSP, PWA"): add the Content Security
// Policy as Locavern does. It cannot be added yet: covenant.css still loads Google Fonts.
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
