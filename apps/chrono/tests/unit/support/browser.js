// Fakes for the few browser globals the storage adapters use: `window`, `localStorage`,
// event listeners (`pagehide`, `storage`), `BroadcastChannel`, the clock and the 1 s timer.
// IndexedDB comes from `@simple-web-tools/test-utils/fake-indexeddb` (see vitest.config.js).
import { vi } from 'vitest';
import { closeDatabase } from '../../../src/adapters/idb.js';

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

/** In-memory BroadcastChannel: a message reaches the other channels of the same name. */
function fakeBroadcastChannel() {
  /** @type {any[]} */
  const registry = [];
  return class {
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
        if (c === this || c.name !== this.name) continue;
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
  };
}

/**
 * In-memory `navigator.locks`: exclusive locks by name, `ifAvailable`, a queue and `signal`.
 * `crash(name)` frees a lock the way the death of its tab would.
 */
export function fakeLocks() {
  /** @type {Map<string, { free: () => void }>} */
  const held = new Map();
  /** @type {Map<string, (() => void)[]>} */
  const queues = new Map();

  /** @param {string} name */
  function grantNext(name) {
    const next = queues.get(name)?.shift();
    if (next) next();
  }

  return {
    /**
     * @param {string} name
     * @param {{ ifAvailable?: boolean, signal?: AbortSignal }} options
     * @param {(lock: object | null) => Promise<unknown> | undefined} callback
     */
    request(name, options, callback) {
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
 * @param {boolean} [options.indexedDB] false: the browser has no IndexedDB (localStorage fallback)
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
  vi.stubGlobal('location', { reload() {} });
  vi.stubGlobal('BroadcastChannel', fakeBroadcastChannel());
  vi.stubGlobal('addEventListener', (/** @type {string} */ type, /** @type {any} */ fn) => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  });
  // The 1 s tick is not under test: no timer that would keep running after a test.
  vi.spyOn(globalThis, 'setInterval').mockReturnValue(/** @type {any} */ (0));
  if (!indexedDB) delete (/** @type {any} */ (globalThis).indexedDB);
  vi.useFakeTimers({ toFake: ['Date'] });
  if (now != null) vi.setSystemTime(now);
  return {
    localStorage,
    locks,
    /** Moves the frozen clock. */
    setNow: (/** @type {number} */ ts) => vi.setSystemTime(ts),
    /** Dispatches a window event to the listeners registered by the code under test. */
    fire: (/** @type {string} */ type) => (listeners.get(type) ?? []).forEach((fn) => fn({ type })),
  };
}

/** Undoes installBrowser() and closes the shared IndexedDB connection of the adapters. */
export async function uninstallBrowser() {
  await closeDatabase();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (/** @type {any} */ (globalThis)[name]);
  }
  previous.clear();
}
