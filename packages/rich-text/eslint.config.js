import { base, browserModule, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

export default [
  ...base(),
  browserModule(['src/**/*.js']),
  nodeGlobals(['vitest.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
