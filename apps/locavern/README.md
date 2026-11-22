# Locavern

Local-first personal productivity app in vanilla JavaScript (ES modules, Vite): no runtime
framework. Projects, tasks, Kanban, calendar, rich-text notes and an SVG whiteboard, all in the
browser. The interface is available in English and French (it follows the browser, and can be chosen
in the preferences). Nothing is sent to a server.

The runtime dependencies are the monorepo packages `@simple-web-tools/covenant` (design system,
bundled fonts and icons), `storage`, `dates`, `i18n`, `suite` (the brand and the links to the
sibling apps, at the top and the bottom of the sidebar) and `rich-text` (the Tiptap editor of notes
and task descriptions, which carries the Tiptap dependencies: see
[its README](../../packages/rich-text/README.md)), plus two third-party libraries, each with a reason
([decision 0003](../../docs/decisions/0003-no-runtime-framework.md)):

- `fflate`: ZIP archives for backups.
- `idb` (1 kB): a promise wrapper around IndexedDB, used through `@simple-web-tools/storage`.

## Features

- **Today**: overdue tasks, tasks due soon, high priorities and recent items, with direct completion.
- **Projects and tasks**: List view (quick add, urgency badges, filters, sort) and a configurable
  Kanban board (columns with an Initial, intermediate or Final role, drag and drop, an actions
  menu, `Alt` + arrow keys), recurring tasks (daily, weekly, monthly), checklists.
- **Calendar**: Month and Week views with weekend and 18:00-07:00 slot differentiation, an hourly
  grid, rescheduling by drag and drop or keyboard, and an `.ics` export.
- **Notes**: Tiptap editor (headings 1 to 3, bold, italic, strikethrough, code, checklists, `https://`
  and `mailto:` links), duplication, Markdown (`.md`) export, and local images stored as `Blob`s
  (remote images are blocked).
- **SVG whiteboard**: native canvas with selection by area and multi-select, duplication, arrow
  snapping, a 20 px grid with snapping, sticky notes, shapes, text, freehand drawing and local
  images, undo and redo, zoom and fit to view, full keyboard operation, `.svg` and `.png` export.
- **Across items**: tags on tasks and notes, two-way internal links between tasks, notes and
  whiteboards, built-in and custom local templates, the **Archive** view, a local **Trash** with a
  configurable retention (1 to 365 days) and a `Ctrl+K` command palette with full-content search.
- **Backups**: plain or password-encrypted ZIP archives (`AES-256-GCM`, `PBKDF2-SHA-256`), merge
  without overwriting or selective import by project, saving to a chosen folder.
- **Offline**: installable as a PWA, starts without a network, with an update notice.

## Data and storage

- One IndexedDB database, `locavern-db`, at schema **version 4** (eight object stores: `meta`,
  `projects`, `tasks`, `notes`, `whiteboards`, `assets`, `trash`, `templates`). Every storage name
  starts with `locavern` (decision 0005): the apps share one origin. The `localStorage` keys are
  `locavern-color-scheme`, `locavern-text-size` and `locavern-locale`.
- **Single writer** (decision 0004): one tab holds the Web Lock `locavern-write-lock`; other tabs are
  read-only and take over when the writing tab closes (`BroadcastChannel` `locavern-lock-channel`).
- The ZIP archive format is `schemaVersion: 2`. Clearing the site data in the browser erases
  Locavern's data: export a ZIP archive to keep a backup. See
  [Local storage, archive format and error messages](docs/reference/storage-limits-and-errors.md).
- **Service worker**: cache `locavern-shell-v4`; on activation it deletes only the caches whose name
  starts with `locavern-`. A strict Content Security Policy is injected at build time (no CDN, no
  third-party request).

## Architecture

[Vite](https://vite.dev/) app in ES modules, following the reference architecture
([decision 0004](../../docs/decisions/0004-reference-architecture.md)):

```text
index.html            Vite entry
public/               theme-init.js (theme, text size and language before the first paint),
                      sw.js (service worker), manifest, icons
src/
  main.js             starts the app, wires the store to the adapters
  types.d.ts          data model
  core/               PURE business logic: store, model, schema, backup, crypto, dates, search,
                      iCalendar and Markdown serialization, templates, whiteboard geometry
  adapters/           everything that touches the browser: IndexedDB, files, service worker,
    dom/              views and dialogs, SVG whiteboard engine, the editor's wiring to
                      `@simple-web-tools/rich-text` (the editor and the whiteboard screen are
                      separate chunks, loaded on first use: `*-lazy.js`)
  i18n/               en.js (the reference), fr.js, index.js
  styles/app.css      layout and semantic roles (the rest comes from Covenant); the whiteboard
                      colours are `--lc-wb-*` tokens built from semantic roles only
tests/
  unit/               Vitest
  e2e/                Playwright and axe
```

The reasons behind these choices are in [Architecture choices](docs/explanation/architecture-choices.md)
and [Technical choices](docs/explanation/technical-choices.md).

## Running locally

From the root of the repository (one `package-lock.json` for all workspaces):

```sh
npm install
npm run dev -w locavern       # Vite dev server
npm run build -w locavern     # production build, in apps/locavern/dist
npm run preview -w locavern   # serves dist on http://127.0.0.1:4173, with the CSP header
```

The service worker needs a secure context: use `127.0.0.1` or `localhost`.

## Tests

```sh
npm test -w locavern                 # Vitest (tests/unit)
npm run typecheck -w locavern        # strict tsc on src and tests
npm run lint -w locavern && npm run format:check -w locavern
npm run test:e2e -w locavern         # builds the app, then Playwright (tests/e2e) with axe
npm run verify                       # from the root: typecheck, lint, format, tests, build
```

Unit tests cover `src/core` with no DOM, the archive and encryption formats, and the catalogs
(`i18n-catalogs.test.js` checks that `fr` matches `en`, `no-hardcoded-strings.test.js` fails on a
literal string in the views). The Playwright journeys include WCAG 2.2 AA checks with axe.

## Documentation

All pages are in English ([index](docs/index.md)).

- **Tutorial**: [Create your first workspace](docs/tutorials/first-workspace.md).
- **How-to guides**: [projects and tasks](docs/how-to/organize-projects-and-tasks.md),
  [day and calendar](docs/how-to/plan-your-day-and-calendar.md),
  [tags, links and templates](docs/how-to/organize-with-tags-links-and-templates.md),
  [notes and images](docs/how-to/write-notes-and-images.md),
  [whiteboard](docs/how-to/use-the-whiteboard.md),
  [backups and trash](docs/how-to/back-up-and-restore.md),
  [offline use](docs/how-to/use-offline.md),
  [read-only tabs](docs/how-to/resume-editing-across-tabs.md).
- **Reference**: [interface, views and shortcuts](docs/reference/interface-and-shortcuts.md),
  [storage, ZIP format and errors](docs/reference/storage-limits-and-errors.md).
- **Explanation**: [local-first and privacy](docs/explanation/local-first-and-privacy.md),
  [architecture choices](docs/explanation/architecture-choices.md),
  [technical choices](docs/explanation/technical-choices.md).

## License

[MIT](../../LICENSE).
