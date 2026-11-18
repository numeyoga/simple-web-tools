import { parseIsoDate } from '@simple-web-tools/dates';
import {
  dateTimeFormat,
  durationFormat,
  listFormat,
  numberFormat,
  pluralRules,
  relativeTimeFormat,
} from './formatters.js';
import { flattenCatalog, interpolate, isPluralMessage, selectPlural } from './messages.js';

/**
 * @typedef {object} MissingEvent
 * @property {'key' | 'param'} type `key`: no catalog has the key; `param`: a placeholder had no value
 * @property {string} key
 * @property {string} locale the translator's locale
 * @property {string} [param] the placeholder name, for `param`
 */

/**
 * @typedef {object} TranslatorOptions
 * @property {string} locale locale to translate into, for example `fr`
 * @property {Record<string, import('./messages.js').Catalog>} catalogs catalogs by locale
 * @property {string} [fallbackLocale] used for keys the locale lacks; default `en`
 * @property {(event: MissingEvent) => void} [onMissing] called for a missing key or parameter
 */

/**
 * @typedef {object} Translator
 * @property {string} locale
 * @property {(key: string, params?: Record<string, unknown>) => string} t
 * @property {(isoDate: string, options?: Intl.DateTimeFormatOptions) => string} formatDate
 * @property {(value: Date | number, options?: Intl.DateTimeFormatOptions) => string} formatDateTime
 * @property {(value: number, options?: Intl.NumberFormatOptions) => string} formatNumber
 * @property {(items: readonly string[], options?: Intl.ListFormatOptions) => string} formatList
 * @property {(value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string} formatRelativeTime
 * @property {(minutes: number, options?: DurationOptions) => string} formatDuration
 */

/**
 * @typedef {object} DurationOptions
 * @property {'clock' | 'short' | 'long' | 'narrow'} [style] `clock` is `HH:MM` (`01:05`, the
 *   same in every locale); the others spell out the units in the locale (`1 h 5 min`). Default `short`.
 */

const DEFAULT_DATE = Object.freeze({ dateStyle: 'medium' });
const DEFAULT_DATE_TIME = Object.freeze({ dateStyle: 'medium', timeStyle: 'short' });

/**
 * @param {string} locale
 * @returns {string | null} the language part of a regional tag, `null` when there is none
 */
function baseLanguage(locale) {
  const base = locale.split(/[-_]/)[0];
  return base && base !== locale ? base : null;
}

/**
 * Build a translator for one locale. Keys are looked up in the locale's catalog, then in its
 * base language (`fr-CA` then `fr`), then in the fallback locale's. A key found nowhere returns
 * the key itself and calls `onMissing`. Nothing is logged unless `onMissing` does it.
 *
 * Plural messages are chosen with `params.count` using the plural rules of the catalog the
 * message came from, and `{count}` is filled with the number formatted for the locale.
 *
 * @param {TranslatorOptions} options
 * @returns {Translator}
 */
export function createTranslator({ locale, catalogs, fallbackLocale = 'en', onMissing }) {
  // Throws a RangeError right away for a malformed tag, not on the first render.
  numberFormat(locale);

  /** @type {string[]} */
  const chain = [];
  for (const entry of [locale, baseLanguage(locale), fallbackLocale]) {
    if (entry && catalogs[entry] && !chain.includes(entry)) chain.push(entry);
  }
  /** @type {Map<string, import('./messages.js').FlatCatalog>} */
  const flat = new Map();
  for (const entry of chain) flat.set(entry, flattenCatalog(catalogs[entry] ?? {}));

  /** @param {string} key @param {Record<string, unknown>} params */
  function render(key, params) {
    for (const entry of chain) {
      const message = flat.get(entry)?.[key];
      if (message === undefined) continue;
      /** @param {string} param */
      const missingParam = (param) => onMissing?.({ type: 'param', key, locale, param });
      if (!isPluralMessage(message)) return interpolate(message, params, missingParam);

      const { count } = params;
      const hasCount = typeof count === 'number' && Number.isFinite(count);
      const template = hasCount
        ? selectPlural(message, count, pluralRules(entry))
        : (message.other ?? '');
      const values = hasCount ? { ...params, count: numberFormat(entry).format(count) } : params;
      return interpolate(template, values, missingParam);
    }
    onMissing?.({ type: 'key', key, locale });
    return key;
  }

  return {
    locale,
    t: (key, params = {}) => render(key, params),

    formatDate(isoDate, options = DEFAULT_DATE) {
      const parts = parseIsoDate(isoDate);
      if (!parts) return String(isoDate);
      // The calendar day is formatted as UTC midnight of that same day, with the formatter
      // pinned to UTC: no time zone or DST rule can move it to a neighbouring day. (Parsing
      // the string with `new Date('YYYY-MM-DD')` would also be UTC, but would then be shown
      // in local time, one day early west of Greenwich.)
      const date = new Date(0);
      date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
      return dateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
    },

    formatDateTime: (value, options = DEFAULT_DATE_TIME) =>
      dateTimeFormat(locale, options).format(value),

    formatNumber: (value, options) => numberFormat(locale, options).format(value),

    formatList: (items, options) => listFormat(locale, options).format(items),

    formatRelativeTime: (value, unit, options = { numeric: 'auto' }) =>
      relativeTimeFormat(locale, options).format(value, unit),

    formatDuration(minutes, { style = 'short' } = {}) {
      const whole = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
      if (style === 'clock') {
        const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
        return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
      }
      return durationFormat(locale, style).format(whole);
    },
  };
}
