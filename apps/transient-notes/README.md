# Transient Notes

Local-first notes sorted with the [PARA method](https://fortelabs.com/blog/para/), in vanilla
JavaScript (ES modules, Vite): no runtime framework. The interface is available in English and
French (it follows the browser, and can be chosen in the preferences). Everything stays in the
browser; nothing is sent to a server.

It is a **rewrite** of the earlier [Transient Notes prototype](https://github.com/numeyoga/transient-notes)
on the repository's [reference architecture](../../docs/decisions/0004-reference-architecture.md),
not a port: the prototype had no users, so **nothing is migrated** and its data format is not
read. The runtime dependencies are the monorepo packages `@simple-web-tools/covenant` (design
system, bundled fonts and icons), `storage` (storage names, IndexedDB migrations, workspaces,
JSON export and import, single-writer lock, which uses `idb`, see
[its reason](../../packages/storage/README.md)), `dates`, `i18n`, `suite` (the
brand and the links to the sibling apps, at the top and the bottom of the sidebar) and
`rich-text` (the Tiptap editor, see [its reason](../../packages/rich-text/README.md)).

## Features

- **PARA in two lines**: every note lives in a folder, and every folder belongs to one of four
  categories: **Projects** (efforts with an end), **Areas** (responsibilities with no end),
  **Resources** (topics of interest) and **Archives** (what is no longer active). A note can also
  have no folder; it is then only listed in "All notes".
- **Folders**: create (with the category of your choice), rename, move to another category,
  delete. Deleting a folder, after a confirmation, keeps its notes: they stay with no folder.
  A category with no folder gets a default one ("General projects"...) when you add a note to it.
- **Tree**: "All notes", then each category as a disclosure holding its folders, with a counter
  and an "add a note" button. Choosing a row filters the notes list. The categories you fold are
  remembered per workspace.
- **Notes**: a title and a rich-text body (headings, bold, italic, strikethrough, inline code,
  bulleted, numbered and task lists, links), saved as you type (after 300 ms, and always when you
  switch notes, hide the tab or close it). Move a note to another folder from the editor.
  Deleting a note asks first and erases the images only it uses.
- **Images** are pasted, dropped or picked, and kept as local assets: see below.
- **Search and sort**: the search looks at titles and text, ignoring case and accents. Sort by
  last edit (default, newest first), creation date or title.
- **Export** a note, or every note of the workspace, as plain text or Markdown. File names are
  made from the title (characters a file name cannot hold are replaced) and the local date.
  The header of an export file follows the language of the interface.
- **Workspaces**: several independent sets of notes, to keep them apart by role or by
  importance; create, rename, delete, switch. The name of the current one is in the sidebar.
- **JSON backup and restore** of a workspace, images included (an import replaces the current
  workspace after a confirmation).
- **Offline**: installable as a PWA, starts without a network, and the editor works offline.
- **Preferences**: theme (system, light, dark), text size, language, single-key shortcuts.

On a narrow screen (down to 390 px) the three panes stack: the sidebar is a drawer, and the
notes list and the editor replace each other, with a back control.

## Data and storage

- Each workspace has its own IndexedDB database, `transient-notes__<id>`, at schema **version
  1**. Every storage name starts with `transient-notes` (decision 0005,
  `src/adapters/names.js`, checked by `tests/unit/names.test.js`): the apps share one origin.
- Every persisted or shared name:

| Where                           | Name                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB, one per workspace    | `transient-notes__<workspace id>` (stores `meta`, `folders`, `notes`, `assets`)                                                   |
| Web Lock, one for the whole app | `transient-notes-write-lock`                                                                                                      |
| BroadcastChannel                | `transient-notes-sync-<workspace id>` (a workspace was written), `transient-notes-lock-channel` (the lock was released)           |
| localStorage: workspaces        | `transient-notes-workspaces` (the list), `transient-notes-workspace-active` (kept by the registry of `@simple-web-tools/storage`) |
| localStorage: preferences       | `transient-notes-theme`, `transient-notes-text-size`, `transient-notes-locale`, `transient-notes-single-key-shortcuts`            |
| localStorage: the tree          | `transient-notes-collapsed-<workspace id>` (the folded categories, a JSON list; removed with the workspace)                       |
| Cache Storage                   | `transient-notes-shell-<build id>` (the offline shell)                                                                            |

- Switching workspace or importing a JSON file reloads the page. Clearing the site data in the
  browser erases the notes: export a JSON backup to keep one.
- **Deleting a workspace** erases its database. Neither the active workspace nor the last one
  can be deleted.
- **Single writer** (decision 0004): one tab holds the Web Lock `transient-notes-write-lock`
  (one lock for the whole app, because importing, creating or deleting a workspace writes to
  databases other than the active one). Other tabs are **read-only**: a banner says so, the
  title and the editor cannot be edited, the controls that change data are disabled, and
  single-key shortcuts do nothing. A read-only tab reloads the data when the writing tab
  announces a change on `transient-notes-sync-<id>`, and takes over the lock when the other tab
  closes.
- **No fallback storage**: if IndexedDB is unavailable or will not open (private browsing,
  blocked storage, an old tab holding the database open), an error screen replaces the app and
  nothing is read or written elsewhere.

### Schema versions

The model is described in `src/types.d.ts`. A schema change comes with a migration in
`src/adapters/idb.js` (`openDatabase` chains them in one upgrade transaction) and a test that
opens a database written by the previous version.

| Version | Change                                                                   |
| ------- | ------------------------------------------------------------------------ |
| 1       | First version: `meta`, `folders`, `notes` and `assets` (the next table). |

| Store     | Record                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| `folders` | `{ id, name, category, createdAt }`, `category` is `projects`, `areas`, `resources` or `archives`             |
| `notes`   | `{ id, title, doc, folderId, createdAt, updatedAt }`, `doc` is a rich-text document, `folderId` may be `null` |
| `assets`  | `{ id, mime, size, createdAt, blob }`, the picture is a Blob stored next to its metadata                      |
| `meta`    | `{ key, value }`, the key `preferences` holds `{ sort }`, the sort order of the workspace                     |

Timestamps are ISO 8601 strings; ids are `crypto.randomUUID()` values made in an adapter.

### Images as local assets

A pasted, dropped or picked picture (PNG, JPEG, WebP or GIF, **10 MB at most**) is stored as a
record of the `assets` store. The note's document holds only the id of the asset, never its
bytes: the editor shows it from a `blob:` URL made with `URL.createObjectURL`. A bigger file or
another type is refused with a message. Remote images (a URL, pasted HTML) are blocked: the
editor never renders them, so the app makes no request for a picture. The assets that no note
references any more are erased when a note is deleted or closed.

### Backup format

A backup is the export envelope of `@simple-web-tools/storage`:
`{ app: 'transient-notes', format: 'transient-notes-workspace', version: 1, exportedAt, data }`,
where `data` is `{ folders, notes, assets }`. The assets are embedded as base64 text (`{ id, mime,
size, createdAt, data }`), so a restore shows the pictures; only the assets that notes reference
are written. On import the file is validated and cleaned before anything is replaced (rich-text
documents are sanitized, records that cannot be used are skipped and reported); a file from
another app or from a newer version is refused. Restoring replaces the workspace that is open.

## Architecture

- `src/core/`: pure logic, no DOM, no storage, no clock (decision 0004). The model and the
  sanitizing, `reduce(state, command)` returning the new state and the effects to run, selectors
  (the selection, search, sort), export to text and Markdown, the backup rules, preferences and
  the rules of the offline shell. Time is passed in as an argument; ids come from an adapter.
- `src/adapters/`: IndexedDB, the single-writer store, workspaces, the backup file and downloads,
  i18n, preferences, the service worker registration and its update.
- `src/adapters/dom/`: the views, built with `createElement` and `append`, never `innerHTML`
  (a title or a folder name is only ever a text node), and the Covenant helpers. Tooltips are
  lifted into the top layer (`tooltip.js`) so that the sidebar's scrolling area does not cut them
  off.
- `src/i18n/`: the English (reference) and French catalogs; every UI string goes through them
  (decision 0002), which `tests/unit/no-hardcoded-strings.test.js` enforces.

## Content Security Policy and PWA

The production build injects this policy into `index.html` as a `<meta>` tag, and `vite preview`
sends it as a header:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self';
connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none';
base-uri 'none'; form-action 'none'
```

No inline script or handler, no `'unsafe-inline'`, no CDN, no request to another origin.

- **`img-src 'self' blob:`**: the only difference from Chrono's policy. The pictures of a note
  are Blobs in IndexedDB and are shown through `URL.createObjectURL`, which gives a `blob:` URL.
  `blob:` is the narrowest source that allows it: there is no `data:` (pictures are never
  inlined in a document) and no remote host.
- **No inline style**: Tiptap normally injects its base rules in a `<style>` element, which
  `style-src 'self'` blocks. The editor sets `injectCSS: false` and `@simple-web-tools/rich-text`
  ships those rules in `editor.css`; the app and Covenant only set styles through the CSSOM,
  which a CSP allows.
- The text, Markdown and JSON downloads are `blob:` links that the browser follows as downloads,
  which the policy does not govern. A hosting that can send headers should send the same policy.
- **Manifest**: `public/manifest.webmanifest` (name "Transient Notes", `start_url` and `scope`
  `./`, icons generated from the favicon).
- **Service worker** (`src/sw/sw.js`, built to `sw.js` at the root of the app): registered with
  the scope `./`, so under `/transient-notes/` on Pages it only controls that path. At build time
  a plugin writes `precache-manifest.json` (every file of the output except the worker, source
  maps and legacy font formats, the lazy editor chunk included) and stamps the worker with a
  hash of those files. The cache is named `transient-notes-shell-<hash>`; on activation the
  worker deletes the `transient-notes-` caches that are not its own, never another app's. Files
  are served cache first; a navigation that fails offline gets `index.html`.
- **Update**: a new worker installs in the background and waits. A toast offers to reload; the
  check also runs when the tab becomes visible again.

## Running locally

From the root of the repository (one `package-lock.json` for all workspaces):

```sh
npm install
npm run dev -w transient-notes        # Vite dev server (no service worker)
npm run build -w transient-notes      # production build, in apps/transient-notes/dist
npm run preview -w transient-notes    # serves dist on http://127.0.0.1:4175, with the CSP header
```

The service worker needs a secure context: use `127.0.0.1` or `localhost`, not another host name
over plain HTTP.

## Tests

```sh
npm test -w transient-notes                # Vitest (tests/unit)
npm run typecheck -w transient-notes       # strict tsc on src (views included) and tests/unit
npm run lint -w transient-notes && npm run format:check -w transient-notes
npm run test:e2e -w transient-notes        # builds the app, then Playwright (tests/e2e) against `vite preview`
npm run verify                             # from the root: typecheck, lint, format, tests, build
```

- **Unit (Vitest)**: `src/core` is tested with no DOM or storage and the time passed as an
  argument (no fake timers). The storage adapters use `@simple-web-tools/test-utils/fake-indexeddb`
  and small fakes (`tests/unit/support/`) for `localStorage`, `BroadcastChannel` and the Web Locks.
  A test asserts that every storage name starts with `transient-notes`, another that no view
  holds text outside the catalogs, another that the English and French catalogs have the same keys.
- **End to end (Playwright)**: black-box journeys through the UI: notes, folders (create, rename,
  move, delete, folded categories), PARA quick-create, search and sort, pictures (paste, drop,
  pick, reload), exports (the downloads are read back), JSON backup and restore with a picture,
  workspaces (separate notes and folders, deleting a database, never the last one), two tabs in
  one context (read-only with an open note, reload, lock takeover), IndexedDB unavailable,
  languages, tooltips, and `offline-csp.spec.js`: the policy in the build, no
  `securitypolicyviolation`, the service worker scope and cache name, an offline reload with a
  picture and the lazy editor chunk, the update toast. The suites run with the browser in French
  (`playwright.config.js`); `i18n.spec.js` and `offline-csp.spec.js` choose their own language.
  axe assertions (WCAG 2.0 A/AA, 2.1 AA, 2.2 AA) cover the selections, the editor, the menus and
  every dialog (folders, preferences, workspaces), the error toast and the read-only banner, in
  light and dark, at 1280 and 390 px (`tests/e2e/accessibility.spec.js`).

## Deployment

Transient Notes is part of the Simple Web Tools monorepo. GitHub Actions runs `npm run verify`
and the Playwright tests on every pull request; `main` is published to GitHub Pages
(`npm run site`, which copies `dist/` to `_site/transient-notes/`).

## Keyboard shortcuts

Active outside text fields and open dialogs, without Ctrl, Alt or Meta, and only in the tab that
can write. They can be turned off in the preferences ("Single-key shortcuts"). Ctrl+N and Ctrl+F
are left to the browser. Inside the editor, formatting shortcuts are Tiptap's (Ctrl+B, Ctrl+I,
Ctrl+Z...).

| Key        | Action                                               |
| ---------- | ---------------------------------------------------- |
| `N`        | New note, in the current folder or category.         |
| `/`        | Focus the search field.                              |
| `1` to `4` | New note in Projects, Areas, Resources or Archives.  |
| `Esc`      | Closes the open dialog or menu, and hides a tooltip. |

## Runtime dependencies

None of its own: Covenant, i18n, dates, storage, suite and rich-text are workspace packages of
this repository, and `idb` comes with the storage package. The one third-party library on the
editing path is **Tiptap** (MIT, headless, loaded on demand in its own chunk), pulled in by
[`packages/rich-text`](../../packages/rich-text/README.md), which explains why it replaces a
hand-written `contenteditable` editor (decision 0003).
