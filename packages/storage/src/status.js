/**
 * @typedef {object} StorageStatus
 * @property {boolean} supported
 * @property {boolean} persisted
 * @property {number | null} usageBytes
 * @property {number | null} quotaBytes
 */

/**
 * Optionally request persistent storage, then read the current quota usage.
 * @param {{ requestPersist?: boolean }} [opts]
 * @returns {Promise<StorageStatus>}
 */
export async function inspectStorageStatus(opts = {}) {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, persisted: false, usageBytes: null, quotaBytes: null };
  }
  let persisted;
  try {
    persisted = await navigator.storage.persisted();
    if (!persisted && opts.requestPersist && typeof navigator.storage.persist === 'function') {
      persisted = await navigator.storage.persist();
    }
  } catch {
    persisted = false;
  }

  let usageBytes = null;
  let quotaBytes = null;
  try {
    if (typeof navigator.storage.estimate === 'function') {
      const estimate = await navigator.storage.estimate();
      usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
      quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
    }
  } catch {
    usageBytes = null;
    quotaBytes = null;
  }

  return { supported: true, persisted, usageBytes, quotaBytes };
}
