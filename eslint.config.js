import { base, node } from '@simple-web-tools/config/eslint';

// Apps and packages lint themselves (`npm run lint` runs every workspace).
// `apps/chrono` is legacy and joins ESLint when it is ported (docs/roadmap.md).
export default [
  // Project skills are copies of the maintainer's personal skills (CLAUDE.md).
  ...base(['apps/**', 'packages/**', '_site/**', '.claude/**']),
  node(['scripts/**/*.{js,mjs}', '*.config.js']),
];
