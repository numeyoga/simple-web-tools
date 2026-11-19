import { base, browserModule, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

// Order matters: later entries override the globals and `sourceType` of earlier ones.
export default [
  ...base(['dist/**', 'public/assets/vendor/**', 'playwright-report/**', 'test-results/**']),
  browserModule(['src/**/*.js', '*.config.js']),
  nodeGlobals(['vite.config.js', 'vitest.config.js', 'playwright.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
