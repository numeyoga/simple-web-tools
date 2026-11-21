import { describe, expect, it, vi } from 'vitest';
import { setupServiceWorkerUpdates } from '../../src/adapters/sw-update.js';

/**
 * Create a lightweight EventTarget with postMessage and state helpers for tests.
 */
function makeFakeWorker(initialState = 'installing') {
  const target = new EventTarget();
  /** @type {any} */
  const worker = Object.assign(target, {
    state: initialState,
    postMessage: vi.fn(),
  });
  return worker;
}

describe('setupServiceWorkerUpdates', () => {
  it('notifies when an updated worker is already waiting and reloads on SKIP_WAITING activation', async () => {
    const swContainer = Object.assign(new EventTarget(), {
      controller: makeFakeWorker('activated'),
    });
    const waitingWorker = makeFakeWorker('installed');
    const reg = Object.assign(new EventTarget(), {
      waiting: waitingWorker,
      installing: null,
      update: vi.fn(async () => {}),
    });

    const onUpdateReady = vi.fn();
    const reload = vi.fn();

    const cleanup = await setupServiceWorkerUpdates({
      serviceWorker: /** @type {any} */ (swContainer),
      register: async () => /** @type {any} */ (reg),
      onUpdateReady,
      reload,
      onVisible: () => () => {},
    });

    expect(onUpdateReady).toHaveBeenCalledTimes(1);

    // External controllerchange before user asks to reload must not trigger reload.
    swContainer.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();

    const applyUpdate = onUpdateReady.mock.calls[0]?.[0];
    applyUpdate();
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    swContainer.dispatchEvent(new Event('controllerchange'));
    swContainer.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('detects updatefound -> installed only when an active controller exists', async () => {
    const swContainer = Object.assign(new EventTarget(), {
      controller: /** @type {any} */ (null),
    });
    const installingWorker = makeFakeWorker('installing');
    const reg = Object.assign(new EventTarget(), {
      waiting: /** @type {any} */ (null),
      installing: installingWorker,
      update: vi.fn(async () => {}),
    });

    const onUpdateReady = vi.fn();
    await setupServiceWorkerUpdates({
      serviceWorker: /** @type {any} */ (swContainer),
      register: async () => /** @type {any} */ (reg),
      onUpdateReady,
      reload: vi.fn(),
      onVisible: () => () => {},
    });

    // First install with no active controller: must not prompt reload.
    installingWorker.state = 'installed';
    installingWorker.dispatchEvent(new Event('statechange'));
    expect(onUpdateReady).not.toHaveBeenCalled();

    // Subsequent update while a controller is active: notifies once installed.
    swContainer.controller = makeFakeWorker('activated');
    const nextWorker = makeFakeWorker('installing');
    reg.installing = nextWorker;
    reg.dispatchEvent(new Event('updatefound'));
    expect(onUpdateReady).not.toHaveBeenCalled();

    nextWorker.state = 'installed';
    reg.waiting = nextWorker;
    nextWorker.dispatchEvent(new Event('statechange'));
    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });
});
