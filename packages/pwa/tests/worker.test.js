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
        return entries.get(url);
      },
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
