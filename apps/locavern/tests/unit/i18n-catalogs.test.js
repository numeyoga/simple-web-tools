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
const page = /** @type {Record<string, string>} */ (
  import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true })
);

/**
 * The keys `t()`, `failure()` and `new LocavernError()` are called with, the calls whose key is
 * not a plain string, and the keys the markup of index.html asks for (`data-i18n`).
 */
function usedKeys() {
  const keys = /** @type {string[]} */ ([]);
  const dynamic = /** @type {string[]} */ ([]);
  for (const [path, code] of Object.entries(sources)) {
    const found = translationKeys(code, path);
    expect(found.problems, path).toEqual([]);
    keys.push(...found.keys);
    dynamic.push(...found.dynamic);
  }
  const html = Object.values(page)[0] ?? '';
  for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) keys.push(match[1] ?? '');
  for (const match of html.matchAll(/data-i18n-attrs="([^"]+)"/g)) {
    for (const pair of (match[1] ?? '').split(';')) keys.push(pair.split(':')[1] ?? '');
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

  test('an English message is not left in French, and a French one is not a copy of English', () => {
    // The few words that are the same in both languages: names, figures, formats.
    const same = new Set(
      Object.keys(flattenCatalog(en)).filter((key) => {
        const a = flattenCatalog(en)[key];
        const b = flattenCatalog(fr)[key];
        return JSON.stringify(a) === JSON.stringify(b);
      }),
    );
    // Not an assertion about wording: a catalog that is mostly identical is a copy.
    expect(same.size).toBeLessThan(Object.keys(flattenCatalog(en)).length / 4);
  });
});

describe('the keys used in src and in index.html', () => {
  const { keys, dynamic } = usedKeys();
  const known = new Set(Object.keys(flattenCatalog(en)));

  test('every key given to t() is a plain string', () => {
    expect(dynamic).toEqual([]);
    expect(keys.length).toBeGreaterThan(300);
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
    expect(t('common.tasksCount', { count: 0 })).toBe('0 tâche');
    expect(t('common.tasksCount', { count: 1 })).toBe('1 tâche');
    expect(t('common.tasksCount', { count: 2 })).toBe('2 tâches');
    expect(t('common.whiteboardsCount', { count: 1 })).toBe('1 tableau blanc');
    expect(t('common.whiteboardsCount', { count: 3 })).toBe('3 tableaux blancs');
    expect(t('trash.purgeIn', { count: 1 })).toBe('Purge dans 1 jour');
    expect(t('trash.purgeIn', { count: 12 })).toBe('Purge dans 12 jours');
    expect(t('backup.age.days', { count: 4 })).toBe('Il y a 4 jours');
    expect(t('today.lateBy', { count: 1, date: '15 nov.' })).toBe('1 j de retard (15 nov.)');
    expect(t('today.lateBy', { count: 3, date: '15 nov.' })).toBe('3 j de retard (15 nov.)');
    expect(t('whiteboard.duplicated', { count: 1 })).toBe('Élément dupliqué');
    expect(t('whiteboard.duplicated', { count: 3 })).toBe('3 éléments dupliqués');
  });

  test('French keeps the wording that never had a singular', () => {
    const { t } = translator('fr');
    expect(t('backup.count.pl.projects', { count: 1 })).toBe('1 projets');
    expect(t('backup.count.sp.tasks', { count: 1 })).toBe('1 tâche(s)');
    expect(t('whiteboard.selected', { count: 1 })).toBe('1 élément(s) sélectionné(s)');
  });

  test('English: only 1 is singular', () => {
    const { t } = translator('en');
    expect(t('common.tasksCount', { count: 0 })).toBe('0 tasks');
    expect(t('common.tasksCount', { count: 1 })).toBe('1 task');
    expect(t('common.whiteboardsCount', { count: 1 })).toBe('1 whiteboard');
    expect(t('common.whiteboardsCount', { count: 3 })).toBe('3 whiteboards');
    expect(t('trash.purgeIn', { count: 1 })).toBe('Purged in 1 day');
    expect(t('backup.age.days', { count: 1 })).toBe('1 day ago');
    expect(t('today.lateBy', { count: 1, date: 'Nov 15' })).toBe('1 day overdue (Nov 15)');
    expect(t('today.lateBy', { count: 3, date: 'Nov 15' })).toBe('3 days overdue (Nov 15)');
    expect(t('whiteboard.duplicated', { count: 1 })).toBe('Element duplicated');
    expect(t('statuses.updatedText', { count: 1 })).toBe('1 status configured for the Kanban.');
    expect(t('statuses.updatedText', { count: 2 })).toBe('2 statuses configured for the Kanban.');
  });

  test('a message made of counted parts reads well in both languages', () => {
    const parts = (/** @type {string} */ locale) => {
      const { t, formatList } = translator(locale);
      return t('backup.export.included', {
        items: formatList([
          t('backup.count.pl.projects', { count: 2 }),
          t('backup.count.pl.tasks', { count: 5 }),
          t('backup.count.pl.notes', { count: 1 }),
          t('backup.count.pl.whiteboards', { count: 0 }),
        ]),
      });
    };
    expect(parts('fr')).toBe('2 projets, 5 tâches, 1 notes et 0 tableaux blancs inclus.');
    expect(parts('en')).toBe('2 projects, 5 tasks, 1 note, and 0 whiteboards included.');
  });

  test('a count is written with the separators of the language', () => {
    expect(translator('en').t('common.tasksCount', { count: 1234 })).toBe('1,234 tasks');
    expect(translator('fr').t('common.tasksCount', { count: 1234 })).toMatch(/^1\s234 tâches$/);
  });
});
