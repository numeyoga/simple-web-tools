import { base, node } from '@simple-web-tools/config/eslint';

// Apps and packages lint themselves (`npm run lint` runs every workspace).
// `apps/chrono` is legacy and joins ESLint when it is ported (docs/roadmap.md).
export default [
  ...base(['apps/**', 'packages/**', '_site/**']),
  node(['scripts/**/*.{js,mjs}', '*.config.js']),
];
