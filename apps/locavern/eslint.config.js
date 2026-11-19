import {
  base,
  browserModule,
  classicScript,
  nodeGlobals,
  serviceWorker,
  tests,
} from '@simple-web-tools/config/eslint';

// Order matters: later entries override the globals and `sourceType` of earlier ones.
export default [
  ...base(['dist/**', 'playwright-report/**', 'test-results/**']),
  browserModule(['src/**/*.js', 'public/*.js', '*.config.js']),
  serviceWorker(['public/sw.js']),
  classicScript(['public/theme-init.js']),
  nodeGlobals(['vite.config.js', 'vitest.config.js', 'playwright.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
