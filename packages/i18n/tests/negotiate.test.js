import { describe, expect, it } from 'vitest';
import { negotiateLocale } from '../src/index.js';

const supported = ['en', 'fr'];
/** @type {(requested: any, overrides?: { fallback?: string }) => string} */
const negotiate = (requested, overrides = {}) =>
  negotiateLocale({ requested, supported, fallback: 'en', ...overrides });

describe('negotiateLocale', () => {
  it('matches exactly', () => {
    expect(negotiate(['fr'])).toBe('fr');
  });

  it('matches a regional tag to its language', () => {
    expect(negotiate(['fr-CA'])).toBe('fr');
    expect(negotiate(['fr-CA-x-private'])).toBe('fr');
  });

  it('is case-insensitive and accepts underscores, and returns the supported spelling', () => {
    expect(negotiate(['FR-ca'])).toBe('fr');
    expect(negotiate(['fr_FR'])).toBe('fr');
    expect(negotiateLocale({ requested: ['pt-br'], supported: ['pt-BR'], fallback: 'en' })).toBe(
      'pt-BR',
    );
  });

  it('keeps the order of preference', () => {
    expect(negotiate(['fr-CA', 'en'])).toBe('fr');
    expect(negotiate(['en-GB', 'fr'])).toBe('en');
    expect(negotiate(['de', 'fr', 'en'])).toBe('fr');
  });

  it('prefers a more specific supported tag, then falls back to the language', () => {
    const regional = ['en', 'fr', 'fr-CA'];
    expect(negotiateLocale({ requested: ['fr-CA'], supported: regional, fallback: 'en' })).toBe(
      'fr-CA',
    );
    expect(negotiateLocale({ requested: ['fr-BE'], supported: regional, fallback: 'en' })).toBe(
      'fr',
    );
  });

  it('matches a bare language to a regional supported tag', () => {
    expect(negotiateLocale({ requested: ['fr'], supported: ['en', 'fr-FR'], fallback: 'en' })).toBe(
      'fr-FR',
    );
  });

  it('drops subtags progressively', () => {
    expect(
      negotiateLocale({ requested: ['zh-Hant-TW'], supported: ['en', 'zh-Hant'], fallback: 'en' }),
    ).toBe('zh-Hant');
  });

  it('returns the fallback when nothing matches or nothing is requested', () => {
    expect(negotiate(['de', 'ja'], { fallback: 'fr' })).toBe('fr');
    expect(negotiate([])).toBe('en');
    expect(negotiate(undefined)).toBe('en');
  });

  it('skips junk entries', () => {
    expect(negotiate(['', '*', 'x', 'fr fr', null, 42, 'fr'])).toBe('fr');
  });

  it('does not confuse languages that share a prefix', () => {
    expect(negotiateLocale({ requested: ['fil'], supported: ['fi', 'fr'], fallback: 'en' })).toBe(
      'en',
    );
  });

  it('ignores a malformed supported entry', () => {
    expect(negotiateLocale({ requested: ['fr'], supported: ['??', 'fr'], fallback: 'en' })).toBe(
      'fr',
    );
  });
});
