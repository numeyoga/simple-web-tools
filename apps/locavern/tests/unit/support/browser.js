// A fake `localStorage` for the unit tests that run without a browser.

export function fakeLocalStorage() {
  /** @type {Map<string, string>} */
  const store = new Map();
  return {
    getItem: (/** @type {string} */ key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (/** @type {string} */ key, /** @type {unknown} */ value) => {
      store.set(key, String(value));
    },
    removeItem: (/** @type {string} */ key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    keys: () => [...store.keys()],
  };
}
