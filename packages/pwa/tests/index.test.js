// The pure rules of the offline shell: cache names, what is precached, which caches an update may
// delete, which requests the worker answers. The cache rules run once per app of the suite.
import { describe, expect, test } from 'vitest';
import {
  BUILD_ID_PLACEHOLDER,
  cachePrefix,
  isAppCache,
  carriedOverUrls,
  isHandledRequest,
  isOnDemandUrl,
  isTrustedClientMessage,
  onDemandHrefs,
  parseManifest,
  precacheUrls,
  shellCacheName,
  splitShellUrls,
  staleCaches,
} from '../src/index.js';

const APPS = ['chrono', 'locavern', 'transient-notes'];

/** Another app of the suite than `appId`. */
const otherThan = (/** @type {string} */ appId) => APPS.find((id) => id !== appId) ?? '';

describe.each(APPS)('cache rules of %s', (appId) => {
  const other = otherThan(appId);

  test('the shell cache starts with the app prefix and carries the build id', () => {
    expect(cachePrefix(appId)).toBe(`${appId}-`);
    expect(shellCacheName(appId, '137df293f1')).toBe(`${appId}-shell-137df293f1`);
    expect(isAppCache(appId, shellCacheName(appId, 'x'))).toBe(true);
  });

  test('only caches of the app are recognised', () => {
    expect(isAppCache(appId, `${appId}-shell-a`)).toBe(true);
    expect(isAppCache(appId, `${other}-shell-v4`)).toBe(false);
    expect(isAppCache(appId, appId)).toBe(false);
    expect(isAppCache(appId, '')).toBe(false);
  });

  test('lists the old caches of the app and keeps the current one', () => {
    const names = [`${appId}-shell-old`, `${appId}-shell-new`, `${appId}-other`];
    expect(staleCaches(appId, names, `${appId}-shell-new`)).toEqual([
      `${appId}-shell-old`,
      `${appId}-other`,
    ]);
  });

  test('never lists a cache that belongs to another app', () => {
    const names = [`${other}-shell-v4`, 'workbox-precache', appId, `${appId}-shell-old`];
    expect(staleCaches(appId, names, `${appId}-shell-new`)).toEqual([`${appId}-shell-old`]);
  });

  test('nothing to delete on a first install', () => {
    expect(staleCaches(appId, [], `${appId}-shell-new`)).toEqual([]);
    expect(staleCaches(appId, [`${appId}-shell-new`], `${appId}-shell-new`)).toEqual([]);
  });
});

test('the cache names of the apps in the suite are the ones already installed in browsers', () => {
  expect(shellCacheName('chrono', 'abc')).toBe('chrono-shell-abc');
  expect(shellCacheName('locavern', 'abc')).toBe('locavern-shell-abc');
  expect(shellCacheName('transient-notes', 'abc')).toBe('transient-notes-shell-abc');
});

test('the build id placeholder is the string the plugin stamps', () => {
  expect(BUILD_ID_PLACEHOLDER).toBe('__BUILD_ID__');
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

describe('on-demand files', () => {
  const base = 'https://me.example/slides/';
  const files = [
    'index.html',
    'assets/index-a1.js',
    'assets/mermaid.core-b2.js',
    'assets/cytoscape-c3.js',
    'sw.js',
    'assets/mermaid.core-b2.js.map',
  ];
  const isMermaid = (/** @type {string} */ path) => /^assets\/(mermaid|cytoscape)/.test(path);

  test('splitShellUrls without a rule is exactly precacheUrls', () => {
    expect(splitShellUrls(files)).toEqual({ precache: precacheUrls(files), onDemand: [] });
  });

  test('splitShellUrls leaves the matching files out of the precache, with the same filters', () => {
    expect(splitShellUrls(files, isMermaid)).toEqual({
      precache: ['./', './assets/index-a1.js', './index.html'],
      onDemand: ['./assets/cytoscape-c3.js', './assets/mermaid.core-b2.js'],
    });
  });

  test('the start URL is never on demand', () => {
    expect(splitShellUrls(['index.html'], () => true)).toEqual({
      precache: ['./'],
      onDemand: ['./index.html'],
    });
  });

  describe('parseManifest', () => {
    test('a plain array is the precache of an app with nothing on demand', () => {
      expect(parseManifest(['./', './sw.js', './index.html'])).toEqual({
        precache: ['./', './index.html'],
        onDemand: [],
      });
    });

    test('an object has both lists', () => {
      expect(parseManifest({ precache: ['./'], onDemand: ['./b.js', './a.js', './b.js'] })).toEqual(
        { precache: ['./'], onDemand: ['./a.js', './b.js'] },
      );
    });

    test.each([null, 'x', 3, {}, { precache: [] }, { precache: ['./'], onDemand: [1] }, [1]])(
      'refuses %j',
      (data) => {
        expect(() => parseManifest(data)).toThrow('precache manifest: unexpected format');
      },
    );
  });

  describe('isOnDemandUrl', () => {
    const hrefs = onDemandHrefs(['./assets/a.js', './assets/b.js'], base);

    test('resolves the manifest URLs against the scope', () => {
      expect([...hrefs]).toEqual([`${base}assets/a.js`, `${base}assets/b.js`]);
    });

    test('is true for a listed file, whatever its query or fragment', () => {
      expect(isOnDemandUrl(`${base}assets/a.js`, hrefs)).toBe(true);
      expect(isOnDemandUrl(`${base}assets/a.js?v=2#x`, hrefs)).toBe(true);
    });

    test('is false for anything else: a precached file, another app, another origin, junk', () => {
      expect(isOnDemandUrl(`${base}assets/index-a1.js`, hrefs)).toBe(false);
      expect(isOnDemandUrl('https://me.example/chrono/assets/a.js', hrefs)).toBe(false);
      expect(isOnDemandUrl('https://cdn.example/slides/assets/a.js', hrefs)).toBe(false);
      expect(isOnDemandUrl('not a url', hrefs)).toBe(false);
    });
  });

  describe('carriedOverUrls', () => {
    const hrefs = onDemandHrefs(['./assets/a.js', './assets/b.js'], base);

    test('keeps the entries that are still on demand, and only those', () => {
      const cached = [
        `${base}index.html`,
        `${base}assets/a.js`,
        `${base}assets/gone.js`,
        `${base}assets/b.js`,
      ];
      expect(carriedOverUrls(cached, hrefs)).toEqual([`${base}assets/a.js`, `${base}assets/b.js`]);
    });

    test('keeps nothing when the new build has nothing on demand', () => {
      expect(carriedOverUrls([`${base}assets/a.js`], onDemandHrefs([], base))).toEqual([]);
    });
  });
});

describe('isHandledRequest', () => {
  const origin = 'https://example.github.io';
  test('a same-origin GET is handled', () => {
    expect(isHandledRequest({ method: 'GET', url: `${origin}/chrono/` }, origin)).toBe(true);
  });

  test('another origin is never handled, so nothing cross-origin is cached', () => {
    expect(isHandledRequest({ method: 'GET', url: 'https://cdn.example.com/a.js' }, origin)).toBe(
      false,
    );
  });

  test('a write, or a URL that does not parse, is left to the browser', () => {
    expect(isHandledRequest({ method: 'POST', url: `${origin}/chrono/` }, origin)).toBe(false);
    expect(isHandledRequest({ method: 'GET', url: 'not a url' }, origin)).toBe(false);
  });
});

describe('isTrustedClientMessage', () => {
  const worker = { selfOrigin: 'https://me.github.io', scope: 'https://me.github.io/chrono/' };
  const ok = {
    origin: 'https://me.github.io',
    sourceUrl: 'https://me.github.io/chrono/#/projects',
    type: 'SKIP_WAITING',
  };

  test.each([
    ['same origin, page in scope', ok, true],
    ['the app root itself', { ...ok, sourceUrl: 'https://me.github.io/chrono/' }, true],
    ['another origin', { ...ok, origin: 'https://evil.example' }, false],
    ['same origin, another app', { ...ok, sourceUrl: 'https://me.github.io/locavern/' }, false],
    [
      'a sibling path sharing the prefix',
      { ...ok, sourceUrl: 'https://me.github.io/chrono-x/' },
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
