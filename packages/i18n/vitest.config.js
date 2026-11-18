import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    // A DST-observing zone, so that date formatting is exercised across real transitions.
    // `tests/dates.test.js` switches zones itself to cover more of them.
    env: { TZ: 'Europe/Paris' },
  },
});
