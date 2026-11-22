/// <reference types="vite/client" />
// All the apps share one origin (decision 0005): every name Slides persists or shares starts with
// the app name. The names are checked where they are made, and where they reach the browser.
import { createLocalePreference } from '@simple-web-tools/i18n';
import { shellCacheName } from '@simple-web-tools/pwa';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createChannel } from '../../src/adapters/channel.js';
import {
  APP,
  channelName,
  localeKey,
  presenterWindowName,
  singleKeyShortcutsKey,
  textSizeKey,
  themeKey,
} from '../../src/adapters/names.js';
import { setSingleKeyShortcuts, setTheme, storeTextSize } from '../../src/adapters/preferences.js';
import { presenterUrl } from '../../src/adapters/windows.js';
import { fakeLocalStorage } from './support/browser.js';

const themeInit = /** @type {Record<string, string>} */ (
  import.meta.glob('../../public/theme-init.js', { query: '?raw', import: 'default', eager: true })
);

const PREFIX = 'slides';
/** @param {string} name */
const prefixed = (name) => name === PREFIX || name.startsWith(`${PREFIX}-`);

afterEach(() => vi.unstubAllGlobals());

describe('the names built by the app', () => {
  test('the app name is the folder name, the package name and the prefix', () => {
    expect(APP).toBe(PREFIX);
  });

  test.each([
    ['theme', themeKey(), 'slides-theme'],
    ['text size', textSizeKey(), 'slides-text-size'],
    ['letter and digit shortcuts', singleKeyShortcutsKey(), 'slides-single-key-shortcuts'],
    ['language', localeKey(), 'slides-locale'],
    ['channel', channelName(), 'slides-sync'],
    ['presenter window', presenterWindowName(), 'slides-presenter'],
    ['shell cache', shellCacheName('slides', 'abc123'), 'slides-shell-abc123'],
  ])('%s is %s', (_what, actual, expected) => {
    expect(actual).toBe(expected);
    expect(prefixed(actual)).toBe(true);
  });
});

describe('the names that reach the browser', () => {
  test('every localStorage key written by the app starts with the prefix', () => {
    const storage = fakeLocalStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('document', {
      documentElement: { dataset: {} },
      querySelector: () => null,
    });

    setTheme('dark');
    storeTextSize('large');
    setSingleKeyShortcuts(false);
    createLocalePreference({ app: APP, storage }).set('fr'); // as adapters/i18n.js

    expect(storage.keys().sort()).toEqual([
      'slides-locale',
      'slides-single-key-shortcuts',
      'slides-text-size',
      'slides-theme',
    ]);
  });

  test('the channel between the windows is named with the prefix', () => {
    /** @type {string[]} */
    const opened = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        /** @param {string} name */
        constructor(name) {
          opened.push(name);
        }
        close() {}
      },
    );

    createChannel().close();

    expect(opened).toEqual(['slides-sync']);
  });

  test('the presenter window is the same page with ?view=presenter, and nothing of the hash', () => {
    vi.stubGlobal('location', { href: 'http://127.0.0.1:4178/?x=1#top' });
    expect(presenterUrl()).toBe('http://127.0.0.1:4178/?view=presenter');
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
