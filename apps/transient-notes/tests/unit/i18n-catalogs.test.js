/// <reference types="vite/client" />
// The catalogs of the interface (decision 0002): French matches English, every key the code
// asks for exists, every key is used, and the plural messages pick the right form.
import { UI_KEYS } from '@simple-web-tools/dom/ui';
import {
  NO_DIFFERENCES,
  compareCatalogs,
  createTranslator,
  flattenCatalog,
} from '@simple-web-tools/i18n';
import { describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.js';
import fr from '../../src/i18n/fr.js';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, catalogs } from '../../src/i18n/index.js';
import { translationKeys } from './support/ui-text-rules.js';

const sources = /** @type {Record<string, string>} */ (
  import.meta.glob('../../src/**/*.js', { query: '?raw', import: 'default', eager: true })
);

/** The keys `t()` and `tNodes()` are called with, and the calls whose key is not a plain string. */
function usedKeys() {
  const keys = /** @type {string[]} */ ([]);
  const dynamic = /** @type {string[]} */ ([]);
  for (const [path, code] of Object.entries(sources)) {
    const found = translationKeys(code, path);
    expect(found.problems, path).toEqual([]);
    keys.push(...found.keys);
    dynamic.push(...found.dynamic);
  }
  return { keys, dynamic };
}

describe('catalogs', () => {
  test('French matches English: same keys, placeholders and plural forms', () => {
    expect(compareCatalogs(en, fr, { locale: 'fr' })).toEqual(NO_DIFFERENCES);
  });

  test('English has the forms English needs', () => {
    expect(compareCatalogs(en, en, { locale: 'en' })).toEqual(NO_DIFFERENCES);
  });

  test('the locales of the interface are English and French, English is the default', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'fr']);
    expect(DEFAULT_LOCALE).toBe('en');
    expect(catalogs).toEqual({ en, fr });
  });

  test('a message has no exclamation mark and no markup (Covenant voice)', () => {
    for (const [name, catalog] of Object.entries({ en, fr })) {
      for (const [key, message] of Object.entries(flattenCatalog(catalog))) {
        const forms = typeof message === 'string' ? [message] : Object.values(message);
        for (const form of forms) {
          expect(form, `${name}:${key}`).not.toMatch(/!|<[a-z/]/i);
        }
      }
    }
  });
});

describe('the keys used in src', () => {
  const { keys, dynamic } = usedKeys();
  const known = new Set(Object.keys(flattenCatalog(en)));

  test('every key given to t() is a plain string', () => {
    expect(dynamic).toEqual([]);
    expect(keys.length).toBeGreaterThan(50);
  });

  test('every key exists in the English catalog', () => {
    expect([...new Set(keys)].filter((key) => !known.has(key))).toEqual([]);
  });

  test('every key the shared builders ask for exists (UI_KEYS of @simple-web-tools/dom)', () => {
    expect(UI_KEYS.filter((key) => !known.has(key))).toEqual([]);
  });

  test('every key of the English catalog is used', () => {
    // The shared builders (a modal, a confirmation, the toasts) use the UI_KEYS themselves.
    const used = new Set([...keys, ...UI_KEYS]);
    expect([...known].filter((key) => !used.has(key))).toEqual([]);
  });
});

describe('plurals', () => {
  /** @param {string} locale */
  const translator = (locale) => createTranslator({ locale, catalogs });

  test('French: 0 and 1 are singular, 2 and more plural', () => {
    const { t } = translator('fr');
    expect(t('notes.count', { count: 0 })).toBe('0 note');
    expect(t('notes.count', { count: 1 })).toBe('1 note');
    expect(t('notes.count', { count: 2 })).toBe('2 notes');
  });

  test('English: no notes, one note, several notes', () => {
    const { t } = translator('en');
    expect(t('notes.count', { count: 0 })).toBe('No notes');
    expect(t('notes.count', { count: 1 })).toBe('1 note');
    expect(t('notes.count', { count: 1234 })).toBe('1,234 notes');
  });
});
