// Cached Intl formatter instances. Building an Intl object is expensive, and views format
// many values per render, so one instance per (kind, locale, options) is shared by every
// translator.

const MAX_ENTRIES = 200;
/** @type {Map<string, unknown>} */
const cache = new Map();

/**
 * @template T
 * @param {string} kind
 * @param {string} locale
 * @param {object | undefined} options
 * @param {() => T} create
 * @returns {T}
 */
function cached(kind, locale, options, create) {
  const key = `${kind}|${locale}|${options ? JSON.stringify(options) : ''}`;
  let formatter = cache.get(key);
  if (formatter === undefined) {
    if (cache.size >= MAX_ENTRIES) cache.clear();
    formatter = create();
    cache.set(key, formatter);
  }
  return /** @type {T} */ (formatter);
}

/** @param {string} locale @param {Intl.DateTimeFormatOptions} [options] */
export const dateTimeFormat = (locale, options) =>
  cached('datetime', locale, options, () => new Intl.DateTimeFormat(locale, options));

/** @param {string} locale @param {Intl.NumberFormatOptions} [options] */
export const numberFormat = (locale, options) =>
  cached('number', locale, options, () => new Intl.NumberFormat(locale, options));

/** @param {string} locale @param {Intl.RelativeTimeFormatOptions} [options] */
export const relativeTimeFormat = (locale, options) =>
  cached('relative', locale, options, () => new Intl.RelativeTimeFormat(locale, options));

/** @param {string} locale @param {Intl.ListFormatOptions} [options] */
export const listFormat = (locale, options) =>
  cached('list', locale, options, () => new Intl.ListFormat(locale, options));

/** @param {string} locale @param {Intl.PluralRulesOptions} [options] */
export const pluralRules = (locale, options) =>
  cached('plural', locale, options, () => new Intl.PluralRules(locale, options));

/** @typedef {'short' | 'long' | 'narrow'} DurationStyle */

/**
 * A formatter for a whole number of minutes, as hours and minutes. Uses `Intl.DurationFormat`
 * when the runtime has it; otherwise composes two `Intl.NumberFormat` unit formats, which every
 * supported runtime has. `DurationFormatCtor` is a parameter so the fallback can be tested.
 * @param {string} locale
 * @param {DurationStyle} style
 * @param {any} [DurationFormatCtor]
 * @returns {{ format: (minutes: number) => string }}
 */
export function durationFormat(
  locale,
  style,
  DurationFormatCtor = /** @type {any} */ (Intl).DurationFormat,
) {
  const kind = DurationFormatCtor ? 'duration' : 'duration-fallback';
  return cached(kind, locale, { style }, () => {
    const unit = (/** @type {string} */ name) =>
      new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: style });
    const mins = unit('minute');
    if (DurationFormatCtor) {
      const formatter = new DurationFormatCtor(locale, { style });
      return {
        // `Intl.DurationFormat` prints nothing for a zero duration, so zero goes through
        // the number format.
        format: (/** @type {number} */ minutes) =>
          minutes === 0 ? mins.format(0) : formatter.format(splitMinutes(minutes)),
      };
    }
    const hours = unit('hour');
    return {
      format: (/** @type {number} */ minutes) => {
        const parts = splitMinutes(minutes);
        if (!parts.hours) return mins.format(parts.minutes);
        if (!parts.minutes) return hours.format(parts.hours);
        return `${hours.format(parts.hours)} ${mins.format(parts.minutes)}`;
      },
    };
  });
}

/** @param {number} minutes */
function splitMinutes(minutes) {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
