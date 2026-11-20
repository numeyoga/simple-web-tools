// How dates and times read in a language. Pure: it takes a translator of
// `@simple-web-tools/i18n` and returns the formatters the views use, so English shows English
// formats and French shows the French ones from the same calls. A calendar date stays a local
// `YYYY-MM-DD` string everywhere else.

import { parseIsoDate, parseTimeHhMm } from './dates.js';

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
 * @param {Pick<Translator, 'locale' | 'formatDate' | 'formatDateTime'>} i18n
 */
export function createFormatters(i18n) {
  const timeOptions = timeOfDayOptions(i18n.locale);

  /** @param {string} text the text with its first letter in capitals */
  const capitalize = (text) => text.charAt(0).toLocaleUpperCase(i18n.locale) + text.slice(1);

  return {
    capitalize,

    /**
     * A compact date: `15 nov.` / `15 nov. 2026` in French, `Nov 15` / `Nov 15, 2026` in
     * English (US). Invalid input is returned unchanged.
     * @param {string} isoDate local `YYYY-MM-DD`
     * @param {boolean} [withYear]
     */
    formatShortDate(isoDate, withYear = false) {
      return i18n.formatDate(isoDate, {
        day: 'numeric',
        month: 'short',
        ...(withYear ? { year: 'numeric' } : {}),
      });
    },

    /**
     * A full date with its weekday, starting with a capital: `Dimanche 15 novembre 2026`,
     * `Sunday, November 15, 2026`.
     * @param {string} isoDate local `YYYY-MM-DD`
     */
    formatFullDate(isoDate) {
      if (!parseIsoDate(isoDate)) return isoDate;
      return capitalize(
        i18n.formatDate(isoDate, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      );
    },

    /**
     * The month of a calendar heading, starting with a capital: `Novembre 2026`.
     * @param {number} year
     * @param {number} month 1 to 12
     */
    formatMonthYear(year, month) {
      const isoDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
      if (!parseIsoDate(isoDate)) return '';
      return capitalize(i18n.formatDate(isoDate, { month: 'long', year: 'numeric' }));
    },

    /**
     * The name of a weekday from the locale's own data, not from a list in the code.
     * `short` is the column header of the calendar: `Lun`, `Mon` (the abbreviation point of
     * French is dropped, as it always was).
     * @param {number} index 0 is Monday, 6 is Sunday
     * @param {'long' | 'short'} [style]
     */
    weekdayName(index, style = 'short') {
      // 2024-01-01 is a Monday.
      const name = i18n.formatDate(`2024-01-0${index + 1}`, { weekday: style });
      return capitalize(style === 'short' ? name.replace(/\.$/, '') : name);
    },

    /**
     * A wall-clock time `HH:MM` (24-hour, as stored) the way the locale writes it: `14:30` in
     * French, `2:30 PM` in English (US). Anything else is returned unchanged.
     * @param {string | null | undefined} hhmm
     */
    formatTimeOfDay(hhmm) {
      const parsed = parseTimeHhMm(hhmm);
      if (!parsed) return hhmm ?? '';
      return i18n.formatDateTime(new Date(2000, 0, 1, parsed.hour, parsed.minute), timeOptions);
    },
  };
}
