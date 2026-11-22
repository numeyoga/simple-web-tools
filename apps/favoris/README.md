# Favoris

Local-first bookmarks, in vanilla JavaScript (ES modules, Vite): no runtime framework. Links
are sorted in colour **groups**, on pages called **workspaces**. The interface is available in
English and French (it follows the browser, and can be chosen in the preferences). Everything
stays in the browser; nothing is sent to a server.

It is a **rewrite** of the earlier [Favoris](https://github.com/numeyoga/favoris) (one 1,600-line
`index.html`, `localStorage`, CDN assets, an optional Appwrite sync) on the repository's
[reference architecture](../../docs/decisions/0004-reference-architecture.md). The data of the
earlier version **is migrated**: see "Existing data". The sync is not ported.

User documentation (English): [docs/](docs/index.md).

## Features

- **Workspaces** (the "spaces" of the earlier version): several independent pages of bookmarks,
  one IndexedDB database each. Create, rename, duplicate, delete (never the last one, never the
  active one), switch.
- **Groups**: a name, one of the 16 Covenant category colours, a star ("featured": shown first)
  and folding. Reorder them, edit them, delete them (their links are kept, with no group).
- **Links**: add (with `https://` added when you leave it out), edit, delete after a
  confirmation, copy the address, open in a new tab (`noopener noreferrer`). Only `http:` and
  `https:` addresses are accepted.
- **Edit mode**: drag and drop (links within a group and between groups, and the groups
  themselves) **and its keyboard alternative**: each link and each group has a menu with "move
  up", "move down" and, for a link, "move to a group" (WCAG 2.5.7).
- **Search** over names, addresses and group labels (case and accent insensitive), with `/`
  (a single-key shortcut that the preferences can turn off) and `Ctrl+K`.
- **JSON backup** of the active workspace: export, import (with a confirmation; the file of the
  earlier version, `{ space, tags, links }`, is accepted) and "clear all".
- **Preferences**: language, theme, text size, single-key shortcuts and the **site icons from
  Google** (off by default).

Native `prompt`, `confirm` and `alert` are never used: every question is a Covenant dialog.

## Data and storage

All the apps share one origin, so every persisted name starts with `favoris`
([decision 0005](../../docs/decisions/0005-single-origin-hosting.md)); `tests/unit/names.test.js`
asserts it.

| Where        | Name                                                              | Holds                                                |
| ------------ | ----------------------------------------------------------------- | ---------------------------------------------------- |
| IndexedDB    | `favoris__<workspace id>`                                         | one database per workspace                           |
| Web Lock     | `favoris-write-lock`                                              | the single writer for the whole app                  |
| Web Lock     | `favoris-legacy-import-lock`                                      | two tabs importing the old data take turns           |
| Channels     | `favoris-lock-channel`, `favoris-sync-<id>`                       | lock released, a workspace was written               |
| localStorage | `favoris-workspaces`, `favoris-workspace-active`                  | the registry of workspaces (storage package)         |
| localStorage | `favoris-theme`, `-text-size`, `-locale`, `-single-key-shortcuts` | display preferences                                  |
| localStorage | `favoris-site-icons`                                              | `1` when the site icons from Google are on           |
| localStorage | `favoris-legacy-import`                                           | `1` once the old data was imported (or found absent) |
| Cache        | `favoris-shell-<build id>`                                        | the offline shell (`@simple-web-tools/pwa`)          |

### Schema versions

A workspace database is version 1 (the version is the number of migrations in
`src/adapters/idb.js`), two stores keyed by `id`:

- `groups`: `{ id, label, category (1 to 16), featured, collapsed, position }`;
- `links`: `{ id, name, url, groupId | null, position }`.

`position` is the place of the record in its list (the core keeps it equal to the index, and a
reorder only writes the records whose position changed). The category is stored as a **number**,
never a colour, so that the palette can be retuned without a migration. Every read goes through
`cleanData`, which validates the records one by one. A schema change ships with a migration and a
test that opens a database written by the previous version (`tests/unit/storage-idb.test.js`).

### Existing data (the earlier version)

The earlier Favoris was served from `numeyoga.github.io/favoris/`, the same origin as the suite,
so its `localStorage` is readable. On the first start of this app (no `favoris-workspaces` key
and no `favoris-legacy-import` flag), `src/adapters/legacy-import.js` reads:

- `favoris.spaces` (the list of spaces), `favoris.currentSpace`, `favoris.v1:<space id>` (the data
  of a space: tags and links), `favoris.theme`;
- the single key `favoris.v1` of the versions before spaces, when there is no list.

It creates **one workspace per space** (the id is a slug of the old id), with its groups (a tag
is a group; its hex colour is mapped to the Covenant category of the same hue, the nearest one for
any other value) and its links (a link whose tag no longer existed gets a group made from the tag
name; an empty tag is no group), makes the space that was open the active workspace and keeps the
old theme when none is chosen. Records are validated one by one: a link whose address is not an
`http:` or `https:` one (the earlier version let an imported `javascript:` URL through) is
skipped and counted, a space whose data is not valid JSON is imported empty, and a toast says what
was left out.

- The old keys are **only read**, never changed or deleted: they stay as a backup. A test asserts
  that no `favoris.` key is written.
- The databases are written first, the list of workspaces last, and the flag
  `favoris-legacy-import` after that: an import that fails halfway records nothing, and the next
  start writes the same databases over.
- It runs once, under a Web Lock so that two tabs starting together do not both import.
- Tests: fixtures of both formats (`tests/unit/support/legacy-fixtures.js`), unit tests of the
  conversion and of the adapter, and an end-to-end test that seeds `localStorage` before the app
  loads (`tests/e2e/legacy-import.spec.js`).

### Backup format

`favoris-workspace`, version 1, on the envelope of `@simple-web-tools/storage`:
`{ app: "favoris", format: "favoris-workspace", version: 1, exportedAt, data: { groups, links } }`.
An import also accepts the earlier file, `{ space, tags, links }`, which has no envelope. Records
that cannot be used are skipped and counted, never fatal.

## Site icons and the one third-party request

Each link shows a **coloured initial** (the colour of its group). Nothing leaves the page.

The preference **"Load site icons from Google"** is **off by default** and its label says that
Google sees the domains of the links. Only while it is on does each link load
`https://www.google.com/s2/favicons?sz=32&domain=<host>`: the host of the link, never its path,
query or fragment. This follows
[decision 0008](../../docs/decisions/0008-opt-in-third-party-requests.md):

- `https://www.google.com` and the hosts its service redirects to, `https://t0.gstatic.com` to
  `https://t3.gstatic.com` (a CSP is checked again after each redirect), are allowed in
  `img-src` only, in the CSP, and nowhere else;
- turning the preference off removes the images at once, and nothing more is requested;
- an icon that fails to load leaves the initial in place; the images carry
  `referrerpolicy="no-referrer"` and an empty `alt`;
- end-to-end tests assert that no request leaves the origin with the preference off, and that
  icons ask `www.google.com` once per link with it on (the requests are intercepted, the network
  is never reached).

## Architecture

[Decision 0004](../../docs/decisions/0004-reference-architecture.md):

- `src/core/`: pure. `store.js` (`reduce(state, command)` returns the next state and the effects,
  which are the records that differ between the two states), `model.js` (cleaning, order),
  `url.js` (the `http:`/`https:` rule), `colors.js`, `search.js`, `selectors.js`, `backup.js`,
  `legacy.js`, `preferences.js`, `locale.js`.
- `src/adapters/`: `idb.js` (IndexedDB, `@simple-web-tools/storage`), `store.js` (write queue and
  single-writer lock), `workspaces.js`, `legacy-import.js`, `backup.js`, `preferences.js`,
  `i18n.js`, and `dom/` (the views, built with `@simple-web-tools/dom`: `el()` never parses HTML,
  so a link name is always a text node).
- `src/i18n/`: English and French catalogs.
- One tab writes (a Web Lock); the others are read-only, show a banner, re-read when the writer
  announces a write and take over when it goes away.

## Content Security Policy and PWA

`default-src 'none'`, `script-src 'self'`, `style-src 'self'` (no inline style: styles are set
through the CSSOM), `img-src 'self' https://www.google.com`, `font-src 'self'`,
`connect-src 'self'`, `worker-src 'self'`, `manifest-src 'self'`, no object, frame, `base-uri` or
form action. It is a meta tag in the build and a header of `vite preview`. The manifest, the service
worker (scope `./`, so `/favoris/` on Pages), the cache name and the offline start come from
[`@simple-web-tools/pwa`](../../packages/pwa/README.md).

## Running locally

```sh
npm install
npm run dev -w favoris        # Vite dev server (no service worker)
npm run build -w favoris      # production build, in apps/favoris/dist
npm run preview -w favoris    # serves dist on http://127.0.0.1:4176, with the CSP header
```

## Tests

```sh
npm test -w favoris           # Vitest (tests/unit)
npm run typecheck -w favoris  # strict tsc on src and tests/unit
npm run test:e2e -w favoris   # builds the app, then Playwright (tests/e2e) against `vite preview`
npm run verify                # from the root: typecheck, lint, format, tests, build
```

- **Unit**: the core with no DOM or storage; the storage adapters with a fake IndexedDB; the
  migration with fixtures of both old formats; names, catalogs (same keys, no text outside them).
- **End to end**: links (addresses refused with a message), groups, search and shortcuts, edit
  mode with the mouse and with the keyboard, workspaces, backup, the import of the earlier data,
  site icons, preferences, two tabs, offline and CSP, and axe (WCAG 2.0 A/AA, 2.1 AA, 2.2 AA)
  on every screen and dialog, light and dark, at 1280 and 390 px. The suites run with the browser
  in French (`playwright.config.js`).

## Keyboard shortcuts

| Key            | Action                                                           |
| -------------- | ---------------------------------------------------------------- |
| `N`            | New link (single-key shortcut, can be turned off).               |
| `/`            | Focus the search field (single-key shortcut, can be turned off). |
| `Ctrl+K`, `⌘K` | Focus the search field (always on).                              |
| `Esc`          | Closes the open dialog or menu, and hides a tooltip.             |

## Runtime dependencies

None of its own: Covenant, dom, i18n, dates, storage and suite are workspace packages of this
repository, and `idb` comes with the storage package (decision 0003).
