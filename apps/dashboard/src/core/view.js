// What the person looked at last in a workspace: the application, and the environment of each
// application. It is kept apart from the data (it is not backed up, and a read-only tab may
// change it). Pure: parsing and updating; the adapter reads and writes `localStorage`.

/**
 * @typedef {object} ViewMemory
 * @property {string | null} appId the application looked at last
 * @property {Readonly<Record<string, string>>} envs the environment last opened, by application id
 */

// Keys that would reach the object's prototype instead of naming an application.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** @returns {ViewMemory} */
export const emptyViewMemory = () => ({ appId: null, envs: {} });

/**
 * What a stored value stands for. Anything that is not the expected shape is an empty memory.
 * @param {string | null | undefined} raw
 * @returns {ViewMemory}
 */
export function parseViewMemory(raw) {
  if (typeof raw !== 'string') return emptyViewMemory();
  /** @type {unknown} */
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return emptyViewMemory();
  }
  if (!value || typeof value !== 'object') return emptyViewMemory();
  const { appId, envs } = /** @type {Record<string, unknown>} */ (value);
  /** @type {Record<string, string>} */
  const clean = {};
  if (envs && typeof envs === 'object') {
    for (const [id, key] of Object.entries(envs)) {
      if (typeof key === 'string' && !UNSAFE_KEYS.has(id)) clean[id] = key;
    }
  }
  return { appId: typeof appId === 'string' ? appId : null, envs: clean };
}

/**
 * The memory after the person opened an application on an environment.
 * @param {ViewMemory} memory
 * @param {string} appId
 * @param {string | null} envKey
 * @returns {ViewMemory}
 */
export function rememberView(memory, appId, envKey) {
  if (UNSAFE_KEYS.has(appId)) return memory;
  if (memory.appId === appId && (envKey === null || memory.envs[appId] === envKey)) return memory;
  return {
    appId,
    envs:
      envKey === null
        ? memory.envs
        : Object.fromEntries([...Object.entries(memory.envs), [appId, envKey]]),
  };
}
