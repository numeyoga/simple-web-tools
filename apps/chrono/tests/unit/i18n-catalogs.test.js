/// <reference types="vite/client" />
// The catalogs of the interface (decision 0002): French matches English, every key the code
// asks for exists, every key is used, and the plural messages pick the right form.
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
    expect(keys.length).toBeGreaterThan(100);
  });

  test('every key exists in the English catalog', () => {
    expect([...new Set(keys)].filter((key) => !known.has(key))).toEqual([]);
  });

  test('every key of the English catalog is used', () => {
    const used = new Set(keys);
    expect([...known].filter((key) => !used.has(key))).toEqual([]);
  });
});

describe('plurals', () => {
  /** @param {string} locale */
  const translator = (locale) => createTranslator({ locale, catalogs });

  test('French: 0 and 1 are singular, 2 and more plural', () => {
    const { t } = translator('fr');
    expect(t('common.sessionsCount', { count: 0 })).toBe('0 session');
    expect(t('common.sessionsCount', { count: 1 })).toBe('1 session');
    expect(t('common.sessionsCount', { count: 2 })).toBe('2 sessions');
    expect(t('shell.toasts.stopped', { count: 1 })).toBe('Chrono arrêté');
    expect(t('shell.toasts.stopped', { count: 3 })).toBe('Chronos arrêtés');
    expect(t('timers.heading', { count: 1 })).toBe('Chrono actif');
    expect(t('timers.heading', { count: 2 })).toBe('2 chronos en parallèle');
    expect(t('timers.topRunning', { count: 2 })).toBe('chronos en cours');
    expect(t('projects.todosTag', { count: 1 })).toBe('1 todo');
    expect(t('projects.todosTag', { count: 0 })).toBe('0 todo');
    expect(t('report.weeksAgo', { count: 3 })).toBe('Il y a 3 semaines');
    expect(t('report.weeksAhead', { count: 2 })).toBe('Dans 2 semaines');
  });

  test('English: only 1 is singular', () => {
    const { t } = translator('en');
    expect(t('common.sessionsCount', { count: 0 })).toBe('0 sessions');
    expect(t('common.sessionsCount', { count: 1 })).toBe('1 session');
    expect(t('common.sessionsCount', { count: 2 })).toBe('2 sessions');
    expect(t('shell.toasts.stopped', { count: 1 })).toBe('Timer stopped');
    expect(t('shell.toasts.stopped', { count: 2 })).toBe('Timers stopped');
    expect(t('timers.heading', { count: 1 })).toBe('Active timer');
    expect(t('timers.heading', { count: 4 })).toBe('4 timers in parallel');
    expect(t('timers.topRunning', { count: 1 })).toBe('timer running');
    expect(t('projects.todosTag', { count: 1 })).toBe('1 to-do');
    expect(t('projects.todosTag', { count: 5 })).toBe('5 to-dos');
    expect(t('report.weeksAgo', { count: 1 })).toBe('1 week ago');
    expect(t('report.spreadOver', { count: 1 })).toBe('across 1 day');
    expect(t('projects.clientsKnown', { count: 2 })).toBe(
      '2 clients already entered, or type a new name',
    );
  });

  test('a message made of plural parts reads well in both languages', () => {
    const params = {
      name: 'Orion',
      sessions: 'S',
      tasks: 'T',
    };
    expect(translator('fr').t('projects.deleteWith', params)).toBe(
      'Le projet « Orion » sera supprimé avec S et T. Tu ne pourras pas annuler.',
    );
    expect(translator('en').t('projects.deleteWith', params)).toBe(
      'Project “Orion” will be deleted along with S and T. You cannot undo this.',
    );
  });

  test('a count is written with the separators of the language', () => {
    expect(translator('en').t('common.sessionsCount', { count: 1234 })).toBe('1,234 sessions');
    expect(translator('fr').t('common.sessionsCount', { count: 1234 })).toMatch(
      /^1\s234 sessions$/,
    );
  });
});
