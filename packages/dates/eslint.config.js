import { base, node, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

export default [
  ...base(),
  node(['src/**/*.js', '*.config.js']),
  nodeGlobals(['vitest.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
