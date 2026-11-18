import { base, browserModule, node, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

export default [
  ...base(),
  node(['src/**/*.js', '*.config.js']),
  browserModule(['src/dom.js']),
  nodeGlobals(['vitest.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
