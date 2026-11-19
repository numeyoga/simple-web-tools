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
      registry.push(this);
    }
    /** @param {unknown} data */
    postMessage(data) {
      for (const c of registry) {
        if (c !== this && c.name === this.name) setTimeout(() => c.onmessage?.({ data }), 0);
      }
    }
    close() {}
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
