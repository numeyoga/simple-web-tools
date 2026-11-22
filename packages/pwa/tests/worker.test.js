// The worker logic, run against a fake worker scope, a fake Cache Storage and a fake network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerShellWorker } from '../src/worker.js';

const ORIGIN = 'https://me.example';
const SCOPE = `${ORIGIN}/chrono/`;

/** A Cache Storage holding named caches of `url -> body`, with the calls the worker makes. */
function fakeCacheStorage(/** @type {Record<string, string[]>} */ initial = {}) {
  /** @type {Map<string, Map<string, Response>>} */
  const stores = new Map(
    Object.entries(initial).map(([name, urls]) => [
      name,
      new Map(urls.map((url) => [new URL(url, SCOPE).href, new Response(`cached ${url}`)])),
    ]),
  );
  const open = async (/** @type {string} */ name) => {
    let store = stores.get(name);
    if (!store) {
      store = new Map();
      stores.set(name, store);
    }
    const entries = store;
    return {
      addAll: vi.fn(async (/** @type {Request[]} */ requests) => {
        for (const request of requests)
          entries.set(request.url, new Response(`cached ${request.url}`));
      }),
      match: async (/** @type {Request | string} */ request) => {
        const url = new URL(typeof request === 'string' ? request : request.url, SCOPE).href;
        return entries.get(url)?.clone();
      },
      put: vi.fn(
        async (/** @type {Request | string} */ request, /** @type {Response} */ response) => {
          const url = new URL(typeof request === 'string' ? request : request.url, SCOPE).href;
          entries.set(url, response);
        },
      ),
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
    };
  };
  return {
    stores,
    open: vi.fn(open),
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (/** @type {string} */ name) => stores.delete(name)),
  };
}

/** The slice of a service worker scope that `registerShellWorker` uses. */
function fakeScope({ active = false } = {}) {
  /** @type {Map<string, (event: any) => void>} */
  const listeners = new Map();
  const scope = {
    location: { origin: ORIGIN },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(async () => {}),
    registration: { active: active ? {} : null, scope: SCOPE },
    addEventListener: (/** @type {string} */ type, /** @type {(event: any) => void} */ fn) => {
      listeners.set(type, fn);
    },
  };
  /** Dispatches an event that carries `waitUntil` and resolves with the promise it was given. */
  async function lifecycle(/** @type {string} */ type) {
    /** @type {Promise<unknown>} */
    let work = Promise.resolve();
    listeners.get(type)?.({ waitUntil: (/** @type {Promise<unknown>} */ p) => (work = p) });
    await work;
  }
  /** Dispatches a fetch event and returns what the worker answered, or `undefined`. */
  async function fetchEvent(/** @type {Request} */ request) {
    /** @type {Promise<Response> | undefined} */
    let answer;
    listeners.get('fetch')?.({
      request,
      respondWith: (/** @type {Promise<Response>} */ p) => (answer = p),
    });
    return answer === undefined ? undefined : await answer;
  }
  return { scope, listeners, lifecycle, fetchEvent };
}

describe('registerShellWorker', () => {
  /** @type {ReturnType<typeof fakeCacheStorage>} */
  let caches;
  const fetchMock = vi.fn();

  beforeEach(() => {
    caches = fakeCacheStorage();
    vi.stubGlobal('caches', caches);
    vi.stubGlobal('fetch', fetchMock);
    // A worker resolves `./x` against its own URL; Node has no base, so the test supplies one.
    const NodeRequest = Request;
    vi.stubGlobal(
      'Request',
      class extends NodeRequest {
        /** @param {string} url @param {RequestInit} [init] */
        constructor(url, init) {
          super(new URL(url, SCOPE).href, init);
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('listens to install, message, activate and fetch', () => {
    const { scope, listeners } = fakeScope();

    registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

    expect([...listeners.keys()].sort()).toEqual(['activate', 'fetch', 'install', 'message']);
  });

  it('install caches the files of the manifest in <app id>-shell-<build id>', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(['./', './index.html', './sw.js', './assets/a.js.map'])),
    );
    const { scope, lifecycle } = fakeScope();
    registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

    await lifecycle('install');

    expect(fetchMock).toHaveBeenCalledWith('./precache-manifest.json', { cache: 'reload' });
    expect(caches.open).toHaveBeenCalledWith('chrono-shell-abc');
    const cache = await caches.open.mock.results[0]?.value;
    const urls = cache.addAll.mock.calls[0][0].map((/** @type {Request} */ r) => r.url);
    expect(urls).toEqual([SCOPE, `${SCOPE}index.html`]);
  });

  it('install uses the build id placeholder when none is given', async () => {
    fetchMock.mockImplementation(async () => new Response('[]'));
    const { scope, lifecycle } = fakeScope();
    registerShellWorker({ appId: 'transient-notes', scope });

    await lifecycle('install');

    expect(caches.open).toHaveBeenCalledWith('transient-notes-shell-__BUILD_ID__');
  });

  it('the first worker takes over at once; an update waits', async () => {
    fetchMock.mockImplementation(async () => new Response('[]'));
    const first = fakeScope({ active: false });
    registerShellWorker({ appId: 'chrono', buildId: 'abc', scope: first.scope });
    await first.lifecycle('install');
    expect(first.scope.skipWaiting).toHaveBeenCalledTimes(1);

    const update = fakeScope({ active: true });
    registerShellWorker({ appId: 'chrono', buildId: 'def', scope: update.scope });
    await update.lifecycle('install');
    expect(update.scope.skipWaiting).not.toHaveBeenCalled();
  });

  it('install fails, and so does the update, when the manifest is not served', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }));
    const { scope, lifecycle } = fakeScope();
    registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

    await expect(lifecycle('install')).rejects.toThrow('precache manifest: 404');
  });

  it('activate deletes the other caches of the app and never another app’s', async () => {
    caches = fakeCacheStorage({
      'chrono-shell-old': [],
      'chrono-shell-abc': [],
      'locavern-shell-v4': [],
      'workbox-precache': [],
    });
    vi.stubGlobal('caches', caches);
    const { scope, lifecycle } = fakeScope();
    registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

    await lifecycle('activate');

    expect([...caches.stores.keys()]).toEqual([
      'chrono-shell-abc',
      'locavern-shell-v4',
      'workbox-precache',
    ]);
    expect(scope.clients.claim).toHaveBeenCalledTimes(1);
  });

  describe('on-demand files', () => {
    const MANIFEST = JSON.stringify({
      precache: ['./', './index.html'],
      onDemand: ['./assets/lazy-a.js', './assets/lazy-b.js'],
    });

    /** Installs a worker of the build `buildId` whose manifest lists on-demand files. */
    async function installed(/** @type {string} */ buildId, { active = false } = {}) {
      fetchMock.mockResolvedValueOnce(new Response(MANIFEST));
      const worker = fakeScope({ active });
      registerShellWorker({ appId: 'slides', buildId, scope: worker.scope });
      await worker.lifecycle('install');
      return worker;
    }

    /** The URLs held by a cache, without the scope. */
    async function held(/** @type {string} */ name) {
      const cache = await caches.open(name);
      return (await cache.keys()).map((request) => request.url.replace(SCOPE, './')).sort();
    }

    it('install caches the precache only, and keeps the manifest for later', async () => {
      await installed('abc');

      expect(await held('slides-shell-abc')).toEqual([
        './',
        './index.html',
        './precache-manifest.json',
      ]);
    });

    it('install keeps no manifest for an app with nothing on demand', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(['./', './index.html'])));
      const { scope, lifecycle } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

      await lifecycle('install');

      expect(await held('chrono-shell-abc')).toEqual(['./', './index.html']);
    });

    it('fetches an on-demand file once, stores it, then serves it with no network', async () => {
      const { fetchEvent } = await installed('abc');
      fetchMock.mockResolvedValueOnce(new Response('lazy a'));

      const first = await fetchEvent(new Request(`${SCOPE}assets/lazy-a.js`));
      expect(await first?.text()).toBe('lazy a');
      expect(await held('slides-shell-abc')).toContain('./assets/lazy-a.js');

      fetchMock.mockRejectedValue(new TypeError('offline'));
      const second = await fetchEvent(new Request(`${SCOPE}assets/lazy-a.js`));
      expect(await second?.text()).toBe('lazy a');
    });

    it('knows its on-demand files again when the worker was stopped (no memory, only the cache)', async () => {
      await installed('abc');
      const restarted = fakeScope({ active: true });
      registerShellWorker({ appId: 'slides', buildId: 'abc', scope: restarted.scope });
      fetchMock.mockResolvedValueOnce(new Response('lazy b'));

      await restarted.fetchEvent(new Request(`${SCOPE}assets/lazy-b.js`));

      expect(await held('slides-shell-abc')).toContain('./assets/lazy-b.js');
    });

    it('does not store a file that is not on the list, nor a failed answer', async () => {
      const { fetchEvent } = await installed('abc');
      fetchMock.mockResolvedValueOnce(new Response('other'));
      await fetchEvent(new Request(`${SCOPE}assets/other.js`));
      fetchMock.mockResolvedValueOnce(new Response('gone', { status: 404 }));
      const missing = await fetchEvent(new Request(`${SCOPE}assets/lazy-b.js`));

      expect(missing?.status).toBe(404);
      expect(await held('slides-shell-abc')).toEqual([
        './',
        './index.html',
        './precache-manifest.json',
      ]);
    });

    it('answers the page even when the cache refuses the file', async () => {
      const { fetchEvent } = await installed('abc');
      const cache = await caches.open('slides-shell-abc');
      cache.put.mockRejectedValue(new Error('quota'));
      caches.open.mockResolvedValue(cache);
      fetchMock.mockResolvedValueOnce(new Response('lazy a'));

      const response = await fetchEvent(new Request(`${SCOPE}assets/lazy-a.js`));

      expect(await response?.text()).toBe('lazy a');
    });

    it('offline, an on-demand file never used is a 503, like any other file', async () => {
      const { fetchEvent } = await installed('abc');
      fetchMock.mockRejectedValue(new TypeError('offline'));

      const response = await fetchEvent(new Request(`${SCOPE}assets/lazy-a.js`));

      expect(response?.status).toBe(503);
    });

    it('an update copies the on-demand entries still on demand, then deletes the old cache', async () => {
      caches = fakeCacheStorage({
        'slides-shell-old': ['./index.html', './assets/lazy-a.js', './assets/dropped.js'],
        'chrono-shell-old': ['./assets/lazy-a.js'],
      });
      vi.stubGlobal('caches', caches);
      const update = await installed('new', { active: true });

      await update.lifecycle('activate');

      expect(await held('slides-shell-new')).toEqual([
        './',
        './assets/lazy-a.js',
        './index.html',
        './precache-manifest.json',
      ]);
      expect([...caches.stores.keys()].sort()).toEqual(['chrono-shell-old', 'slides-shell-new']);
      const { fetchEvent } = update;
      fetchMock.mockRejectedValue(new TypeError('offline'));
      const response = await fetchEvent(new Request(`${SCOPE}assets/lazy-a.js`));
      expect(await response?.text()).toBe('cached ./assets/lazy-a.js');
    });

    it('an update keeps what it already has, and still deletes the old cache if a copy fails', async () => {
      caches = fakeCacheStorage({
        'slides-shell-old': ['./assets/lazy-a.js', './assets/lazy-b.js'],
      });
      vi.stubGlobal('caches', caches);
      const update = await installed('new', { active: true });
      const fresh = await caches.open('slides-shell-new');
      await fresh.put('./assets/lazy-a.js', new Response('fresh a'));
      fresh.put.mockClear();
      const old = await caches.open('slides-shell-old');
      old.keys = async () => {
        throw new Error('broken');
      };
      caches.open.mockImplementation(async (/** @type {string} */ name) =>
        name === 'slides-shell-old' ? old : fresh,
      );

      await update.lifecycle('activate');

      expect(fresh.put).not.toHaveBeenCalled();
      expect(caches.delete).toHaveBeenCalledWith('slides-shell-old');
    });

    it('an update of an app with nothing on demand copies nothing', async () => {
      caches = fakeCacheStorage({ 'chrono-shell-old': ['./assets/x.js'] });
      vi.stubGlobal('caches', caches);
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(['./'])));
      const { scope, lifecycle } = fakeScope({ active: true });
      registerShellWorker({ appId: 'chrono', buildId: 'new', scope });
      await lifecycle('install');

      await lifecycle('activate');

      expect(await held('chrono-shell-new')).toEqual(['./']);
    });
  });

  describe('message', () => {
    const skip = { type: 'SKIP_WAITING' };

    it('SKIP_WAITING from a page of the app activates the waiting worker', () => {
      const { scope, listeners } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

      listeners.get('message')?.({ origin: ORIGIN, data: skip, source: { url: `${SCOPE}#/x` } });

      expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'a page of another app',
        { origin: ORIGIN, data: skip, source: { url: `${ORIGIN}/locavern/` } },
      ],
      ['another origin', { origin: 'https://evil.example', data: skip, source: { url: SCOPE } }],
      ['another message', { origin: ORIGIN, data: { type: 'CLAIM' }, source: { url: SCOPE } }],
      ['no data', { origin: ORIGIN, data: null, source: { url: SCOPE } }],
      ['no source', { origin: ORIGIN, data: skip, source: null }],
    ])('is ignored from %s', (_name, event) => {
      const { scope, listeners } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

      listeners.get('message')?.(event);

      expect(scope.skipWaiting).not.toHaveBeenCalled();
    });
  });

  describe('fetch', () => {
    /** @param {string} url @param {RequestInit & { mode?: RequestMode }} [init] */
    const get = (url, init) => new Request(url, init);

    it('serves a cached file without touching the network', async () => {
      caches = fakeCacheStorage({ 'chrono-shell-abc': ['./index.html'] });
      vi.stubGlobal('caches', caches);
      const { scope, fetchEvent } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

      const response = await fetchEvent(get(`${SCOPE}index.html`));

      expect(await response?.text()).toBe('cached ./index.html');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('goes to the network for a file that is not cached', async () => {
      fetchMock.mockResolvedValue(new Response('from network'));
      const { scope, fetchEvent } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

      const response = await fetchEvent(get(`${SCOPE}other.json`));

      expect(await response?.text()).toBe('from network');
    });

    it('leaves another origin and a write to the browser', async () => {
      const { scope, fetchEvent } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

      expect(await fetchEvent(get('https://cdn.example/a.js'))).toBeUndefined();
      expect(await fetchEvent(get(`${SCOPE}x`, { method: 'POST' }))).toBeUndefined();
    });

    it('offline, a navigation gets the cached index.html', async () => {
      caches = fakeCacheStorage({ 'chrono-shell-abc': ['./index.html'] });
      vi.stubGlobal('caches', caches);
      fetchMock.mockRejectedValue(new TypeError('offline'));
      const { scope, fetchEvent } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });
      // `new Request(url, { mode: 'navigate' })` throws outside a browser: a plain object will do.
      const navigation = /** @type {Request} */ (
        /** @type {unknown} */ ({ url: `${SCOPE}deep/link`, method: 'GET', mode: 'navigate' })
      );

      const response = await fetchEvent(navigation);

      expect(await response?.text()).toBe('cached ./index.html');
    });

    it('offline, anything else is a 503', async () => {
      fetchMock.mockRejectedValue(new TypeError('offline'));
      const { scope, fetchEvent } = fakeScope();
      registerShellWorker({ appId: 'chrono', buildId: 'abc', scope });

      const response = await fetchEvent(get(`${SCOPE}data.json`));

      expect(response?.status).toBe(503);
      expect(await response?.text()).toBe('Offline');
    });
  });
});
