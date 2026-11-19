# @simple-web-tools/i18n

Message catalogs, plurals and `Intl` formatting ([decision 0002](../../docs/decisions/0002-english-code-translated-ui.md)).
Private workspace package: it is not published. No runtime dependency beyond
`@simple-web-tools/dates` (same repository); everything else is `Intl`.

## Rules

- **No hard-coded UI strings once an app has its catalog.** Every user-facing string goes
  through `t()`, and every date, number, list and duration through the translator's helpers.
  A literal string in a view is a review failure.
- **English is the reference.** `en` has every key and is the fallback; `fr` is checked
  against it by a test (see [Catalog checks](#catalog-checks)).
- **Pure.** No DOM, no storage, no clock, no `navigator` in the main entry point
  ([decision 0004](../../docs/decisions/0004-reference-architecture.md)). The caller passes
  `navigator.languages` and `localStorage`. The one DOM helper is in `@simple-web-tools/i18n/dom`.
- **Small syntax.** `{name}` placeholders and plural objects. No ICU MessageFormat, no HTML
  in messages, no escaping: braces around an identifier are always a placeholder.

## Catalogs

A catalog is a plain JS module that exports an object, one file per locale. Keys can be
nested, flat (dotted) or both; they are read as dotted paths (`tasks.title`).

```js
// src/i18n/en.js
export default {
  app: { title: 'Tasks' },
  'errors.import': 'Cannot import {file}: {reason}',
  tasks: {
    count: {
      '=0': 'No tasks',
      one: '{count} task',
      other: '{count} tasks',
    },
  },
};
```

```js
// src/i18n/fr.js
export default {
  app: { title: 'Tâches' },
  'errors.import': 'Impossible d’importer {file} : {reason}',
  tasks: {
    count: { one: '{count} tâche', other: '{count} tâches' },
  },
};
```

- **Placeholders**: `{name}` (letters, digits, `_`, not starting with a digit). A value is
  converted with `String()`. A missing value leaves `{name}` visible in the output, never
  `undefined`, and calls `onMissing`.
- **Plurals**: a message whose value is an object with an `other` string and only plural
  category keys (`zero`, `one`, `two`, `few`, `many`, `other`) or exact counts (`=0`, `=1`, ...).
  The variant is chosen with the `count` parameter: an exact `=N` first, then the category from
  `Intl.PluralRules` for the language of the catalog the message came from, then `other`.
  `{count}` is filled with the number formatted for the locale (`1,234` / `1 234`).
  Do not name a namespace with only category keys (a namespace `{ other: ... }` would be
  read as a plural message).
- **French**: `one` covers 0 and 1 (and 1,5). `many` only applies to millions, so a French
  message needs `one` and `other`; add `many` (`1 million de tâches`) only if the app can
  reach it.
- Which categories a locale needs is whatever whole counts from 0 to 1000 reach:
  `en`/`fr`: `one`, `other`; `ru`: `one`, `few`, `many`, `other`; `ja`: `other`.

## API

```js
import { createTranslator, negotiateLocale, createLocalePreference } from '@simple-web-tools/i18n';
import { applyDocumentLanguage } from '@simple-web-tools/i18n/dom';
import en from './i18n/en.js';
import fr from './i18n/fr.js';

const catalogs = { en, fr };
const preference = createLocalePreference({ app: 'chrono', storage: localStorage });

const locale = negotiateLocale({
  requested: [preference.get(), ...navigator.languages].filter(Boolean), // override first
  supported: Object.keys(catalogs),
  fallback: 'en',
});

const i18n = createTranslator({ locale, catalogs });
applyDocumentLanguage(locale);

i18n.t('tasks.count', { count: 3 }); // "3 tasks"
i18n.formatDate('2026-11-18'); // "Nov 18, 2026"
```

### `createTranslator({ locale, catalogs, fallbackLocale = 'en', onMissing })`

Returns `{ locale, t, formatDate, formatDateTime, formatNumber, formatList, formatRelativeTime, formatDuration }`.
A malformed `locale` throws a `RangeError` at creation.

| Member                                      | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t(key, params?)`                           | Looks the key up in the locale, then its base language (`fr-CA` then `fr`), then `fallbackLocale`. Found nowhere: returns the key and calls `onMissing({ type: 'key', key, locale })`. Using the fallback locale is not reported; a missing parameter calls `onMissing({ type: 'param', key, locale, param })`. Nothing is logged unless `onMissing` does it.                                                          |
| `formatDate(isoDate, options?)`             | Formats a local `YYYY-MM-DD` string. Default `{ dateStyle: 'medium' }`. The day is built from its parts and formatted in UTC, so no time zone or DST rule can shift it; a `timeZone` option is ignored on purpose, because a date-only value has no time zone and one would shift it to a neighbouring day. To format an instant (a `Date` or a timestamp), use `formatDateTime`. Invalid input is returned unchanged. |
| `formatDateTime(date \| ms, options?)`      | A `Date` or timestamp in the viewer's time zone. Default `{ dateStyle: 'medium', timeStyle: 'short' }`.                                                                                                                                                                                                                                                                                                                |
| `formatNumber(n, options?)`                 | `Intl.NumberFormat` (percent, currency, units, ...).                                                                                                                                                                                                                                                                                                                                                                   |
| `formatList(items, options?)`               | `Intl.ListFormat`: `a, b, and c` / `a, b et c`.                                                                                                                                                                                                                                                                                                                                                                        |
| `formatRelativeTime(value, unit, options?)` | `Intl.RelativeTimeFormat`, `numeric: 'auto'` by default (`yesterday`, `demain`).                                                                                                                                                                                                                                                                                                                                       |
| `formatDuration(minutes, { style }?)`       | Whole minutes as hours and minutes. `clock`: `01:05` in every locale (Chrono's `fmtDuree`). `short` (default), `long`, `narrow`: units in the locale (`1 h 5 min`), through `Intl.DurationFormat` when the runtime has it and composed `Intl.NumberFormat` units otherwise. Negative and non-finite values count as 0.                                                                                                 |

Intl formatter instances are cached per kind, locale and options, and shared by every
translator, so calling a helper on each render is cheap.

### `negotiateLocale({ requested, supported, fallback })`

Pure. For each requested tag in order: exact match, then the tag minus trailing subtags
(`fr-CA` matches `fr`), then any supported tag of the same language (`fr` matches `fr-FR`).
Case-insensitive, `_` accepted, junk entries skipped. The result uses the spelling in
`supported`; nothing matching returns `fallback`.

### `createLocalePreference({ app, storage })`

The saved manual override. `get()` returns the saved tag or `null`; `set(locale)` saves it and
`set(null)` clears it; `set` returns `false` if the storage refused (blocked, full). The key is
`<app>-locale` ([decision 0005](../../docs/decisions/0005-single-origin-hosting.md)). The
value is not validated: always pass it through `negotiateLocale` so a locale removed in a later
release falls back cleanly. `storage` is anything with `getItem`, `setItem` and `removeItem`
(`localStorage`, or an in-memory object in tests).

The key is built here, not with `storageName` from `@simple-web-tools/storage`: that package
has a single entry point that also loads its IndexedDB code, which a language switch does not
need. A test asserts that both produce the same name.

### `applyDocumentLanguage(locale, doc = document)`

From `@simple-web-tools/i18n/dom`: sets `<html lang>`.

## Catalog checks

`compareCatalogs(reference, other, { locale })` compares a catalog to the reference and
returns:

```js
{
  missing: [],              // keys the reference has and `other` lacks
  extra: [],                // keys `other` has and the reference lacks
  placeholderMismatches: [], // { key, expected, actual } placeholder names
  pluralGaps: [],           // { key, missing: ['few', ...] } or missing: ['shape']
}
```

`NO_DIFFERENCES` is the value of a clean comparison. One line per app and locale in its
Vitest suite:

```js
import { NO_DIFFERENCES, compareCatalogs } from '@simple-web-tools/i18n';
import en from '../../src/i18n/en.js';
import fr from '../../src/i18n/fr.js';

it('the French catalog matches the English one', () => {
  expect(compareCatalogs(en, fr, { locale: 'fr' })).toEqual(NO_DIFFERENCES);
});
```

Pass `locale` so plural messages are checked against the categories that language needs.
Exact-count variants (`=0`) are never required.

## Tests

```bash
npm test -w @simple-web-tools/i18n
```

The default zone is `Europe/Paris` (`vitest.config.js`); `tests/dates.test.js` also runs the
date formatting under `UTC`, `America/New_York`, `Pacific/Auckland` and `Pacific/Kiritimati`,
on daylight-saving transition days and at the ends of the year.
