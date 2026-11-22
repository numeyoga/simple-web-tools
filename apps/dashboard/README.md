# Dashboard

Local-first dashboard of the links of your applications, in vanilla JavaScript (ES modules, Vite):
no runtime framework. A **template** says which **environments** (`dev`, `prod`...), which
**metadata fields** and which **link patterns** an application of one kind has; each
**application** fills the metadata in, and its links are built from the patterns. The interface
is available in English and French (it follows the browser, and can be chosen in the
preferences). Everything stays in the browser; nothing is sent to a server.

It is a **rewrite** of the earlier
[customizable dashboard](https://gitlab.com/wallartn/customizable-dashboard) (plain scripts on
GitLab Pages, `localStorage`-like profiles in IndexedDB, Phosphor from a CDN) on the repository's
[reference architecture](../../docs/decisions/0004-reference-architecture.md). The earlier app was
served from another origin, so its data cannot be found automatically: it comes over with its
JSON export. See "Existing data".

User documentation (English): [docs/](docs/index.md).

## Features

- **Applications**: a sidebar list with a filter, one screen per application: the environment
  tabs, the metadata of the environment, the links resolved from the patterns (copy, open in a new
  tab with `noopener noreferrer`), and the application's **extra links** (outside the
  environments, by tag). Open or copy every link of an environment at once.
- **Links that cannot be opened** are shown, not hidden: the pattern still has `{meta.cluster}` to
  fill in (counted on the environment tab), or it resolves to something that is not an `http:` or
  `https:` address. The open and copy buttons are disabled and the row says why.
- **Edit mode**: the name, slug, Jira key and description, the metadata values (text, text in mono,
  list, date), a different address for one link in one environment (an _override_), extra links,
  a new environment, duplicate and delete the application.
- **Administration**: **templates** (environments, links with a tag and a scope, order),
  **metadata fields** (key, label, type, choices), **tags** (key, label, Phosphor icon, order),
  **import and export**, and the **settings** of the workspace (name, application and environment
  at the start, the sample, clear).
- **Workspaces** (the "profiles" of the earlier version): several independent dashboards, one
  IndexedDB database each. Create, rename, duplicate, delete (never the last one, never the
  active one), switch.
- **Command menu** (`Ctrl+K`, Covenant's CommandMenu): go to an application or a screen, run an
  action, by typing a few letters.
- **JSON backup** of the active workspace: export, and import that **merges**, **replaces** or puts
  the file in a **new workspace**. The file of the earlier version is accepted.
- **Sample** ("Load the sample"): 4 templates and 12 applications, translated, on
  `example.invalid` hosts, with one environment left to fill in on purpose.
- **Preferences** (per person, not per workspace): language, theme, text size, **density**
  (comfortable or compact) and single-key shortcuts.

Native `prompt`, `confirm` and `alert` are never used: every question is a Covenant dialog.

## Patterns

A link of a template is an address with placeholders:

| Placeholder    | Stands for                                                         |
| -------------- | ------------------------------------------------------------------ |
| `{env}`        | the key of the environment (`prod`)                                |
| `{slug}`       | the slug of the application                                        |
| `{jiraKey}`    | its Jira key                                                       |
| `{meta.<key>}` | the metadata field `<key>` of the application, for the environment |
| `{<key>}`      | the same (how the earlier version wrote it); the three above win   |

A placeholder with no value stays as written, and the link says what is to fill in. Values are put
in as they are, never URL-encoded. The resolved address is opened only when it is an `http:` or
`https:` address with a host: `javascript:`, `data:`, `file:` and the like are shown disabled, and
so is an address with no scheme (`example.com/x`): the pattern, or the value, brings the `https://`.
The addresses typed in a dialog (an extra link, an override) are held to the same rule when they
are saved, and when a file is imported.

## Data and storage

All the apps share one origin, so every persisted name starts with `dashboard`
([decision 0005](../../docs/decisions/0005-single-origin-hosting.md)); `tests/unit/names.test.js`
asserts it.

| Where        | Name                                                                            | Holds                                           |
| ------------ | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| IndexedDB    | `dashboard__<workspace id>`                                                     | one database per workspace                      |
| Web Lock     | `dashboard-write-lock`                                                          | the single writer for the whole app             |
| Channels     | `dashboard-lock-channel`, `dashboard-sync-<id>`                                 | lock released, a workspace was written          |
| localStorage | `dashboard-workspaces`, `dashboard-workspace-active`                            | the registry of workspaces (storage package)    |
| localStorage | `dashboard-theme`, `-text-size`, `-density`, `-locale`, `-single-key-shortcuts` | display preferences                             |
| localStorage | `dashboard-view-<workspace id>`                                                 | the application and environments looked at last |
| Cache        | `dashboard-shell-<build id>`                                                    | the offline shell (`@simple-web-tools/pwa`)     |

### Schema versions

A workspace database is version 1 (the version is the number of migrations in
`src/adapters/idb.js`), three stores:

- `templates` (key `id`): `{ id, name, description, envs: [{ key, label }], metaFields: [{ key,
label, type, options }], links: [{ id, name, tag, scope, pattern }], position }`;
- `apps` (key `id`): `{ id, name, slug, templateId, jiraKey, description, envs: { <env key>: {
meta: { <field key>: value }, overrides: { <link id>: url } } }, extras: [{ id, name, url, tag }],
position }`;
- `settings` (key `key`, one record, `settings`): `{ dashboardName, defaultAppId, defaultEnv
('first' | 'last' | 'remember'), tags: [{ key, label, icon }] }`.

`position` is the place of the record in its list. Every read goes through `cleanData`, which
validates the records one by one. A schema change ships with a migration and a test that opens a
database written by the previous version (`tests/unit/storage-idb.test.js`).

Renaming the key of an environment or of a metadata field, deleting one, deleting a link of a
template and renaming a tag key carry the data of the applications along in the same command; a
template that applications use cannot be deleted.

### Existing data (the earlier version)

The earlier app lives on GitLab Pages, **another origin**: its IndexedDB (`apps-dashboard`, stores
`profiles` and `meta`) cannot be read from here, so there is no automatic migration. Its **export
file** is the way over, and the import accepts both shapes the earlier app wrote:

- wrapped: `{ "version": 1, "exportedAt": "...", "data": { ... } }`;
- bare: the dashboard object itself. In both, `apps` and `templates` must be lists.

What is read: the name, the default application and environment, the tags (`{ key: { label, icon
} }`), the templates, and the applications with their metadata, overrides and extra links. The
`{cluster}` style of placeholder keeps working. Records are validated one by one: an application
with no template id or that is not an object, an override or an extra link whose address is not
`http`/`https`, are skipped and counted. An application whose template is not in the file is kept
and says so. The earlier **theme and density** are not data here (they are the person's
preferences) and are left out. The steps for the person are in
[docs/back-up-and-move-your-data.md](docs/back-up-and-move-your-data.md);
`tests/fixtures/legacy-dashboard*.json` are files in that format, loaded by a unit test and by an
end-to-end test.

### Backup format

`dashboard-workspace`, version 1, on the envelope of `@simple-web-tools/storage`:
`{ app: "dashboard", format: "dashboard-workspace", version: 1, exportedAt, data: { settings,
templates, apps } }`.

## Architecture

[Decision 0004](../../docs/decisions/0004-reference-architecture.md):

- `src/core/`: pure. `store.js` (`reduce(state, command)` returns the next state and the effects,
  which are the records that differ between the two states), `model.js` (cleaning, keys, order),
  `links.js` (patterns, what an address must be), `url.js`, `search.js`, `selectors.js`,
  `backup.js`, `sample.js`, `route.js`, `view.js`, `preferences.js`, `locale.js`.
- `src/adapters/`: `idb.js` (IndexedDB, `@simple-web-tools/storage`), `store.js` (write queue and
  single-writer lock), `workspaces.js`, `backup.js`, `view-memory.js`, `preferences.js`, `i18n.js`,
  and `dom/` (the views, built with `@simple-web-tools/dom`: `el()` never parses HTML, so a name
  is always a text node). A screen is chosen by the address (`#/app/<id>`, `#/admin/<page>`).
- `src/i18n/`: English and French catalogs.
- One tab writes (a Web Lock); the others are read-only, show a banner, re-read when the writer
  announces a write and take over when it goes away.
- A field of a form commits when it is left (`change`), and the part of the page that shows it is
  drawn again afterwards, after the pointer is up, so a click on the next button is not lost.

## Content Security Policy and PWA

`default-src 'none'`, `script-src 'self'`, `style-src 'self'` (no inline style: styles are set
through the CSSOM), `img-src 'self'`, `font-src 'self'`, `connect-src 'self'`, `worker-src 'self'`,
`manifest-src 'self'`, no object, frame, `base-uri` or form action. There is **no third-party
host**. It is a meta tag in the build and a header of `vite preview`. The manifest, the service
worker (scope `./`, so `/dashboard/` on Pages), the cache name and the offline start come from
[`@simple-web-tools/pwa`](../../packages/pwa/README.md). The app never requests the addresses of
the links: the person opens them.

## Running locally

```sh
npm install
npm run dev -w dashboard        # Vite dev server (no service worker)
npm run build -w dashboard      # production build, in apps/dashboard/dist
npm run preview -w dashboard    # serves dist on http://127.0.0.1:4177, with the CSP header
```

## Tests

```sh
npm test -w dashboard           # Vitest (tests/unit)
npm run typecheck -w dashboard  # strict tsc on src and tests/unit
npm run test:e2e -w dashboard   # builds the app, then Playwright (tests/e2e) against `vite preview`
npm run verify                  # from the root: typecheck, lint, format, tests, build
```

- **Unit**: the core with no DOM or storage (model, patterns and addresses, search, the reducer,
  the backup with fixtures of the earlier format, the sample in both languages); the storage
  adapters with a fake IndexedDB; names, catalogs (same keys, no text outside them).
  The earlier app's own tests load files that no longer exist and were not ported.
- **End to end**: resolved links, edit mode, extra links, the filter and the command menu, the
  administration screens, export and import (the earlier file, wrapped and bare; merge, replace,
  new workspace; files that are refused), workspaces, preferences, two tabs, offline and CSP, and
  axe (WCAG 2.0 A/AA, 2.1 AA, 2.2 AA) on every screen and dialog, light and dark, at 1280 and
  390 px. The suites run with the browser in French (`playwright.config.js`).

## Keyboard shortcuts

| Key            | Action                                                     |
| -------------- | ---------------------------------------------------------- |
| `N`            | New application (single-key shortcut, can be turned off).  |
| `/`            | Focus the filter (single-key shortcut, can be turned off). |
| `Ctrl+K`, `⌘K` | Open the command menu (always on).                         |
| `Esc`          | Closes the open dialog or menu, and hides a tooltip.       |

## Runtime dependencies

None of its own: Covenant, dom, i18n, dates, storage and suite are workspace packages of this
repository, and `idb` comes with the storage package (decision 0003).
