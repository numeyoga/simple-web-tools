import { base, browserModule, node, nodeGlobals, tests } from '@simple-web-tools/config/eslint';

// `src/vite.js` is the only file that runs in Node (the build); the rest runs in the browser or
// in the service worker.
export default [
  ...base(),
  browserModule(['src/**/*.js']),
  node(['src/vite.js']),
  nodeGlobals(['vitest.config.js', 'eslint.config.js']),
  tests(['tests/**/*.js']),
];
