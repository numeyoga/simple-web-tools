# Contributing

Thanks for your interest. These apps are small on purpose: please open an issue to discuss
any new feature before writing code.

## Ground rules

- **Local-first.** No backend, no third-party request at runtime, no analytics. Fonts, icons
  and libraries are bundled, never loaded from a CDN.
- **No runtime framework.** Vanilla JavaScript (ES modules) and native CSS. Vite is a
  development and build tool only.
- **English everywhere in code**: identifiers, comments, JSDoc, commit messages, docs.
  User-facing strings go through the app's translation catalog (English, French).
- **Accessible.** WCAG 2.2 AA: keyboard operable, visible focus, labelled controls. Browser
  tests run axe.

## Architecture

New code follows the reference architecture described in
[decision 0004](docs/decisions/0004-reference-architecture.md):

- `src/core/`: pure domain logic, no DOM and no storage. Unit-tested with Vitest.
- `src/adapters/`: IndexedDB, DOM views, files. Covered by Playwright tests.
- Types are written in JSDoc and checked by `tsc --checkJs --strict`.

## Before opening a pull request

```bash
npm run verify
npm run test:e2e
```

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), with the app or package name as
the scope:

```text
feat(chrono): add a CSV export to the weekly report
fix(storage): keep the write lock when the tab is hidden
docs: explain the single-origin storage rule
```

## Storage rules

All apps share one origin on GitHub Pages, so every persisted name is prefixed with the app
name: IndexedDB databases, `localStorage` keys, Web Locks, `BroadcastChannel` names and
Service Worker scopes. See [decision 0005](docs/decisions/0005-single-origin-hosting.md).

A schema change ships with a migration and a test that opens data written by the previous
version.
