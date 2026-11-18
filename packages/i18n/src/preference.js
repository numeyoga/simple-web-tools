// Saved manual language override (decision 0002), kept in the app's own storage name
// (decision 0005).

/**
 * The part of `Storage` the preference needs. `localStorage` satisfies it.
 * @typedef {object} PreferenceStorage
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/**
 * @typedef {object} LocalePreference
 * @property {() => string | null} get the saved locale, or `null` when none is saved or storage fails
 * @property {(locale: string | null) => boolean} set save a locale, or clear it with `null`; `false` when storage refused
 */

const APP_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Same name as `storageName(app, 'locale')` from `@simple-web-tools/storage`. Rebuilt here
 * because that package's only entry point also loads its IndexedDB code (the `idb` library),
 * which a language switch has no use for. A test checks that the two stay identical.
 * @param {string} app
 * @returns {string}
 */
export function localePreferenceKey(app) {
  if (typeof app !== 'string' || app.length > 32 || !APP_NAME.test(app)) {
    throw new TypeError(
      `Invalid app name ${JSON.stringify(app)}: use lowercase letters, digits and hyphens, starting with a letter.`,
    );
  }
  return `${app}-locale`;
}

/**
 * Remember the user's manual language choice under `<app>-locale`. The stored value is not
 * validated here: pass it through `negotiateLocale` with the supported locales, so a locale
 * dropped in a later release degrades to the default instead of breaking the app.
 *
 * Storage can throw (blocked, full, private mode): `get` then returns `null` and `set`
 * returns `false`.
 *
 * @param {object} input
 * @param {string} input.app app name, the storage prefix
 * @param {PreferenceStorage} input.storage usually `localStorage`, injected for tests
 * @returns {LocalePreference}
 */
export function createLocalePreference({ app, storage }) {
  const key = localePreferenceKey(app);
  return {
    get() {
      try {
        const value = storage.getItem(key);
        return value ? value : null;
      } catch {
        return null;
      }
    },
    set(locale) {
      try {
        if (locale === null || locale === '') storage.removeItem(key);
        else storage.setItem(key, locale);
        return true;
      } catch {
        return false;
      }
    },
  };
}
