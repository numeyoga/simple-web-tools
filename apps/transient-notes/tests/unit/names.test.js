/// <reference types="vite/client" />
// All the apps share one origin (decision 0005): every name Transient Notes persists or shares
// starts with the app name. The names are checked where they are made, and where they are used.
import { lockChannelName, writeLockName } from '@simple-web-tools/storage';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { shellCacheName } from '../../src/core/pwa.js';
import { createAppStore } from '../../src/adapters/store.js';
import { getRegistry } from '../../src/adapters/workspaces.js';
import { createLocalePreference } from '@simple-web-tools/i18n';
import { setSingleKeyShortcuts, setTheme, storeTextSize } from '../../src/adapters/preferences.js';
import {
  APP,
  activeWorkspaceKey,
  channelName,
  databaseNameFor,
  localeKey,
  lockChannelNameFor,
  lockName,
  singleKeyShortcutsKey,
  textSizeKey,
  themeKey,
  workspaceListKey,
} from '../../src/adapters/names.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';

const themeInit = /** @type {Record<string, string>} */ (
  import.meta.glob('../../public/theme-init.js', { query: '?raw', import: 'default', eager: true })
);

const PREFIX = 'transient-notes';
/** @param {string} name */
const prefixed = (name) =>
  name === PREFIX || name.startsWith(`${PREFIX}-`) || name.startsWith(`${PREFIX}__`);

afterEach(uninstallBrowser);

describe('the names built by the app', () => {
  test('the app name is the folder name, the package name and the prefix', () => {
    expect(APP).toBe(PREFIX);
  });

  test.each([
    ['database of a workspace', databaseNameFor('default'), 'transient-notes__default'],
    ['write lock', lockName(), 'transient-notes-write-lock'],
    ['lock channel', lockChannelNameFor(), 'transient-notes-lock-channel'],
    ['sync channel', channelName('work'), 'transient-notes-sync-work'],
    ['workspace list', workspaceListKey(), 'transient-notes-workspaces'],
    ['active workspace', activeWorkspaceKey(), 'transient-notes-workspace-active'],
    ['theme', themeKey(), 'transient-notes-theme'],
    ['text size', textSizeKey(), 'transient-notes-text-size'],
    ['single-key shortcuts', singleKeyShortcutsKey(), 'transient-notes-single-key-shortcuts'],
    ['language', localeKey(), 'transient-notes-locale'],
    ['shell cache', shellCacheName('abc123'), 'transient-notes-shell-abc123'],
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
      querySelector: () => null,
    });

    getRegistry().create('Work'); // the registry writes the list and (on setActive) the active id
    getRegistry().setActive('work');
    setTheme('dark');
    storeTextSize('large');
    setSingleKeyShortcuts(false);
    createLocalePreference({ app: APP, storage: nav.localStorage }).set('fr'); // as adapters/i18n.js

    expect(nav.localStorage.keys().sort()).toEqual([
      'transient-notes-locale',
      'transient-notes-single-key-shortcuts',
      'transient-notes-text-size',
      'transient-notes-theme',
      'transient-notes-workspace-active',
      'transient-notes-workspaces',
    ]);
  });

  test('the store asks for the app lock, opens the workspace database and its sync channel', async () => {
    const nav = installBrowser();
    const store = createAppStore({ workspaceId: 'work' });

    await store.init();

    expect(nav.locks.requested.every((name) => prefixed(name))).toBe(true);
    expect(nav.locks.requested).toContain('transient-notes-write-lock');
    expect(nav.channels()).toEqual(['transient-notes-sync-work']);
    expect((await indexedDB.databases()).map((d) => d.name)).toEqual(['transient-notes__work']);
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
  });
});
