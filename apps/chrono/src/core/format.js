// How dates, times and durations read in a language. Pure: it takes a translator of
// `@simple-web-tools/i18n` and returns the formatters the views use, so English shows English
// formats and French shows the French ones from the same calls. A calendar date stays a local
// `YYYY-MM-DD` string everywhere else.

import { formatDuration as formatDurationMs, formatLocalDate } from './dates.js';

/** @typedef {import('@simple-web-tools/i18n').Translator} Translator */

/**
 * The options that show a time of day the way a locale writes it: no leading zero on a 12-hour
 * clock (`9:05 AM`), two digits on a 24-hour one (`09:05`).
 * @param {string} locale
 * @returns {Intl.DateTimeFormatOptions}
 */
export function timeOfDayOptions(locale) {
  const twelve = ['h11', 'h12'].includes(
    new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle ?? '',
  );
  return { hour: twelve ? 'numeric' : '2-digit', minute: '2-digit' };
}

/**
 * @param {Pick<Translator, 'locale' | 'formatDate' | 'formatDateTime' | 'formatDuration'>} i18n
 */
export function createFormatters(i18n) {
  const timeOptions = timeOfDayOptions(i18n.locale);
  return {
    /**
     * `HH:MM` through the translator; `HH:MM:SS` and the compact form (`1h05`, `12m`, `30s`)
     * from the core: they hold no spelled-out word to translate.
     * @param {number} ms
     * @param {{ withSeconds?: boolean, compact?: boolean }} [opts]
     */
    formatDuration(ms, opts = {}) {
      if (opts.withSeconds || opts.compact) return formatDurationMs(ms, opts);
      return i18n.formatDuration(Math.floor(Math.max(0, ms) / 60_000), { style: 'clock' });
    },

    /** The time of day of an instant: `09:05`, `9:05 AM` (no leading zero on a 12-hour clock). @param {number} ts */
    formatTime(ts) {
      return i18n.formatDateTime(ts, timeOptions);
    },

    /**
     * An hour of the day on its own, for an axis: `07:00` on a 24-hour clock (as it always
     * was), `7:00 AM` on a 12-hour one. @param {number} hour 0 to 23
     */
    formatHour(hour) {
      return i18n.formatDateTime(new Date(2000, 0, 1, hour), timeOptions);
    },

    /**
     * The calendar day of an instant (its local day), formatted with `options`.
     * @param {Date | number} ts
     * @param {Intl.DateTimeFormatOptions} options
     */
    formatDay(ts, options) {
      return i18n.formatDate(formatLocalDate(ts), options);
    },

    /**
     * A local `YYYY-MM-DD` date, formatted with `options`.
     * @param {string} isoDate
     * @param {Intl.DateTimeFormatOptions} options
     */
    formatIsoDate(isoDate, options) {
      return i18n.formatDate(isoDate, options);
    },

    /**
     * The text with its first letter in capitals, for a name that starts a line.
     * @param {string} text
     */
    capitalize(text) {
      return text.charAt(0).toLocaleUpperCase(i18n.locale) + text.slice(1);
    },

    /**
     * Name of a weekday from the locale's own data, not from a list in the code.
     * @param {number} index 0 is Monday, 6 is Sunday
     * @param {'long' | 'short'} [style]
     */
    weekdayName(index, style = 'long') {
      // 2024-01-01 is a Monday.
      return i18n.formatDate(`2024-01-0${index + 1}`, { weekday: style });
    },
  };
}
