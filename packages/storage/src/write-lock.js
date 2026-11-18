import { lockChannelName, writeLockName } from './names.js';

/**
 * @typedef {object} WriteLockHandle
 * @property {boolean} acquired
 * @property {() => void} release give the lock back and tell the other tabs
 */

/**
 * Tell the other tabs through BroadcastChannel that the write lock was released.
 * @param {string} app
 */
function broadcastLockRelease(app) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(lockChannelName(app));
    channel.postMessage({ type: 'lock-released' });
    channel.close();
  } catch {
    // Ignore broadcast errors.
  }
}

/**
 * Acquire the exclusive Web Lock that makes this tab the single writer of an app.
 * If another tab holds it, resolves at once with `{ acquired: false }`. Without
 * `navigator.locks` the tab is considered the writer.
 * @param {string} app
 * @returns {Promise<WriteLockHandle>}
 */
export function acquireWriteLock(app) {
  const lockName = writeLockName(app);
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return Promise.resolve({ acquired: true, release: () => {} });
  }

  return new Promise((resolve) => {
    let settled = false;
    navigator.locks
      .request(lockName, { ifAvailable: true }, (lock) => {
        if (!lock) {
          settled = true;
          resolve({ acquired: false, release: () => {} });
          return undefined;
        }

        return new Promise((releaseLock) => {
          const release = () => {
            releaseLock(undefined);
            broadcastLockRelease(app);
          };
          settled = true;
          resolve({ acquired: true, release });
        });
      })
      .catch(() => {
        if (!settled) {
          resolve({ acquired: false, release: () => {} });
        }
      });
  });
}

/**
 * Wait in the Web Locks queue until the exclusive write lock becomes available (handles
 * abrupt tab closes or crashes, where `beforeunload` does not fire).
 * @param {string} app
 * @param {(handle: { acquired: true; release: () => void }) => void} onAcquired
 * @returns {() => void} cancel function, to call if the tab unloads before acquiring
 */
export function waitForWriteLock(app, onAcquired) {
  const lockName = writeLockName(app);
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return () => {};
  }

  const controller = new AbortController();
  navigator.locks
    .request(lockName, { signal: controller.signal }, (lock) => {
      if (!lock) return undefined;
      return new Promise((releaseLock) => {
        const release = () => {
          releaseLock(undefined);
          broadcastLockRelease(app);
        };
        onAcquired({ acquired: true, release });
      });
    })
    .catch(() => {
      // Aborted or unavailable; ignore cleanly.
    });

  return () => controller.abort();
}

/**
 * Subscribe to the release notifications of other tabs.
 * @param {string} app
 * @param {() => void} onRelease
 * @returns {() => void} unsubscribe
 */
export function onWriteLockReleased(app, onRelease) {
  const channelName = lockChannelName(app);
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  const channel = new BroadcastChannel(channelName);
  channel.addEventListener('message', (event) => {
    if (event.data?.type === 'lock-released') {
      onRelease();
    }
  });
  return () => channel.close();
}
