/**
 * Pure helpers for local calendar dates (`YYYY-MM-DD`) and wall-clock times (`HH:MM`).
 *
 * Rules (decision 0004):
 * - No DOM, no storage, no clock: the current time is always passed in as a `Date`.
 * - A calendar date is a string, never a timestamp. Never use `toISOString()` to produce one:
 *   it converts to UTC and shifts the date around midnight.
 * - Day arithmetic goes through UTC timestamps built from calendar parts only (see `DAY_MS`),
 *   so a local DST transition can never add or remove a day.
 * - Everything is locale-free. Labels (month and weekday names) belong to the i18n layer.
 */

/**
 * Milliseconds in a UTC day. Only valid on timestamps produced by `Date.UTC(year, month, day)`
 * from calendar parts: UTC days are always exactly 24 hours long. Never add it to a local
 * timestamp (`new Date(y, m, d).getTime()`): on a DST transition a local day lasts 23 or 25
 * hours. Local arithmetic must use `setDate` or the helpers below.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {object} IsoDateParts
 * @property {number} year
 * @property {number} month 1..12
 * @property {number} day 1..31
 */

/**
 * @typedef {object} TimeParts
 * @property {number} hour 0..23
 * @property {number} minute 0..59
 * @property {string} normalized zero-padded `HH:MM`
 */

/**
 * @typedef {object} MonthGridCell
 * @property {string} date `YYYY-MM-DD`
 * @property {number} day
 * @property {number} month 1..12
 * @property {number} year
 * @property {boolean} inCurrentMonth
 * @property {number} weekdayIndex 0 = Monday .. 6 = Sunday
 * @property {boolean} isWeekend
 */

/**
 * @typedef {object} WeekGridCell
 * @property {string} date `YYYY-MM-DD`
 * @property {number} day
 * @property {number} month 1..12
 * @property {number} year
 * @property {number} weekdayIndex 0 = Monday .. 6 = Sunday
 * @property {boolean} isWeekend
 */

/**
 * Parse a strict `YYYY-MM-DD` calendar date into validated calendar parts.
 * @param {string | null | undefined} value
 * @returns {IsoDateParts | null}
 */
export function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Parse and validate a 24-hour `HH:MM` wall-clock time.
 * @param {string | null | undefined} value
 * @returns {TimeParts | null}
 */
export function parseTimeHhMm(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return {
    hour,
    minute,
    normalized: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/**
 * Format numeric calendar parts into `YYYY-MM-DD`. The parts are not validated.
 * @param {number} year
 * @param {number} month 1..12
 * @param {number} day 1..31
 * @returns {string}
 */
export function formatIsoDate(year, month, day) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Local calendar date (`YYYY-MM-DD`) of an instant, read in the runtime's time zone.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalIsoDate(date) {
  return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Today's local calendar date. The current time is a required argument: this package never
 * reads the clock. Callers at the edge of the app pass `new Date()`.
 * @param {Date} now
 * @returns {string}
 */
export function getTodayIsoDate(now) {
  return toLocalIsoDate(now);
}

/**
 * Shift a `YYYY-MM-DD` date by `deltaDays` (positive or negative). An invalid date is
 * returned unchanged.
 * @param {string} isoDate
 * @param {number} deltaDays
 * @returns {string}
 */
export function shiftIsoDate(isoDate, deltaDays) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day) + Math.trunc(deltaDays) * DAY_MS;
  const next = new Date(utc);
  return formatIsoDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/**
 * Number of days in a month.
 * @param {number} year
 * @param {number} month 1..12
 * @returns {number}
 */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Add `deltaMonths` to a `YYYY-MM-DD` date, clamping the day to the length of the target
 * month (31 January + 1 month = 28 or 29 February). An invalid date is returned unchanged.
 * @param {string} isoDate
 * @param {number} deltaMonths
 * @returns {string}
 */
export function addMonthsClamped(isoDate, deltaMonths) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const totalMonths = parts.year * 12 + (parts.month - 1) + Math.trunc(deltaMonths);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));
  return formatIsoDate(targetYear, targetMonth, targetDay);
}

/**
 * ISO weekday of a date, 0-based from Monday (0 = Monday, 6 = Sunday). Returns 0 for an
 * invalid date.
 * @param {string} isoDate
 * @returns {number}
 */
export function getIsoWeekdayMon0(isoDate) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return 0;
  const utcDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return (utcDay + 6) % 7;
}

/**
 * Whether a 0-based Monday-start weekday index is Saturday (5) or Sunday (6).
 * @param {number} weekdayIndex
 * @returns {boolean}
 */
export function isWeekendWeekdayIndex(weekdayIndex) {
  return weekdayIndex === 5 || weekdayIndex === 6;
}

/**
 * Whether a `YYYY-MM-DD` date falls on a Saturday or a Sunday. False for an invalid date.
 * @param {string | null | undefined} isoDate
 * @returns {boolean}
 */
export function isWeekendIsoDate(isoDate) {
  if (!isoDate || !parseIsoDate(isoDate)) return false;
  return isWeekendWeekdayIndex(getIsoWeekdayMon0(isoDate));
}

/**
 * The Monday (`YYYY-MM-DD`) of the week containing `isoDate`.
 * @param {string} isoDate
 * @returns {string}
 */
export function getWeekStartIsoDate(isoDate) {
  return shiftIsoDate(isoDate, -getIsoWeekdayMon0(isoDate));
}

/**
 * Signed calendar-day difference `b - a` between two `YYYY-MM-DD` dates. Returns 0 if either
 * date is invalid.
 * @param {string} aIsoDate
 * @param {string} bIsoDate
 * @returns {number}
 */
export function diffIsoDays(aIsoDate, bIsoDate) {
  const a = parseIsoDate(aIsoDate);
  const b = parseIsoDate(bIsoDate);
  if (!a || !b) return 0;
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / DAY_MS);
}

/**
 * Timestamps (ms) of the local day `isoDate`: `startMs` is local midnight, `endMs` is the next
 * local midnight (exclusive). The span is 23, 24 or 25 hours depending on DST, which is why
 * `startMs + 24 h` is wrong. Returns null for an invalid date.
 * @param {string} isoDate
 * @returns {{ startMs: number; endMs: number } | null}
 */
export function getLocalDayBounds(isoDate) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return null;
  return {
    startMs: new Date(parts.year, parts.month - 1, parts.day).getTime(),
    // The Date constructor normalizes day + 1 into the next month or year.
    endMs: new Date(parts.year, parts.month - 1, parts.day + 1).getTime(),
  };
}

/**
 * Monday-to-Sunday grid for a month: whole weeks, including the days of the neighbouring
 * months that complete the first and last week.
 * @param {number} year
 * @param {number} month 1..12
 * @returns {MonthGridCell[]}
 */
export function buildMonthCalendarGrid(year, month) {
  const firstIso = formatIsoDate(year, month, 1);
  const leadingDays = getIsoWeekdayMon0(firstIso);
  const totalCells = Math.ceil((leadingDays + daysInMonth(year, month)) / 7) * 7;
  const gridStartIso = shiftIsoDate(firstIso, -leadingDays);

  /** @type {MonthGridCell[]} */
  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const date = shiftIsoDate(gridStartIso, i);
    const parts = parseIsoDate(date);
    if (!parts) continue;
    const weekdayIndex = i % 7;
    cells.push({
      date,
      day: parts.day,
      month: parts.month,
      year: parts.year,
      inCurrentMonth: parts.year === year && parts.month === month,
      weekdayIndex,
      isWeekend: isWeekendWeekdayIndex(weekdayIndex),
    });
  }
  return cells;
}

/**
 * The 7 days, Monday to Sunday, of the week containing `anchorIsoDate`.
 * @param {string} anchorIsoDate
 * @returns {WeekGridCell[]}
 */
export function buildWeekCalendarGrid(anchorIsoDate) {
  const startIso = getWeekStartIsoDate(anchorIsoDate);
  /** @type {WeekGridCell[]} */
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = shiftIsoDate(startIso, i);
    const parts = parseIsoDate(date);
    if (!parts) continue;
    days.push({
      date,
      day: parts.day,
      month: parts.month,
      year: parts.year,
      weekdayIndex: i,
      isWeekend: isWeekendWeekdayIndex(i),
    });
  }
  return days;
}
