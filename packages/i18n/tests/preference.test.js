import { describe, expect, it } from 'vitest';
import { storageName } from '@simple-web-tools/storage';
import { createLocalePreference, localePreferenceKey } from '../src/index.js';

function memoryStorage() {
  /** @type {Map<string, string>} */
  const data = new Map();
  return {
    data,
    getItem: (/** @type {string} */ key) => data.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) =>
      void data.set(key, String(value)),
    removeItem: (/** @type {string} */ key) => void data.delete(key),
  };
}

describe('createLocalePreference', () => {
  it('returns null when nothing is saved', () => {
    expect(createLocalePreference({ app: 'chrono', storage: memoryStorage() }).get()).toBeNull();
  });

  it('saves, reads and clears, under <app>-locale only', () => {
    const storage = memoryStorage();
    const preference = createLocalePreference({ app: 'chrono', storage });
    expect(preference.set('fr')).toBe(true);
    expect(preference.get()).toBe('fr');
    expect([...storage.data.keys()]).toEqual(['chrono-locale']);
    expect(preference.set(null)).toBe(true);
    expect(preference.get()).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('keeps apps apart on a shared origin', () => {
    const storage = memoryStorage();
    createLocalePreference({ app: 'chrono', storage }).set('fr');
    const locavern = createLocalePreference({ app: 'locavern', storage });
    expect(locavern.get()).toBeNull();
    locavern.set('en');
    expect(createLocalePreference({ app: 'chrono', storage }).get()).toBe('fr');
  });

  it('treats an empty stored value as no preference', () => {
    const storage = memoryStorage();
    storage.setItem('chrono-locale', '');
    expect(createLocalePreference({ app: 'chrono', storage }).get()).toBeNull();
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const preference = createLocalePreference({ app: 'chrono', storage: broken });
    expect(preference.get()).toBeNull();
    expect(preference.set('fr')).toBe(false);
    expect(preference.set(null)).toBe(false);
  });

  it.each(['', 'Chrono', '1app', 'my_app'])('rejects the app name %j', (app) => {
    expect(() => createLocalePreference({ app, storage: memoryStorage() })).toThrow(TypeError);
  });

  it('builds the same name as @simple-web-tools/storage', () => {
    for (const app of ['chrono', 'locavern', 'my-app2']) {
      expect(localePreferenceKey(app)).toBe(storageName(app, 'locale'));
    }
  });
});
