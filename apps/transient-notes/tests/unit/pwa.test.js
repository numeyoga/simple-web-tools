// The pure rules of the offline shell (src/core/pwa.js): cache names, what is precached, which
// caches an update may delete, which requests the worker answers.
import { describe, expect, test } from 'vitest';
import {
  CACHE_PREFIX,
  isAppCache,
  isHandledRequest,
  isTrustedClientMessage,
  precacheUrls,
  shellCacheName,
  staleCaches,
} from '../../src/core/pwa.js';

describe('cache names', () => {
  test('the shell cache starts with the app prefix and carries the build id', () => {
    expect(CACHE_PREFIX).toBe('transient-notes-');
    expect(shellCacheName('137df293f1')).toBe('transient-notes-shell-137df293f1');
    expect(isAppCache(shellCacheName('x'))).toBe(true);
  });

  test('only caches of the app are recognised', () => {
    expect(isAppCache('transient-notes-shell-a')).toBe(true);
    expect(isAppCache('locavern-shell-v4')).toBe(false);
    expect(isAppCache('transient-notes')).toBe(false);
    expect(isAppCache('')).toBe(false);
  });
});

describe('staleCaches', () => {
  test('lists the old the app caches and keeps the current one', () => {
    const names = [
      'transient-notes-shell-old',
      'transient-notes-shell-new',
      'transient-notes-other',
    ];
    expect(staleCaches(names, 'transient-notes-shell-new')).toEqual([
      'transient-notes-shell-old',
      'transient-notes-other',
    ]);
  });

  test('never lists a cache that belongs to another app', () => {
    const names = [
      'locavern-shell-v4',
      'workbox-precache',
      'transient-notes',
      'transient-notes-shell-old',
    ];
    expect(staleCaches(names, 'transient-notes-shell-new')).toEqual(['transient-notes-shell-old']);
  });

  test('nothing to delete on a first install', () => {
    expect(staleCaches([], 'transient-notes-shell-new')).toEqual([]);
    expect(staleCaches(['transient-notes-shell-new'], 'transient-notes-shell-new')).toEqual([]);
  });
});

describe('precacheUrls', () => {
  test('relative URLs, the start URL first, sorted, without duplicates', () => {
    expect(
      precacheUrls(['index.html', 'assets/index-a1.js', './theme-init.js', 'index.html']),
    ).toEqual(['./', './assets/index-a1.js', './index.html', './theme-init.js']);
  });

  test('leaves out the worker, the manifest of the build and source maps', () => {
    const urls = precacheUrls(['sw.js', 'precache-manifest.json', 'assets/x.js.map', 'index.html']);
    expect(urls).toEqual(['./', './index.html']);
  });

  test('keeps the web app manifest, the icons and woff2 fonts', () => {
    const urls = precacheUrls([
      'manifest.webmanifest',
      'icon-192.png',
      'assets/favicon.svg',
      'assets/ibm-plex-sans-latin-400-normal-AbC.woff2',
    ]);
    expect(urls).toContain('./manifest.webmanifest');
    expect(urls).toContain('./icon-192.png');
    expect(urls).toContain('./assets/favicon.svg');
    expect(urls).toContain('./assets/ibm-plex-sans-latin-400-normal-AbC.woff2');
  });

  test('keeps the lazy chunks, so the editor opens offline after a first visit', () => {
    const urls = precacheUrls([
      'assets/index-a1.js',
      'assets/rich-text-lazy-Ab12.js',
      'assets/rich-text-tiptap-Cd34.js',
    ]);

    expect(urls).toContain('./assets/rich-text-lazy-Ab12.js');
    expect(urls).toContain('./assets/rich-text-tiptap-Cd34.js');
  });

  test('leaves out the legacy font formats, but not the favicon', () => {
    const urls = precacheUrls([
      'assets/Phosphor-AbC.woff',
      'assets/Phosphor-AbC.ttf',
      'assets/Phosphor-Bold-AbC.svg',
      'assets/ibm-plex-mono-latin-400-normal-AbC.woff',
      'assets/favicon.svg',
    ]);
    expect(urls).toEqual(['./', './assets/favicon.svg']);
  });
});

describe('isHandledRequest', () => {
  const origin = 'https://example.github.io';
  test('a same-origin GET is handled', () => {
    expect(isHandledRequest({ method: 'GET', url: `${origin}/transient-notes/` }, origin)).toBe(
      true,
    );
  });

  test('another origin is never handled, so nothing cross-origin is cached', () => {
    expect(isHandledRequest({ method: 'GET', url: 'https://cdn.example.com/a.js' }, origin)).toBe(
      false,
    );
  });

  test('a write, or a URL that does not parse, is left to the browser', () => {
    expect(isHandledRequest({ method: 'POST', url: `${origin}/transient-notes/` }, origin)).toBe(
      false,
    );
    expect(isHandledRequest({ method: 'GET', url: 'not a url' }, origin)).toBe(false);
  });
});

describe('isTrustedClientMessage', () => {
  const worker = {
    selfOrigin: 'https://me.github.io',
    scope: 'https://me.github.io/transient-notes/',
  };
  const ok = {
    origin: 'https://me.github.io',
    sourceUrl: 'https://me.github.io/transient-notes/#/projects',
    type: 'SKIP_WAITING',
  };

  test.each([
    ['same origin, page in scope', ok, true],
    ['the app root itself', { ...ok, sourceUrl: 'https://me.github.io/transient-notes/' }, true],
    ['another origin', { ...ok, origin: 'https://evil.example' }, false],
    ['same origin, another app', { ...ok, sourceUrl: 'https://me.github.io/locavern/' }, false],
    [
      'a sibling path sharing the prefix',
      { ...ok, sourceUrl: 'https://me.github.io/transient-notes-x/' },
      false,
    ],
    ['missing source', { ...ok, sourceUrl: undefined }, false],
    ['missing origin', { ...ok, origin: undefined }, false],
    ['unknown type', { ...ok, type: 'CLAIM' }, false],
    ['missing type', { ...ok, type: undefined }, false],
  ])('%s', (_name, message, expected) => {
    expect(isTrustedClientMessage(message, worker)).toBe(expected);
  });
});
