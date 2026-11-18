// Vitest setup file: `setupFiles: ['@simple-web-tools/test-utils/fake-indexeddb']`.
// Installs `indexedDB`, `IDBKeyRange` and the other IndexedDB globals, then gives every test
// a fresh, empty factory so that tests cannot see each other's databases.
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { resetIndexedDb } from './indexeddb.js';

beforeEach(() => {
  resetIndexedDb();
});
