import { describe, it, expect } from 'vitest';
import {
  databaseName,
  lockChannelName,
  storageName,
  workspaceDatabaseName,
  writeLockName,
} from '../src/index.js';

describe('name prefixing', () => {
  it('reproduces the names Locavern already persists', () => {
    expect(databaseName('locavern')).toBe('locavern-db');
    expect(writeLockName('locavern')).toBe('locavern-write-lock');
    expect(lockChannelName('locavern')).toBe('locavern-lock-channel');
  });

  it('builds <app>-<suffix> and <app>__<workspace> names', () => {
    expect(storageName('chrono', 'workspaces')).toBe('chrono-workspaces');
    expect(workspaceDatabaseName('chrono', 'default')).toBe('chrono__default');
  });

  it.each(['', 'Locavern', '1app', 'my_app', 'my--app', '-app', 'app-', 'a'.repeat(33)])(
    'rejects the app name %j',
    (app) => {
      expect(() => storageName(app, 'db')).toThrow(TypeError);
    },
  );

  it.each(['', 'DB', 'a b', 'a/b', '-x', 'x-'])('rejects the suffix %j', (suffix) => {
    expect(() => storageName('locavern', suffix)).toThrow(TypeError);
  });

  it('rejects an invalid workspace id', () => {
    expect(() => workspaceDatabaseName('chrono', 'Main Space')).toThrow(TypeError);
  });
});
