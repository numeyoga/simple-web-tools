import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    // Dogfood the public setup entry, exactly as an app would list it.
    setupFiles: ['@simple-web-tools/test-utils/fake-indexeddb'],
  },
});
