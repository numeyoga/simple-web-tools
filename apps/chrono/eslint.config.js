import { base, browserModule, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

// Order matters: later entries override the globals and `sourceType` of earlier ones.
export default [
  ...base(['dist/**', 'public/assets/vendor/**', 'playwright-report/**', 'test-results/**']),
  browserModule(['src/**/*.js', '*.config.js']),
  nodeGlobals(['vite.config.js', 'vitest.config.js', 'playwright.config.js', 'eslint.config.js']),
  // The views come from the legacy scripts: they declare a variable, then assign it once when
  // the element is built (`let modal; ... modal = UI.Modal(...)`). They are rewritten with the
  // English identifiers in the next step, so the rule is relaxed for them only.
  { files: ['src/adapters/dom/**/*.js'], rules: { 'prefer-const': 'off' } },
  tests(['tests/**/*.js']),
];
