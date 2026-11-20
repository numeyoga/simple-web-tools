# Chrono

Time tracker in vanilla JavaScript (ES modules, Vite): no runtime framework. The interface is
available in English and French (it follows the browser, and can be chosen in the preferences).
Everything stays in the browser; nothing is sent to a server.

The runtime dependencies are the monorepo packages `@simple-web-tools/covenant` (design system,
bundled fonts and icons), `storage` (storage names, IndexedDB migrations, workspaces, JSON
export and import, single-writer lock, which uses `idb`, 1 kB, see
[its reason](../../packages/storage/README.md)), `dates` (local calendar dates) and `i18n`.

## Features

- **Parallel timers**: several sessions can run at once, each paused and resumed on its own or
  all together.
- **Presence clock**: arrival, break and departure, shown in the sidebar widget.
- **Manual entry**: add a session that is already over, or edit one (project, description,
  start, end).
- **To-dos**: a task list filtered by project and grouped by due date. A to-do can start a timer.
- **Projects**: cards with totals, a colour, a client, archiving.
- **Weekly report**: totals per day and per project, CSV export (the separator, decimal mark,
  dates and times follow the language: `;` and `1,50` in French, `,` and `1.50` in English;
  UTF-8 BOM, so Excel reads it).
- **Workspaces**: several independent data sets; create, rename, delete, switch.
- **JSON export and import** of a workspace (an import replaces the current workspace after a
  confirmation).
- **Offline**: installable as a PWA, starts without a network.

Times follow the clock of the language: `09:05` and `17:30` in French, `9:05 AM` and `5:30 PM` in
English (no leading zero on a 12-hour clock).

## Data and storage

- Each workspace has its own IndexedDB database, `chrono__<id>`, at schema **version 3**.
  Every storage name starts with `chrono` (decision 0005, `src/adapters/names.js`): the apps
  share one origin.
- The list of workspaces and the active one are in `localStorage` (`chrono-workspaces`,
  `chrono-workspace-active`, kept by the registry of `@simple-web-tools/storage`). Preferences:
  `chrono-theme`, `chrono-text-size`, `chrono-locale`, `chrono-single-key-shortcuts`,
  `chrono-show-project-totals`.
- Switching workspace or importing a JSON file reloads the page. Clearing the site data in the
  browser erases Chrono's data: export JSON to keep a backup.
- **Demo data** is never loaded on its own. In an empty workspace the Timeline offers a "Load demo
  data" button; creating a workspace can include them on request.
- **Single writer** (decision 0004): one tab holds the Web Lock `chrono-write-lock` (one lock for
  the whole app, because importing, creating or deleting a workspace writes to databases other
  than the active one). Other tabs are **read-only**: a banner says so, controls that change data
  are disabled or refuse with a message, single-key shortcuts do nothing, and running durations
  keep ticking. A read-only tab reloads the data when the writing tab announces a change on the
  `BroadcastChannel` `chrono-sync-<id>`, and takes over the lock when the other tab closes.
- **No fallback storage**: if IndexedDB is unavailable or will not open (private browsing, blocked
  storage, an old Chrono tab holding the database open), an error screen replaces the app and
  nothing is read or written elsewhere. The `localStorage` backups that older versions kept
  (`chrono-fallback-<id>-v2`, or `chrono.fallback.<id>.v1`) are imported **once** into IndexedDB
  when the workspace database is empty. The import is recorded in the `meta` store
  (`fallbackImported`), and the `localStorage` keys are never deleted.

### Schema versions

The model is described in `src/types.d.ts`. Migrations are pure functions in
`src/core/migrations.js` (`v1ToV2`, `v2ToV3`); `openDatabase` chains the IndexedDB steps in one
upgrade transaction (a version 1 database goes through both in one opening; an error cancels the
whole upgrade), and `parseExport` chains `upgrades: { 1: v1ToV2, 2: v2ToV3 }`, so an export of
version 1 or 2 is imported as version 3. Both are tested against data written in the previous
format.

| Version | Change                                                                  |
| ------- | ----------------------------------------------------------------------- |
| 1       | The original GitLab site: French field and store names.                 |
| 2       | Same database, English names (table below).                             |
| 3       | A project's colour becomes a Covenant category number, or a free color. |

**Version 1 to 2.** Fields not listed keep their name and value.

| Version 1                                                            | Version 2                                                               |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Stores `projets`, `pointage`                                         | `projects`, `attendance` (`todos`, `sessions`, `meta` unchanged)        |
| Project `nom`, `couleur`, `archive`                                  | `name`, `color`, `archived`                                             |
| Todo `titre`, `fait`, `projetId`, `creeLe`                           | `title`, `done`, `projectId`, `createdAt`                               |
| Todo `echeance`                                                      | `dueDate` (see the note below)                                          |
| Session `projetId`, `debut`, `dernierDebut`                          | `projectId`, `start`, `lastStart`                                       |
| Session `fin`, `duree`, `statut`                                     | `end`, `duration`, `status`                                             |
| `statut`: `terminee`, `en_cours`, `en_pause`                         | `done`, `running`, `paused`                                             |
| Attendance `sessionsSuspenduesIds`                                   | `suspendedSessionIds`                                                   |
| Attendance `sessionSuspendueId` (older)                              | Folded into `suspendedSessionIds`, removed                              |
| `type`: `arrivee`, `pause_debut`, `pause_fin`, `depart`              | `arrival`, `break_start`, `break_end`, `departure`                      |
| Workspace list `chrono.workspaces`, active `chrono.workspace.active` | `chrono-workspaces`, `chrono-workspace-active`                          |
| Workspace `creeLe`; `seedOnInit`                                     | `createdAt`; ignored (demo data is never automatic)                     |
| JSON export `version: 1` (a bare object)                             | Envelope `chrono-workspace` version 2; `exporteLe` becomes `exportedAt` |

- **Relative due dates**: early versions stored labels (`today`, `fri`...) in `echeance`. The
  migration only renames the field; the label becomes a `YYYY-MM-DD` date on load (it needs the
  current time, which `src/core/migrations.js` never reads), then the date is written back.
- **Workspaces**: at first start without `chrono-workspaces`, the version 1 list and active
  workspace are taken over with the same ids (database names stay `chrono__<id>`). The old keys
  are never deleted.

**Version 2 to 3.** Only the project colour changes. Version 2 stored a hex value (`color`);
version 3 stores the number of one of Covenant's 16 colour categories (`category`, 1 to 16) **or**,
when the user picked a free color, that colour (`customColor`, `#rrggbb`). Exactly one of the two
is set, the other is `null`. The displayed colours are derived by Covenant; a derived value is
never stored. `v2ToV3` converts each project: one of the 16 colours of the old palette
(any case, short form expanded) becomes its number; any other valid colour is **kept** as
`customColor` (lower case, six digits), never snapped to a category; a missing or invalid colour
takes the first category of the default order that no active project uses. Exports of version 2
stay importable.

| No. | Hue    | Old colour | No. | Hue       | Old colour |
| --- | ------ | ---------- | --- | --------- | ---------- |
| 1   | orange | `#ea580c`  | 9   | blue      | `#2563eb`  |
| 2   | amber  | `#d97706`  | 10  | indigo    | `#4f46e5`  |
| 3   | yellow | `#ca8a04`  | 11  | violet    | `#7c3aed`  |
| 4   | lime   | `#65a30d`  | 12  | purple    | `#9333ea`  |
| 5   | green  | `#16a34a`  | 13  | fuchsia   | `#c026d3`  |
| 6   | teal   | `#0d9488`  | 14  | pink      | `#db2777`  |
| 7   | cyan   | `#0891b2`  | 15  | raspberry | `#e11d48`  |
| 8   | sky    | `#0284c7`  | 16  | slate     | `#475569`  |

### Export and import

New exports are an envelope `{ app: 'chrono', format: 'chrono-workspace', version: 3, exportedAt, data }`.
Import also accepts, for good, the files of the GitLab site (a bare object without `app`): they are
wrapped as version 1, then converted. A file from another app or from a newer version is refused
(`wrong-app`, `newer-version`). The `localStorage` backups and the repaired databases below go
through the same conversions.

### Legacy workspace repair

Version 1 built a workspace id with `slugify(label).slice(0, 40)`, plus `-2`, `-3`... for a
duplicate. An id could therefore end with a dash, contain `--` or exceed 40 characters, which the
registry refuses. Each such workspace gets a valid, unique id (`planLegacyWorkspaces`); the old and
new ids are recorded in `chrono-legacy-workspaces`, and the writing tab copies the content of the
old database `chrono__<old id>` (opened with the raw API, without name validation) once, converted
by `v1ToV2`, to `chrono__<new id>`. The old database is never modified or deleted, and a
destination that already holds data is not overwritten.

## Project colours

Each project has one of Covenant's 16 colour categories (`data-cat`, 1 to 16) or a free color
from the native picker ("Custom color"). Choosing a swatch clears the free color, and the other
way round; the project editor shows what is stored.

- **New project**: the first category of the default order (blue, lime, pink, indigo, cyan, teal,
  slate, fuchsia, sky, violet, purple, green, yellow, amber, raspberry, orange) that no active
  project uses; after 16 projects the order starts again (`nextCategory`,
  `src/core/categories.js`). The user can change it in the form.
- **Display**: only through Covenant's recipes, never a hex value in code or CSS: stripe
  (`cv-cat-stripe`) and dot (`cv-cat-dot`) on cards and lists, chart segments
  (`cv-cat-segment`) and legend (`cv-cat-legend`), and `cv-cat-block` for Timeline blocks, whose
  background keeps white text at 4.5:1 or more. A free color goes through
  `Covenant.setCategory(element, '#rrggbb')`, which derives the marker and the background.
- **The name always accompanies the colour**: in the dot, the block, the legend, the table row.
  On the "running timers" card (inverse background) the project is a pill on its category
  background, since a marker is only guaranteed contrast on the light surfaces of the theme.
- **Timeline**: blocks keep Chrono's lane layout (84 px per hour, several lanes for parallel
  timers, variable height), which `cv-cat-timeline` (one lane, percentages of the day) cannot
  express, so they only use the `cv-cat-block` background recipe. A session whose project no
  longer exists gets the neutral background (`--cv-surface-inverse`, text `--cv-fg-inverse`).

## Architecture

[Vite](https://vite.dev/) app in ES modules, no runtime framework
([decision 0003](../../docs/decisions/0003-no-runtime-framework.md)), following the reference
architecture ([decision 0004](../../docs/decisions/0004-reference-architecture.md)):

```text
index.html            Vite entry (loads src/main.js)
public/               static files: theme-init.js (classic script: theme, text size and
                      language before the first paint), manifest.webmanifest, icons, favicon
src/
  main.js             starts the app in #root
  types.d.ts          data model, schema version 3 (and the types of versions 2 and 1)
  styles/app.css      layout and semantic roles (the rest comes from Covenant)
  i18n/               en.js, fr.js: the catalogs (English is the reference and the fallback)
  core/               PURE business logic
  adapters/           everything that touches the browser
    store.js          createStore()
    idb.js            IndexedDB: migrations and access, on @simple-web-tools/storage
    fallback.js       one-time import of the old localStorage fallback
    legacy-databases.js  copy of databases whose version 1 id the registry refuses
    names.js          Chrono's storage names (prefixed, decision 0005)
    workspace-list.js workspace registry, takeover of the old list
    workspaces.js     workspace API (WORKSPACES), JSON import, download
    backup.js         export and import: package envelope, version 1 files
    i18n.js           the translator and the choice of language
    pwa.js, sw-update.js  service worker registration and update detection
    ids.js            id generator
    dom/              views and interface primitives
  sw/sw.js            the service worker (built to dist/sw.js)
tests/
  unit/               Vitest
  e2e/                Playwright
```

**`src/core`** holds no DOM, no `window`, no storage, no clock and no `Math.random()`. The time
(`now`) and the ids of new records are arguments. Rules have the shape
`(data, payload, now[, newId])` and return **new** data (`{ projects, todos, sessions, attendance }`)
without changing the input; unchanged records keep their reference, which allows differential
writes. A rule that changes nothing returns the object it received.

| File                      | Content                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `dates.js`                | `startOfDay`, `formatLocalDate` (local date, never `toISOString()`), `formatDuration`.        |
| `format.js`               | Dates, times and durations as a language writes them (12-hour or 24-hour clock).              |
| `locale.js`               | Choice of the interface language and of the format locale.                                    |
| `presence.js`             | `liveDuration`, `presenceRanges`, `presenceDuration`.                                         |
| `sessions.js`             | Start, pause, resume, stop (one or all), `truncateToPresence`, `updateSession`, manual entry. |
| `attendance.js`           | `attendanceState`, `recordAttendance` (arrival, break, departure and their effect on timers). |
| `todos.js`, `projects.js` | Add, edit, delete, archive.                                                                   |
| `due-dates.js`            | `YYYY-MM-DD` due dates, groups (`bucket`), migration of the old relative labels.              |
| `seed.js`                 | Demo data and empty data.                                                                     |
| `migrations.js`           | `v1ToV2` and `v2ToV3`.                                                                        |
| `categories.js`           | The 16 colour categories, the default order, `nextCategory`.                                  |
| `import-export.js`        | Import validation, recognition and wrapping of version 1 files.                               |
| `report.js`               | Weekly report aggregation and CSV text.                                                       |
| `preferences.js`          | Rules on the preferences (single-key shortcuts).                                              |
| `pwa.js`                  | Cache name, precache list, which caches an update may delete.                                 |

**`src/adapters`**: `createStore()` holds the state (`projects`, `todos`, `sessions`,
`attendance`) and exposes `actions`. Each action calls a `core` rule with the current time and a
fresh id, adopts the returned data and notifies listeners (`store.onState`). A one-second timer also
notifies `store.onTick`, for the running durations, in read-only tabs too. Database writes are
batched and delayed by a few tens of milliseconds. The views (`adapters/dom/`) subscribe to the
store and **render their whole content again** on every notification: no diff, no persistent local
state. `lib.js` and `ui.js` provide the DOM helpers and primitives (Button, Input, Select,
Badge, Kbd, Modal, Toast); `App.js` assembles the sidebar, the navigation and the shortcuts. No
global is shared between modules.

**Interface and language.** Every UI string comes from the catalogs in `src/i18n/` through `t()`
(decision 0002); a test fails on a literal in the views. The language is chosen once per page
load: the saved choice (`chrono-locale`), else the browser's languages, else English. Fonts
(IBM Plex) and icons (Phosphor) come from `@simple-web-tools/covenant` and are bundled by Vite.
`public/theme-init.js` reads `chrono-theme` (`light` or `dark`, else `prefers-color-scheme`),
`chrono-text-size` (`standard`, `comfortable`, `large`) and `chrono-locale` before the first paint.

## Content Security Policy and PWA

The production build injects this policy into `index.html` as a `<meta>` tag, and `vite preview`
sends it as a header:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none';
base-uri 'none'; form-action 'none'
```

No inline script or handler, no `'unsafe-inline'` (styles are set through the CSSOM, which a CSP
allows), no CDN, no request to another origin. The CSV and JSON downloads are `blob:` links that
the browser follows as downloads, which the policy does not govern. A hosting that can send
headers should send the same policy.

- **Manifest**: `public/manifest.webmanifest` (name "Chrono", `start_url` and `scope` `./`, icons
  generated from `favicon.svg`).
- **Service worker** (`src/sw/sw.js`, built to `sw.js` at the root of the app): registered with
  the scope `./`, so under `/chrono/` on Pages it only controls `/chrono/`. At build time a plugin
  writes `precache-manifest.json` (every file of the output except the worker, source maps and
  legacy font formats) and stamps the worker with a hash of those files. The cache is named
  `chrono-shell-<hash>`; a new build gets a new name, and on activation the worker deletes the
  `chrono-` caches that are not its own, never another app's. Files are served cache first; a
  navigation that fails offline gets `index.html`. Only same-origin GET requests are handled.
- **Update**: a new worker installs in the background and waits. A toast offers to reload; the
  button asks the waiting worker to take over and the page reloads. The check also runs when the
  tab becomes visible again.

## Running locally

From the root of the repository (one `package-lock.json` for all workspaces):

```sh
npm install
npm run dev -w chrono        # Vite dev server (no service worker)
npm run build -w chrono      # production build, in apps/chrono/dist
npm run preview -w chrono    # serves dist on http://127.0.0.1:4174, with the CSP header
```

The service worker needs a secure context: use `127.0.0.1` or `localhost`, not another host name
over plain HTTP.

## Tests

```sh
npm test -w chrono                   # Vitest (tests/unit)
npm run typecheck -w chrono          # strict tsc on src (views included) and tests/unit
npm run lint -w chrono && npm run format:check -w chrono
npm run test:e2e -w chrono           # builds the app, then Playwright (tests/e2e) against `vite preview`
npm run verify                       # from the root: typecheck, lint, format, tests, build
```

- **Unit (Vitest)**: `src/core` is tested with no DOM or storage, the time passed as an argument
  (no fake timers). The storage adapters use `@simple-web-tools/test-utils/fake-indexeddb` and
  small fakes (`tests/unit/support/`) for `localStorage`, `BroadcastChannel` and window events.
  Migrations are tested on databases written with the raw IndexedDB API as version 1 created them
  (`tests/unit/support/idb.js`), and the import on a real version 1 export
  (`tests/unit/fixtures/chrono-v1-export.json`). Date-sensitive tests also run with `TZ=UTC`,
  `TZ=Europe/Paris`, `TZ=America/New_York` and `TZ=Pacific/Auckland`.
- **End to end (Playwright)**: black-box journeys through the UI: start, timer, manual entry,
  to-dos, projects, report and CSV, workspaces, JSON export and import, persistence, version 1
  data, two tabs in one context (read-only, reload, lock takeover), IndexedDB unavailable or
  blocked, fallback import, languages, and `offline-csp.spec.js`: the policy in the build, no
  `securitypolicyviolation` on the views, dialogs and downloads, the service worker scope and
  cache name, an offline reload, the update toast and the cache cleanup. The suites run with the
  browser in French (`playwright.config.js`); `i18n.spec.js` and `offline-csp.spec.js` choose
  their own language. axe assertions (WCAG 2.0 A/AA, 2.1 AA, 2.2 AA) cover the four views, quick
  add (both modes), the project editor, the preferences and the workspaces, in light and dark, at
  1280 and 390 px, with demo data; a light free color (`#ffff00`) is checked on a Timeline block
  (`tests/e2e/accessibility.spec.js`).

## Deployment

Chrono is part of the Simple Web Tools monorepo. GitHub Actions runs `npm run verify` and the
Playwright tests on every pull request; `main` is published to GitHub Pages (`npm run site`, which
copies `dist/` to `_site/chrono/`).

## Keyboard shortcuts

Active outside text fields and open dialogs, without Ctrl, Alt or Meta. They can be turned off in
the preferences ("Single-key shortcuts").

| Key     | Action                                                                                       |
| ------- | -------------------------------------------------------------------------------------------- |
| `Space` | No timer running: opens "New timer". Otherwise pauses all, or resumes all if all are paused. |
| `N`     | New timer.                                                                                   |
| `S`     | Stops all running timers.                                                                    |
| `Esc`   | Closes the open dialog.                                                                      |
