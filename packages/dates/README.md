# @simple-web-tools/dates

Local calendar dates and DST-safe arithmetic, extracted from Locavern (the reference app,
[decision 0004](../../docs/decisions/0004-reference-architecture.md)). Private workspace
package: it is not published.

A calendar date is a local `YYYY-MM-DD` string, never a timestamp and never
`toISOString()` (which converts to UTC and shifts the date around midnight).

## Rules

- **Pure.** No DOM, no storage, no clock. The package never calls `Date.now()` or `new Date()`
  without arguments: the current time is a parameter (`getTodayIsoDate(now)`).
- **DST-safe.** Day arithmetic runs on UTC timestamps built from calendar parts, where a day is
  always 24 hours. Local days (23 or 25 hours on a transition) are only measured by
  `getLocalDayBounds`, which asks the `Date` constructor for each midnight.
- **Locale-free.** No month or weekday names, no formatting for display. Labels belong to the
  i18n layer.
- **No runtime dependencies.**

## Usage

Add `"@simple-web-tools/dates": "*"` to the `dependencies` of the workspace, then:

```js
import { getTodayIsoDate, shiftIsoDate } from '@simple-web-tools/dates';

const today = getTodayIsoDate(new Date()); // the caller reads the clock, at the edge
const nextWeek = shiftIsoDate(today, 7);
```

## API

Invalid input never throws: parsers return `null`; the other functions return their input
unchanged (`shiftIsoDate`, `addMonthsClamped`), `0` (`getIsoWeekdayMon0`, `diffIsoDays`) or
`false` (`isWeekendIsoDate`).

| Function                                 | Returns                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `parseIsoDate(value)`                    | `{ year, month, day }` or `null` (strict, rejects `2025-02-29`)     |
| `parseTimeHhMm(value)`                   | `{ hour, minute, normalized }` or `null` (24-hour `HH:MM`)          |
| `formatIsoDate(year, month, day)`        | `YYYY-MM-DD` from parts (not validated)                             |
| `toLocalIsoDate(date)`                   | local `YYYY-MM-DD` of any `Date`                                    |
| `getTodayIsoDate(now)`                   | same as `toLocalIsoDate`; `now` is required                         |
| `shiftIsoDate(isoDate, deltaDays)`       | the date `deltaDays` later (or earlier)                             |
| `addMonthsClamped(isoDate, deltaMonths)` | day clamped to the target month (31 Jan + 1 month = 28/29 Feb)      |
| `daysInMonth(year, month)`               | 28..31                                                              |
| `getIsoWeekdayMon0(isoDate)`             | 0 = Monday .. 6 = Sunday                                            |
| `getWeekStartIsoDate(isoDate)`           | the Monday of that week                                             |
| `diffIsoDays(a, b)`                      | signed calendar days `b - a`                                        |
| `isWeekendWeekdayIndex(index)`           | whether a Monday-based index is Saturday or Sunday                  |
| `isWeekendIsoDate(isoDate)`              | whether the date is a Saturday or a Sunday                          |
| `buildMonthCalendarGrid(year, month)`    | whole Monday-to-Sunday weeks covering the month (`MonthGridCell[]`) |
| `buildWeekCalendarGrid(isoDate)`         | the 7 days of that week (`WeekGridCell[]`)                          |
| `getLocalDayBounds(isoDate)`             | `{ startMs, endMs }`: local midnight and the next one, or `null`    |

Types (`IsoDateParts`, `TimeParts`, `MonthGridCell`, `WeekGridCell`) are JSDoc typedefs in
`src/index.js`.

## Tests

```bash
npm test -w @simple-web-tools/dates
```

The default zone is `Europe/Paris` (`vitest.config.js`). `tests/dst.test.js` switches
`process.env.TZ` per suite to also run under `UTC`, `America/New_York` and `Pacific/Auckland`,
across their spring and autumn transitions, and checks that the zone switch really took effect.
