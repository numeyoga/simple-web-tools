// A fake `localStorage` for the unit tests of the adapters that read the preferences.
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
