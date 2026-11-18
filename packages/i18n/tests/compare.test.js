import { describe, expect, it } from 'vitest';
import {
  NO_DIFFERENCES,
  compareCatalogs,
  flattenCatalog,
  requiredPluralCategories,
} from '../src/index.js';

const en = {
  title: 'Tasks',
  nav: { home: 'Home', about: 'About' },
  hello: 'Hello {name}',
  items: { one: '{count} item', other: '{count} items' },
};

describe('compareCatalogs', () => {
  it('reports nothing for matching catalogs, nested or flat', () => {
    const fr = {
      title: 'Tâches',
      'nav.home': 'Accueil',
      nav: { about: 'À propos' },
      hello: 'Bonjour {name}',
      items: { one: '{count} élément', other: '{count} éléments' },
    };
    expect(compareCatalogs(en, fr, { locale: 'fr' })).toEqual(NO_DIFFERENCES);
  });

  it('reports missing and extra keys', () => {
    const fr = {
      title: 'Tâches',
      nav: { home: 'Accueil' },
      hello: 'Bonjour {name}',
      extra: 'x',
      items: en.items,
    };
    const result = compareCatalogs(en, fr);
    expect(result.missing).toEqual(['nav.about']);
    expect(result.extra).toEqual(['extra']);
  });

  it('reports placeholder mismatches in both directions', () => {
    const fr = {
      ...en,
      hello: 'Bonjour {nom}',
      title: 'Tâches pour {user}',
    };
    expect(compareCatalogs(en, fr).placeholderMismatches).toEqual([
      { key: 'title', expected: [], actual: ['user'] },
      { key: 'hello', expected: ['name'], actual: ['nom'] },
    ]);
  });

  it('checks placeholders across all plural variants', () => {
    const fr = { ...en, items: { one: 'Un élément', other: '{total} éléments' } };
    expect(compareCatalogs(en, fr).placeholderMismatches).toEqual([
      { key: 'items', expected: ['count'], actual: ['total'] },
    ]);
  });

  it('accepts a plural variant that omits {count} when another keeps it', () => {
    const fr = { ...en, items: { one: 'Un élément', other: '{count} éléments' } };
    expect(compareCatalogs(en, fr, { locale: 'fr' })).toEqual(NO_DIFFERENCES);
  });

  it('reports plural category gaps for the locale', () => {
    const base = { ...en };
    const ru = { ...base, items: { one: '{count} штука', other: '{count} штук' } };
    expect(compareCatalogs(en, ru, { locale: 'ru' }).pluralGaps).toEqual([
      { key: 'items', missing: ['few', 'many'] },
    ]);
    const frMissingOther = {
      ...base,
      items: { one: '{count} élément', other: '{count} éléments' },
    };
    expect(compareCatalogs(en, frMissingOther, { locale: 'fr' }).pluralGaps).toEqual([]);
  });

  it('only requires "other" when no locale is given', () => {
    const ru = { ...en, items: { other: '{count} штук' } };
    expect(compareCatalogs(en, ru).pluralGaps).toEqual([]);
  });

  it('reports a plural message translated as a plain string, and the reverse', () => {
    const fr = { ...en, items: '{count} éléments', hello: { one: 'a', other: 'b {name}' } };
    expect(compareCatalogs(en, fr, { locale: 'fr' }).pluralGaps).toEqual(
      [
        { key: 'hello', missing: ['shape'] },
        { key: 'items', missing: ['shape'] },
      ].sort((a, b) => Object.keys(en).indexOf(a.key) - Object.keys(en).indexOf(b.key)),
    );
  });

  it('does not require exact-count variants', () => {
    const withExact = { ...en, items: { '=0': 'None', ...en.items } };
    expect(compareCatalogs(withExact, en, { locale: 'en' }).missing).toEqual([]);
  });
});

describe('requiredPluralCategories', () => {
  it('lists the categories whole counts reach', () => {
    expect(requiredPluralCategories('en')).toEqual(['one', 'other']);
    expect(requiredPluralCategories('fr')).toEqual(['one', 'other']);
    expect(requiredPluralCategories('ru').sort()).toEqual(['few', 'many', 'one', 'other']);
    expect(requiredPluralCategories('ar').sort()).toEqual([
      'few',
      'many',
      'one',
      'other',
      'two',
      'zero',
    ]);
    expect(requiredPluralCategories('ja')).toEqual(['other']);
  });
});

describe('flattenCatalog', () => {
  it('flattens nested objects and keeps plural messages whole', () => {
    expect(flattenCatalog({ a: { b: 'x', c: { one: '1', other: 'n' } }, 'd.e': 'y' })).toEqual({
      'a.b': 'x',
      'a.c': { one: '1', other: 'n' },
      'd.e': 'y',
    });
  });

  it('ignores values that are neither strings nor objects', () => {
    expect(flattenCatalog(/** @type {any} */ ({ a: 1, b: null, c: 'ok', d: ['x'] }))).toEqual({
      c: 'ok',
    });
  });
});
