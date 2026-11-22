/// <reference types="vite/client" />
// Which language the interface speaks: the saved choice, else the browser's languages, else
// English. The early `lang` of public/theme-init.js follows the same rule.
import { createLocalePreference, localePreferenceKey } from '@simple-web-tools/i18n';
import { describe, expect, test } from 'vitest';
import { parseLocaleChoice, resolveFormatLocale, resolveLocale } from '../../src/core/locale.js';
import { localeKey } from '../../src/adapters/names.js';
import { fakeLocalStorage } from './support/browser.js';

const themeInit = /** @type {Record<string, string>} */ (
  import.meta.glob('../../public/theme-init.js', { query: '?raw', import: 'default', eager: true })
);

describe('the saved choice', () => {
  test('reads en and fr, and treats anything else as automatic', () => {
    expect(parseLocaleChoice('en')).toBe('en');
    expect(parseLocaleChoice('fr')).toBe('fr');
    for (const raw of [null, undefined, '', 'auto', 'de', 'FR', 'fr-FR', 'en-US', ' fr']) {
      expect(parseLocaleChoice(raw)).toBeNull();
    }
  });

  test('is stored under slides-locale, the name of the package and of the app agree', () => {
    expect(localeKey()).toBe('slides-locale');
    expect(localePreferenceKey('slides')).toBe(localeKey());
    const storage = fakeLocalStorage();
    const preference = createLocalePreference({ app: 'slides', storage });
    expect(parseLocaleChoice(preference.get())).toBeNull();
    preference.set('fr');
    expect(storage.keys()).toEqual(['slides-locale']);
    expect(parseLocaleChoice(preference.get())).toBe('fr');
    preference.set(null);
    expect(storage.keys()).toEqual([]);
  });
});

/** Matrix: what the browser says, what was saved, the language that results. */
const CASES = /** @type {const} */ ([
  [['fr-FR'], null, 'fr'],
  [['fr'], null, 'fr'],
  [['fr-CA', 'en'], null, 'fr'],
  [['fr-BE', 'fr', 'en-US'], null, 'fr'],
  [['en-US'], null, 'en'],
  [['en-GB', 'fr'], null, 'en'],
  [['de-DE'], null, 'en'],
  [['de-DE', 'fr-FR'], null, 'fr'],
  [['ja', 'zh-Hant-TW', 'es'], null, 'en'],
  [[], null, 'en'],
  [['fr-FR'], 'en', 'en'],
  [['en-US'], 'fr', 'fr'],
  [['de-DE'], 'fr', 'fr'],
  [['fr-FR'], 'auto', 'fr'],
  [['fr-FR'], 'de', 'fr'],
  [['en-US'], 'de', 'en'],
  [['fr-FR'], '', 'fr'],
]);

describe('the language of the interface', () => {
  for (const [languages, stored, expected] of CASES) {
    test(`${JSON.stringify(languages)} with ${JSON.stringify(stored)} gives ${expected}`, () => {
      expect(resolveLocale({ stored, languages })).toBe(expected);
    });
  }

  test('falls back to English without any information', () => {
    expect(resolveLocale({})).toBe('en');
    expect(resolveLocale({ stored: null, languages: null })).toBe('en');
  });

  test('the choice does not depend on the case or on the underscore of a tag', () => {
    expect(resolveLocale({ languages: ['FR_fr'] })).toBe('fr');
    expect(resolveLocale({ languages: ['*', 'fr'] })).toBe('fr');
  });
});

/** The region table: [browser languages, saved choice, locale of the translator]. */
const REGIONS = /** @type {const} */ ([
  [['en-GB'], null, 'en-GB'],
  [['en-US'], null, 'en-US'],
  [['fr-CA'], null, 'fr-CA'],
  [['fr-FR'], null, 'fr-FR'],
  [['fr'], null, 'fr'],
  [['de-DE'], null, 'en'],
  [['de-DE', 'fr-CH'], null, 'fr-CH'],
  [['en-GB', 'fr-CA'], null, 'en-GB'],
  [['en_gb'], null, 'en-GB'],
  [['en-GB'], 'fr', 'fr'],
  [['en-GB', 'fr-CA'], 'fr', 'fr-CA'],
  [['fr-CA'], 'en', 'en'],
  [['fr-CA', 'en-AU'], 'en', 'en-AU'],
  [['fr-FR'], 'auto', 'fr-FR'],
  [[], 'fr', 'fr'],
  [[], null, 'en'],
  [['*', 'fr-BE'], null, 'fr-BE'],
]);

describe('the locale of the translator keeps the region', () => {
  for (const [languages, stored, expected] of REGIONS) {
    test(`${JSON.stringify(languages)} with ${JSON.stringify(stored)} gives ${expected}`, () => {
      expect(resolveFormatLocale({ stored, languages })).toBe(expected);
    });
  }

  test('its language is always the one resolveLocale chooses', () => {
    for (const [languages, stored] of [...CASES, ...REGIONS]) {
      expect(resolveFormatLocale({ stored, languages }).split('-')[0]).toBe(
        resolveLocale({ stored, languages }),
      );
    }
  });
});

describe('public/theme-init.js sets <html lang> before the first paint, by the same rule', () => {
  const script = Object.values(themeInit)[0] ?? '';

  /**
   * @param {readonly string[]} languages
   * @param {string | null} stored
   */
  function langAfterRunning(languages, stored) {
    const storage = fakeLocalStorage();
    if (stored !== null) storage.setItem('slides-locale', stored);
    const documentElement = { lang: 'unset', dataset: /** @type {Record<string, string>} */ ({}) };
    const fakeDocument = { documentElement, querySelector: () => null };
    const fakeWindow = { matchMedia: () => ({ matches: false }) };
    new Function('document', 'window', 'localStorage', 'navigator', script)(
      fakeDocument,
      fakeWindow,
      storage,
      { languages },
    );
    return documentElement.lang;
  }

  test('there is a script to check', () => {
    expect(script).toContain('slides-locale');
  });

  for (const [languages, stored] of [...CASES, ...REGIONS]) {
    const expected = resolveFormatLocale({ stored, languages });
    test(`${JSON.stringify(languages)} with ${JSON.stringify(stored)} gives ${expected}`, () => {
      expect(langAfterRunning(languages, stored)).toBe(expected);
    });
  }
});
