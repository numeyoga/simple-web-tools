import { describe, it, expect, vi } from 'vitest';
import { createTranslator } from '../src/index.js';

const en = {
  app: { title: 'Tasks' },
  'flat.key': 'Flat',
  greeting: 'Hello {name}, you have {n} tasks',
  tasks: { '=0': 'No tasks', one: '{count} task', other: '{count} tasks' },
  onlyEn: 'English only',
  nested: { deep: { leaf: 'Deep' } },
};
const fr = {
  app: { title: 'Tâches' },
  greeting: 'Bonjour {name}, vous avez {n} tâches',
  tasks: { one: '{count} tâche', many: '{count} de tâches', other: '{count} tâches' },
};
const catalogs = { en, fr };

function make(locale = 'fr', extra = {}) {
  /** @type {import('../src/index.js').MissingEvent[]} */
  const missing = [];
  const translator = createTranslator({
    locale,
    catalogs,
    onMissing: (event) => missing.push(event),
    ...extra,
  });
  return { ...translator, missing };
}

describe('lookup', () => {
  it('reads nested, flat and deeply nested keys', () => {
    const { t } = make('en');
    expect(t('app.title')).toBe('Tasks');
    expect(t('flat.key')).toBe('Flat');
    expect(t('nested.deep.leaf')).toBe('Deep');
  });

  it('exposes its locale', () => {
    expect(make('fr').locale).toBe('fr');
  });

  it('translates into the requested locale', () => {
    expect(make('fr').t('app.title')).toBe('Tâches');
  });
});

describe('interpolation', () => {
  it('fills {name} placeholders, numbers included, and ignores extra params', () => {
    const { t } = make('en');
    expect(t('greeting', { name: 'Ada', n: 3, unused: 1 })).toBe('Hello Ada, you have 3 tasks');
  });

  it('keeps a falsy but defined value', () => {
    expect(make('en').t('greeting', { name: '', n: 0 })).toBe('Hello , you have 0 tasks');
  });

  it('leaves a visible marker for a missing param, never "undefined", and reports it', () => {
    const translator = make('en');
    expect(translator.t('greeting', { name: 'Ada' })).toBe('Hello Ada, you have {n} tasks');
    expect(translator.t('greeting', { name: 'Ada', n: undefined })).not.toContain('undefined');
    expect(translator.missing[0]).toEqual({
      type: 'param',
      key: 'greeting',
      locale: 'en',
      param: 'n',
    });
  });

  it('does not read inherited properties as params', () => {
    expect(make('en').t('greeting', { name: 'A', n: 1, toString: undefined })).toContain('A');
    expect(make('en').t('greeting', {})).toBe('Hello {name}, you have {n} tasks');
  });
});

describe('plurals', () => {
  it('selects English categories and an exact =0', () => {
    const { t } = make('en');
    expect(t('tasks', { count: 0 })).toBe('No tasks');
    expect(t('tasks', { count: 1 })).toBe('1 task');
    expect(t('tasks', { count: 2 })).toBe('2 tasks');
  });

  it('treats 0 and 1 as French "one"', () => {
    const { t } = make('fr');
    expect(t('tasks', { count: 0 })).toBe('0 tâche');
    expect(t('tasks', { count: 1 })).toBe('1 tâche');
    expect(t('tasks', { count: 1.5 })).toBe('1,5 tâche');
    expect(t('tasks', { count: 2 })).toBe('2 tâches');
  });

  it('uses the French "many" category for millions', () => {
    expect(make('fr').t('tasks', { count: 1_000_000 })).toMatch(/de tâches$/);
  });

  it('formats {count} for the locale', () => {
    expect(make('en').t('tasks', { count: 1234 })).toBe('1,234 tasks');
    expect(make('fr').t('tasks', { count: 1234 })).toMatch(/^1\s234 tâches$/);
  });

  it('falls back to "other" and marks {count} when count is missing or not a number', () => {
    const translator = make('en');
    expect(translator.t('tasks')).toBe('{count} tasks');
    expect(translator.t('tasks', { count: 'x' })).toBe('x tasks');
    expect(translator.missing[0]?.param).toBe('count');
  });

  it('falls back to "other" when the category variant is absent', () => {
    const catalog = { en: { k: { other: '{count} things' } } };
    const { t } = createTranslator({ locale: 'en', catalogs: catalog });
    expect(t('k', { count: 1 })).toBe('1 things');
  });

  it('plural rules follow the catalog the message came from', () => {
    // 'de' has no catalog entry for this key: the English message is used, with English rules.
    const { t } = createTranslator({
      locale: 'fr',
      catalogs: { en: { k: { one: 'one', other: 'other' } }, fr: {} },
    });
    expect(t('k', { count: 0 })).toBe('other');
  });
});

describe('fallback chain', () => {
  it('uses the fallback locale for a key the locale lacks, without reporting it', () => {
    const translator = make('fr');
    expect(translator.t('onlyEn')).toBe('English only');
    expect(translator.missing).toEqual([]);
  });

  it('tries the base language of a regional locale before the fallback', () => {
    const translator = make('fr-CA');
    expect(translator.t('app.title')).toBe('Tâches');
    expect(translator.t('onlyEn')).toBe('English only');
    expect(translator.locale).toBe('fr-CA');
  });

  it('honours a custom fallback locale', () => {
    const { t } = createTranslator({
      locale: 'en',
      fallbackLocale: 'fr',
      catalogs: { en: {}, fr: { only: 'seulement' } },
    });
    expect(t('only')).toBe('seulement');
  });

  it('works for a locale without a catalog', () => {
    expect(make('de').t('app.title')).toBe('Tasks');
  });

  it('returns the key and reports it when no catalog has it', () => {
    const onMissing = vi.fn();
    const { t } = createTranslator({ locale: 'fr', catalogs, onMissing });
    expect(t('nope.nothing')).toBe('nope.nothing');
    expect(onMissing).toHaveBeenCalledExactlyOnceWith({
      type: 'key',
      key: 'nope.nothing',
      locale: 'fr',
    });
  });

  it('is silent without onMissing', () => {
    const spy = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    expect(createTranslator({ locale: 'en', catalogs }).t('nope')).toBe('nope');
    expect(spy).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not resolve a namespace as a message', () => {
    expect(make('en').t('app')).toBe('app');
  });

  it('rejects a malformed locale tag immediately', () => {
    expect(() => createTranslator({ locale: 'not a locale', catalogs })).toThrow(RangeError);
  });
});

describe('formatting helpers', () => {
  it('formats numbers and lists for the locale', () => {
    expect(make('en').formatNumber(1234.5)).toBe('1,234.5');
    expect(make('fr').formatNumber(1234.5)).toMatch(/^1\s234,5$/);
    expect(make('en').formatNumber(0.5, { style: 'percent' })).toBe('50%');
    expect(make('en').formatList(['a', 'b', 'c'])).toBe('a, b, and c');
    expect(make('fr').formatList(['a', 'b', 'c'])).toBe('a, b et c');
    expect(make('en').formatList(['a', 'b'], { type: 'disjunction' })).toBe('a or b');
  });

  it('formats relative times, with words for -1 and +1 by default', () => {
    expect(make('en').formatRelativeTime(-1, 'day')).toBe('yesterday');
    expect(make('fr').formatRelativeTime(1, 'day')).toBe('demain');
    expect(make('en').formatRelativeTime(-3, 'hour')).toBe('3 hours ago');
    expect(make('en').formatRelativeTime(-1, 'day', { numeric: 'always' })).toBe('1 day ago');
  });

  it('formats date-times from a Date or a timestamp', () => {
    const ms = Date.UTC(2026, 10, 18, 11, 5); // 12:05 in Paris (CET)
    /** @type {Intl.DateTimeFormatOptions} */
    const options = { hour: '2-digit', minute: '2-digit' };
    expect(make('fr').formatDateTime(ms, options)).toBe('12:05');
    expect(make('fr').formatDateTime(new Date(ms), options)).toBe('12:05');
    expect(make('en').formatDateTime(ms, { timeZone: 'UTC', timeStyle: 'short' })).toMatch(
      /^11:05\sAM$/,
    );
    expect(make('en').formatDateTime(ms)).toMatch(/Nov 18, 2026/);
  });
});

describe('formatDuration', () => {
  it('prints the locale-neutral clock form used by Chrono', () => {
    const { formatDuration } = make('fr');
    expect(formatDuration(0, { style: 'clock' })).toBe('00:00');
    expect(formatDuration(65, { style: 'clock' })).toBe('01:05');
    expect(formatDuration(600, { style: 'clock' })).toBe('10:00');
    expect(formatDuration(-5, { style: 'clock' })).toBe('00:00');
    expect(formatDuration(65.9, { style: 'clock' })).toBe('01:05');
  });

  it('spells out units in the locale', () => {
    expect(make('en').formatDuration(65, { style: 'long' })).toBe('1 hour, 5 minutes');
    expect(make('en').formatDuration(120, { style: 'long' })).toBe('2 hours');
    expect(make('en').formatDuration(45)).toBe('45 min');
    expect(make('fr').formatDuration(65, { style: 'short' })).toMatch(/^1\sh.*5\smin$/);
  });

  it('prints zero in minutes', () => {
    expect(make('en').formatDuration(0)).toBe('0 min');
    expect(make('en').formatDuration(Number.NaN)).toBe('0 min');
  });
});
