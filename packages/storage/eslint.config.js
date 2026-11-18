import { base, browserModule, node, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

export default [
  ...base(),
  browserModule(['src/**/*.js']),
  node(['*.config.js']),
  nodeGlobals(['vitest.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
