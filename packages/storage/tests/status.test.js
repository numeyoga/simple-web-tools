import { afterEach, describe, it, expect, vi } from 'vitest';
import { inspectStorageStatus } from '../src/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inspectStorageStatus', () => {
  it('reports an unsupported browser', async () => {
    vi.stubGlobal('navigator', {});
    expect(await inspectStorageStatus()).toEqual({
      supported: false,
      persisted: false,
      usageBytes: null,
      quotaBytes: null,
    });
  });

  it('asks for persistence only when requested', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => false,
        persist,
        estimate: async () => ({ usage: 5, quota: 10 }),
      },
    });
    expect(await inspectStorageStatus()).toMatchObject({
      persisted: false,
      usageBytes: 5,
      quotaBytes: 10,
    });
    expect(persist).not.toHaveBeenCalled();
    expect(await inspectStorageStatus({ requestPersist: true })).toMatchObject({ persisted: true });
  });

  it('degrades to nulls when the estimate fails', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => true,
        estimate: async () => {
          throw new Error('no');
        },
      },
    });
    expect(await inspectStorageStatus()).toEqual({
      supported: true,
      persisted: true,
      usageBytes: null,
      quotaBytes: null,
    });
  });
});
