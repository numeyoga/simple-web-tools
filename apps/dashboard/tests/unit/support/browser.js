// Fakes for the few browser globals the storage adapters use: `window`, `document` (events
// only), `localStorage`, `navigator.locks`, `BroadcastChannel`, and the object URLs. IndexedDB
// comes from `@simple-web-tools/test-utils/fake-indexeddb` (see vitest.config.js).
import { vi } from 'vitest';

export function fakeLocalStorage() {
  /** @type {Map<string, string>} */
  const m = new Map();
  return {
    getItem: (/** @type {string} */ k) => (m.has(k) ? (m.get(k) ?? null) : null),
    setItem: (/** @type {string} */ k, /** @type {unknown} */ v) => {
      m.set(k, String(v));
    },
    removeItem: (/** @type {string} */ k) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    keys: () => [...m.keys()],
  };
}

/**
 * In-memory BroadcastChannel: a message reaches the other channels of the same name. Every
 * channel ever opened is kept in `opened`, to assert the names.
 */
function fakeBroadcastChannel() {
  /** @type {any[]} */
  const registry = [];
  return {
    opened: registry,
    Channel: class {
      /** @param {string} name */
      constructor(name) {
        this.name = name;
        /** @type {((e: { data: unknown }) => void) | null} */
        this.onmessage = null;
        /** @type {((e: { data: unknown }) => void)[]} */
        this.listeners = [];
        this.closed = false;
        registry.push(this);
      }
      /** @param {unknown} data */
      postMessage(data) {
        for (const c of registry) {
          if (c === this || c.closed || c.name !== this.name) continue;
          setTimeout(() => {
            if (c.closed) return;
            c.onmessage?.({ data });
            c.listeners.forEach((/** @type {(e: { data: unknown }) => void} */ fn) => fn({ data }));
          }, 0);
        }
      }
      /**
       * @param {string} _type
       * @param {(e: { data: unknown }) => void} fn
       */
      addEventListener(_type, fn) {
        this.listeners.push(fn);
      }
      close() {
        this.closed = true;
      }
    },
  };
}

/**
 * In-memory `navigator.locks`: exclusive locks by name, `ifAvailable`, a queue and `signal`.
 * `crash(name)` frees a lock the way the death of its tab would. `requested` lists the names
 * asked for.
 */
export function fakeLocks() {
  /** @type {Map<string, { free: () => void }>} */
  const held = new Map();
  /** @type {Map<string, (() => void)[]>} */
  const queues = new Map();
  /** @type {string[]} */
  const requested = [];

  /** @param {string} name */
  function grantNext(name) {
    const next = queues.get(name)?.shift();
    if (next) next();
  }

  return {
    requested,
    /**
     * @param {string} name
     * @param {{ ifAvailable?: boolean, signal?: AbortSignal } | ((lock: object | null) => Promise<unknown> | undefined)} optionsOrCallback
     *   the options may be left out, as with the real API
     * @param {(lock: object | null) => Promise<unknown> | undefined} [maybeCallback]
     */
    request(name, optionsOrCallback, maybeCallback) {
      const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
      const callback = /** @type {(lock: object | null) => Promise<unknown> | undefined} */ (
        typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
      );
      requested.push(name);
      return new Promise((resolve, reject) => {
        const grant = () => {
          const release = () => {
            if (held.get(name) !== entry) return;
            held.delete(name);
            grantNext(name);
          };
          const entry = { free: release };
          held.set(name, entry);
          Promise.resolve(callback({ name })).then(
            (value) => {
              release();
              resolve(value);
            },
            (error) => {
              release();
              reject(error);
            },
          );
        };
        if (!held.has(name)) {
          grant();
        } else if (options.ifAvailable) {
          Promise.resolve(callback(null)).then(resolve, reject);
        } else {
          const queue = queues.get(name) ?? [];
          queues.set(name, queue);
          queue.push(grant);
          options.signal?.addEventListener('abort', () => {
            const at = queue.indexOf(grant);
            if (at >= 0) queue.splice(at, 1);
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      });
    },
    /** The holder of the lock disappears (tab closed or crashed). @param {string} name */
    crash(name) {
      held.get(name)?.free();
    },
    /** @param {string} name */
    isHeld: (name) => held.has(name),
  };
}

/** @type {Map<string, PropertyDescriptor | undefined>} */
const previous = new Map();

/**
 * @param {object} [options]
 * @param {boolean} [options.indexedDB] false: the browser has no IndexedDB
 * @param {number} [options.now] frozen clock (only `Date` is faked, timers stay real)
 */
export function installBrowser({ indexedDB = true, now } = {}) {
  const locks = fakeLocks();
  vi.stubGlobal('navigator', { locks });
  const localStorage = fakeLocalStorage();
  /** @type {Map<string, ((e: any) => void)[]>} */
  const listeners = new Map();
  vi.stubGlobal('window', globalThis);
  // Not vi.stubGlobal: reading Node's own `localStorage` prints an experimental warning.
  previous.set('localStorage', Object.getOwnPropertyDescriptor(globalThis, 'localStorage'));
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
    writable: true,
  });
  const reload = vi.fn();
  vi.stubGlobal('location', { reload });
  const broadcast = fakeBroadcastChannel();
  vi.stubGlobal('BroadcastChannel', broadcast.Channel);
  /** @param {string} type @param {any} fn */
  const add = (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  /** @param {string} type @param {any} fn */
  const remove = (type, fn) =>
    listeners.set(
      type,
      (listeners.get(type) ?? []).filter((candidate) => candidate !== fn),
    );
  vi.stubGlobal('addEventListener', add);
  vi.stubGlobal('removeEventListener', remove);
  vi.stubGlobal('document', {
    addEventListener: add,
    removeEventListener: remove,
    visibilityState: 'visible',
  });
  if (!indexedDB) delete (/** @type {any} */ (globalThis).indexedDB);
  vi.useFakeTimers({ toFake: ['Date'] });
  if (now != null) vi.setSystemTime(now);
  return {
    localStorage,
    locks,
    reload,
    /** Every BroadcastChannel opened so far. */
    channels: () => broadcast.opened.map((c) => /** @type {string} */ (c.name)),
    /** Moves the frozen clock. */
    setNow: (/** @type {number} */ ts) => vi.setSystemTime(ts),
    /** Dispatches a page event (`pagehide`, `visibilitychange`) to the registered listeners. */
    fire: (/** @type {string} */ type, /** @type {object} */ detail = {}) =>
      (listeners.get(type) ?? []).forEach((fn) => fn({ type, ...detail })),
    /** The number of listeners registered for an event. */
    listenerCount: (/** @type {string} */ type) => (listeners.get(type) ?? []).length,
  };
}

/** Undoes installBrowser(). */
export function uninstallBrowser() {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (/** @type {any} */ (globalThis)[name]);
  }
  previous.clear();
}
