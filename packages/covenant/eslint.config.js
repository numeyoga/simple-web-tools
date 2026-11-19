import { base, browserModule, node, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

export default [
  // `src/covenant*.{css,js}` and `src/logos/` are copies of the skill's assets (`npm run sync`):
  // they follow the skill's own style (an ES5 IIFE), not this repository's lint rules.
  ...base(['src/covenant.js']),
  browserModule(['src/*.js']),
  node(['scripts/**/*.mjs', 'tests/**/*.js', '*.config.js']),
  nodeGlobals(['vitest.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
