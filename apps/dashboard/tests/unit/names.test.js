/// <reference types="vite/client" />
// All the apps share one origin (decision 0005): every name Dashboard persists or shares
// starts with the app name. The names are checked where they are made, and where they are used.
import { lockChannelName, writeLockName } from '@simple-web-tools/storage';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { shellCacheName } from '@simple-web-tools/pwa';
import { createAppStore } from '../../src/adapters/store.js';
import { getRegistry } from '../../src/adapters/workspaces.js';
import { createLocalePreference } from '@simple-web-tools/i18n';
import {
  setSingleKeyShortcuts,
  setDensity,
  setTheme,
  storeTextSize,
} from '../../src/adapters/preferences.js';
import {
  APP,
  activeWorkspaceKey,
  channelName,
  databaseNameFor,
  densityKey,
  localeKey,
  lockChannelNameFor,
  lockName,
  singleKeyShortcutsKey,
  textSizeKey,
  themeKey,
  viewKey,
  workspaceListKey,
} from '../../src/adapters/names.js';
import { writeViewMemory } from '../../src/adapters/view-memory.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';

const themeInit = /** @type {Record<string, string>} */ (
  import.meta.glob('../../public/theme-init.js', { query: '?raw', import: 'default', eager: true })
);

const PREFIX = 'dashboard';
/** @param {string} name */
const prefixed = (name) =>
  name === PREFIX || name.startsWith(`${PREFIX}-`) || name.startsWith(`${PREFIX}__`);

afterEach(uninstallBrowser);

describe('the names built by the app', () => {
  test('the app name is the folder name, the package name and the prefix', () => {
    expect(APP).toBe(PREFIX);
  });

  test.each([
    ['database of a workspace', databaseNameFor('default'), 'dashboard__default'],
    ['write lock', lockName(), 'dashboard-write-lock'],
    ['lock channel', lockChannelNameFor(), 'dashboard-lock-channel'],
    ['sync channel', channelName('work'), 'dashboard-sync-work'],
    ['workspace list', workspaceListKey(), 'dashboard-workspaces'],
    ['active workspace', activeWorkspaceKey(), 'dashboard-workspace-active'],
    ['theme', themeKey(), 'dashboard-theme'],
    ['text size', textSizeKey(), 'dashboard-text-size'],
    ['single-key shortcuts', singleKeyShortcutsKey(), 'dashboard-single-key-shortcuts'],
    ['language', localeKey(), 'dashboard-locale'],
    ['density', densityKey(), 'dashboard-density'],
    ['last view of a workspace', viewKey('work'), 'dashboard-view-work'],
    ['shell cache', shellCacheName('dashboard', 'abc123'), 'dashboard-shell-abc123'],
  ])('%s is %s', (_what, actual, expected) => {
    expect(actual).toBe(expected);
    expect(prefixed(actual)).toBe(true);
  });

  test('the package helpers give the same names as the app', () => {
    expect(writeLockName(APP)).toBe(lockName());
    expect(lockChannelName(APP)).toBe(lockChannelNameFor());
  });
});

describe('the names that reach the browser', () => {
  test('every localStorage key written by the app starts with the prefix', () => {
    const nav = installBrowser();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('document', {
      ...document,
      documentElement: { dataset: {} },
      dispatchEvent: () => true,
      querySelector: () => null,
    });

    getRegistry().create('Work'); // the registry writes the list and (on setActive) the active id
    getRegistry().setActive('work');
    setTheme('dark');
    storeTextSize('large');
    setSingleKeyShortcuts(false);
    setDensity('compact');
    writeViewMemory('work', 'app-1', 'prod');
    createLocalePreference({ app: APP, storage: nav.localStorage }).set('fr'); // as adapters/i18n.js

    expect(nav.localStorage.keys().sort()).toEqual([
      'dashboard-density',
      'dashboard-locale',
      'dashboard-single-key-shortcuts',
      'dashboard-text-size',
      'dashboard-theme',
      'dashboard-view-work',
      'dashboard-workspace-active',
      'dashboard-workspaces',
    ]);
  });

  test('the store asks for the app lock, opens the workspace database and its sync channel', async () => {
    const nav = installBrowser();
    const store = createAppStore({ workspaceId: 'work' });

    await store.init();

    expect(nav.locks.requested.every((name) => prefixed(name))).toBe(true);
    expect(nav.locks.requested).toContain('dashboard-write-lock');
    expect(nav.channels()).toEqual(['dashboard-sync-work']);
    expect((await indexedDB.databases()).map((d) => d.name)).toEqual(['dashboard__work']);
    await store.close();
  });

  test('a read-only tab waits for the same lock and listens on the same channels', async () => {
    const nav = installBrowser();
    const writer = createAppStore({ workspaceId: 'default' });
    const reader = createAppStore({ workspaceId: 'default' });
    await writer.init();
    await reader.init();

    expect(nav.locks.requested.every((name) => prefixed(name))).toBe(true);
    expect(nav.channels().every((name) => prefixed(name))).toBe(true);
    await reader.close();
    await writer.close();
  });
});

describe('public/theme-init.js', () => {
  test('reads the same keys as the preferences', () => {
    const code = Object.values(themeInit)[0] ?? '';

    expect(code).toContain(`'${themeKey()}'`);
    expect(code).toContain(`'${textSizeKey()}'`);
    expect(code).toContain(`'${localeKey()}'`);
    expect(code).toContain(`'${densityKey()}'`);
  });
});
