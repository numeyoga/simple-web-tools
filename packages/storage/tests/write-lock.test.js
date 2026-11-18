import { afterEach, describe, it, expect, vi } from 'vitest';
import { acquireWriteLock, onWriteLockReleased, waitForWriteLock } from '../src/index.js';

/**
 * Minimal Web Locks implementation: exclusive locks per name, a FIFO queue, `ifAvailable` and
 * `signal`. It follows the specification's observable behavior, nothing more.
 */
function createFakeLocks() {
  /** @type {Map<string, { held: boolean; queue: Array<() => void> }>} */
  const state = new Map();
  /** @type {Array<{ name: string; options: unknown }>} */
  const requested = [];
  return {
    requested,
    /** @param {string} name @param {any} options @param {(lock: object | null) => any} callback */
    async request(name, options, callback) {
      requested.push({ name, options });
      const entry = state.get(name) ?? { held: false, queue: [] };
      state.set(name, entry);
      const run = async () => {
        entry.held = true;
        try {
          return await callback({ name });
        } finally {
          entry.held = false;
          entry.queue.shift()?.();
        }
      };
      if (!entry.held) return run();
      if (options.ifAvailable) return callback(null);
      return new Promise((resolve, reject) => {
        const start = () => run().then(resolve, reject);
        entry.queue.push(start);
        options.signal?.addEventListener('abort', () => {
          const index = entry.queue.indexOf(start);
          if (index >= 0) entry.queue.splice(index, 1);
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('without navigator.locks', () => {
  it('acquire resolves as the writer with a no-op release', async () => {
    vi.stubGlobal('navigator', {});
    const handle = await acquireWriteLock('locavern');
    expect(handle.acquired).toBe(true);
    expect(() => handle.release()).not.toThrow();
  });

  it('wait returns a no-op cancel and never calls back', () => {
    vi.stubGlobal('navigator', {});
    const onAcquired = vi.fn();
    const cancel = waitForWriteLock('locavern', onAcquired);
    expect(() => cancel()).not.toThrow();
    expect(onAcquired).not.toHaveBeenCalled();
  });

  it('works when navigator itself is missing', async () => {
    vi.stubGlobal('navigator', undefined);
    expect((await acquireWriteLock('locavern')).acquired).toBe(true);
  });
});

describe('without BroadcastChannel', () => {
  it('subscription is a no-op and release still works', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('navigator', { locks: createFakeLocks() });
    const unsubscribe = onWriteLockReleased('locavern', () => {});
    expect(() => unsubscribe()).not.toThrow();
    const handle = await acquireWriteLock('locavern');
    expect(handle.acquired).toBe(true);
    expect(() => handle.release()).not.toThrow();
  });
});

describe('with Web Locks', () => {
  it('uses the prefixed lock name and ifAvailable', async () => {
    const locks = createFakeLocks();
    vi.stubGlobal('navigator', { locks });
    const handle = await acquireWriteLock('locavern');
    expect(locks.requested[0]).toEqual({
      name: 'locavern-write-lock',
      options: { ifAvailable: true },
    });
    handle.release();
  });

  it('gives the lock to a single tab at a time, and again after release', async () => {
    vi.stubGlobal('navigator', { locks: createFakeLocks() });
    const first = await acquireWriteLock('locavern');
    const second = await acquireWriteLock('locavern');
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(() => second.release()).not.toThrow();
    first.release();
    await new Promise((r) => setTimeout(r, 0));
    const third = await acquireWriteLock('locavern');
    expect(third.acquired).toBe(true);
    third.release();
  });

  it('keeps apps independent', async () => {
    vi.stubGlobal('navigator', { locks: createFakeLocks() });
    const a = await acquireWriteLock('locavern');
    const b = await acquireWriteLock('chrono');
    expect(b.acquired).toBe(true);
    a.release();
    b.release();
  });

  it('resolves as not acquired when the request itself fails', async () => {
    vi.stubGlobal('navigator', {
      locks: { request: () => Promise.reject(new Error('SecurityError')) },
    });
    expect((await acquireWriteLock('locavern')).acquired).toBe(false);
  });

  it('wait is granted when the holder releases', async () => {
    vi.stubGlobal('navigator', { locks: createFakeLocks() });
    const holder = await acquireWriteLock('locavern');
    const granted = new Promise((resolve) => waitForWriteLock('locavern', resolve));
    holder.release();
    const handle = await granted;
    expect(handle.acquired).toBe(true);
    handle.release();
  });

  it('wait can be cancelled through its AbortController', async () => {
    vi.stubGlobal('navigator', { locks: createFakeLocks() });
    const holder = await acquireWriteLock('locavern');
    const onAcquired = vi.fn();
    const cancel = waitForWriteLock('locavern', onAcquired);
    cancel();
    holder.release();
    await new Promise((r) => setTimeout(r, 10));
    expect(onAcquired).not.toHaveBeenCalled();
  });

  it('tells subscribers of the same app when the lock is released, not other apps', async () => {
    vi.stubGlobal('navigator', { locks: createFakeLocks() });
    const mine = vi.fn();
    const other = vi.fn();
    const stopMine = onWriteLockReleased('locavern', mine);
    const stopOther = onWriteLockReleased('chrono', other);
    const handle = await acquireWriteLock('locavern');
    handle.release();
    await new Promise((r) => setTimeout(r, 20));
    expect(mine).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    stopMine();
    stopOther();
  });
});
