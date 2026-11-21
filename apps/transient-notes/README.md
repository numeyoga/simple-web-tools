# Transient Notes

Local-first notes sorted with the [PARA method](https://fortelabs.com/blog/para/): four categories
(Projects, Areas, Resources, Archives) that hold folders, and rich-text notes with images in the
folders. No backend, no account: the notes stay in the browser, in IndexedDB. The interface is
in English and French.

It is a rewrite of the earlier Transient Notes prototype, on the repository's
[reference architecture](../../docs/decisions/0004-reference-architecture.md).

> Work in progress: the shell, the data model, the storage, the workspaces and the three-pane
> interface with its rich-text editor are in place; the remaining journeys and the full
> accessibility matrix come next (see the [roadmap](../../docs/roadmap.md), step 6). This README
> grows with them.

## Running locally

```bash
npm install                      # at the repository root: one lockfile for every workspace
npm run dev -w transient-notes   # Vite dev server
npm run verify                   # at the root: typecheck, lint, format check, unit tests, build
npm run test:e2e -w transient-notes   # builds, then runs Playwright against `vite preview` (port 4175)
```

## Layout

| Path                | What it holds                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`         | Pure logic, no DOM, no storage, no clock: model, `reduce(state, command)`, selectors, search, exports, backup, preferences |
| `src/adapters/`     | IndexedDB, the single-writer store, workspaces, backup file, i18n, preferences, PWA                                        |
| `src/adapters/dom/` | The views (built with `createElement`, never `innerHTML`) and the Covenant helpers                                         |
| `src/i18n/`         | English (reference) and French catalogs                                                                                    |
| `tests/unit/`       | Vitest: the core, the storage adapter with a fake IndexedDB, the catalogs                                                  |
| `tests/e2e/`        | Playwright and axe: the journeys, the CSP and the offline start                                                            |

## Data and storage

Every persisted name starts with `transient-notes` (all the apps share one origin, see
[decision 0005](../../docs/decisions/0005-single-origin-hosting.md)); `src/adapters/names.js` is
where they are built and `tests/unit/names.test.js` checks the prefix.

| Where                                 | Name                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB, one database per workspace | `transient-notes__<workspace id>` (stores `meta`, `folders`, `notes`, `assets`)                                                                                                          |
| Web Lock, one for the whole app       | `transient-notes-write-lock`                                                                                                                                                             |
| BroadcastChannel                      | `transient-notes-sync-<workspace id>`, `transient-notes-lock-channel`                                                                                                                    |
| localStorage                          | `transient-notes-workspaces`, `transient-notes-workspace-active`, `transient-notes-theme`, `transient-notes-text-size`, `transient-notes-single-key-shortcuts`, `transient-notes-locale` |
| Cache Storage                         | `transient-notes-shell-<build id>`                                                                                                                                                       |

Schema version 1 of a workspace database: `folders` `{ id, name, category, createdAt }`, `notes`
`{ id, title, doc, folderId, createdAt, updatedAt }` (`doc` is a rich-text document, timestamps
are ISO 8601), `assets` `{ id, mime, size, createdAt, blob }`, `meta` `{ key, value }`. The JSON
backup is `{ app, format: 'transient-notes-workspace', version: 1, exportedAt, data }` with the
pictures inside as base64.

## Runtime dependencies

None of its own: Covenant, i18n, dates, storage and rich-text are workspace packages of this
repository. The Tiptap dependency of the editor is explained in
[`packages/rich-text`](../../packages/rich-text/README.md).
