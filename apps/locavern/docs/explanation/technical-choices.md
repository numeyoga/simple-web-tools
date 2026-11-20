# Technical choices

The product and technical decisions taken when Locavern was designed (12-13 November 2026), with
what became of each one. This page is the decision record; [Architecture choices](architecture-choices.md)
explains how the delivered code is organized and why, and does not repeat the constraints below.

The original text came from a conversation about a first prototype (a whiteboard only). It listed
many items as proposals. Since then the app has been delivered and moved into the Simple Web Tools
monorepo, so every decision below carries its **status today**, checked against the code and
`package.json`. Prototype progress reports (test counts, commit hashes, environment problems) were
dropped: they described a state that no longer exists and are kept in the git history.

## Contents

- [Goal and features](#goal-and-features)
- [Fundamental constraints](#fundamental-constraints)
- [Stack](#stack)
- [Code architecture](#code-architecture)
- [Whiteboard](#whiteboard)
- [Rich text](#rich-text)
- [Storage and backups](#storage-and-backups)
- [Privacy](#privacy)
- [CSS](#css)
- [Quality and tests](#quality-and-tests)
- [Documentation](#documentation)
- [Choices that were left open](#choices-that-were-left-open)

## Goal and features

Locavern is a personal productivity web app, functionally inspired by Nanoboard. The features
planned at the start were: projects and tasks, a List view, Kanban boards, a calendar of due dates,
standalone notes, a whiteboard, rich descriptions with links, checklists and local images, manual
import and export, a dark mode, and installation with offline use.

Status today: all of them are delivered (see the [README](../../README.md) for the feature list).

## Fundamental constraints

Confirmed decisions, all still in force:

- Local-first application, no remote backend, no application server needed at runtime.
- Static distribution compatible with GitHub Pages.
- Main target: a recent desktop Chrome.
- Prefer web standards; no application framework at runtime, neither React nor Vue nor an
  equivalent ([decision 0003](../../../../docs/decisions/0003-no-runtime-framework.md)). Development
  tools may use a local server.
- No user account, no automatic synchronization. Backups and transfers only through user-triggered
  import and export.
- No business network call, telemetry or analytics service, and no resource loaded from a third
  party.

Loading from GitHub Pages needs requests for static files. The promise is that no business data is
transmitted; a remote host cannot guarantee the absolute absence of any connection.

External components are accepted for complex functions if they cover the need and respect the
runtime and privacy constraints.

## Stack

| Item                    | Choice at the start       | Status today                                                                              |
| ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Language                | Strict TypeScript         | Changed: JavaScript ES modules with JSDoc types, checked by `tsc --checkJs --strict`      |
| Interface               | Semantic HTML, native DOM | Delivered                                                                                 |
| Styles                  | Native CSS                | Delivered, on the shared Covenant design system                                           |
| Development and build   | Vite                      | Delivered; Vite is a tool only                                                            |
| Whiteboard              | Quickdraw Core 0.3.0      | Replaced by a native SVG canvas, see [Whiteboard](#whiteboard)                            |
| Rich text               | Tiptap Core               | Delivered (Tiptap Core v3, a minimal set of extensions)                                   |
| Storage                 | Native IndexedDB          | Delivered through `idb` (see [Choices that were left open](#choices-that-were-left-open)) |
| Unit tests              | Vitest                    | Delivered                                                                                 |
| Browser tests           | Playwright                | Delivered                                                                                 |
| Automated accessibility | axe-core via Playwright   | Delivered (Playwright journeys with axe checks)                                           |
| Static analysis         | ESLint and TypeScript     | Delivered, shared configuration in `packages/config`                                      |
| Formatting              | Prettier                  | Delivered                                                                                 |
| Continuous integration  | GitHub Actions            | Delivered, for the whole monorepo                                                         |

The Node.js version is the one in the root `.nvmrc` of the monorepo. Direct dependencies are pinned
in `package.json` and the single root `package-lock.json` keeps the resolution of transitive ones.

## Code architecture

Confirmed decisions, delivered (see [Architecture choices](architecture-choices.md) and
[decision 0004](../../../../docs/decisions/0004-reference-architecture.md)):

- Favor the functional paradigm, with pure functions for business rules and transformations.
- Isolate effects in adapters: DOM, IndexedDB, files, external components.
- Keep business data independent of library instances, and avoid shared mutable global state.
- The internal classes of an external component must not dictate Locavern's architecture.

The proposals that were not yet formalized are now in place: code and identifiers in English, files
in `kebab-case`, `camelCase` variables and functions, `PascalCase` types, readonly business types,
organization by feature, and Conventional Commits.

## Whiteboard

Initial choice: `@quickdrawjs/core` 0.3.0, because it worked without React, was MIT licensed, had no
declared runtime dependency, and brought an editor and toolbar, drawing, shapes, text, notes, images,
selection, zoom, history, JSON snapshots and PNG export.

Known limits at the time: a young project, accessibility not fully validated, an English-only
toolbar, no announced layers, frames or rich text, SVG export and Excalidraw compatibility not
established, connectors following shapes to be checked, and graphic property validation still
partial.

Excalidraw and tldraw were not retained, notably because their standard integration needs React.
Fabric.js was kept as a fallback and maxGraph as a lead for structured diagrams. Kritzel was not
retained. No audit established a malicious intent in Quickdraw or Kritzel; that is not a guarantee of
harmlessness either.

Status today: none of these libraries is used. The whiteboard is a native SVG canvas with Pointer
Events and keyboard shortcuts, for the reasons given in [Architecture choices](architecture-choices.md#design-system-and-specialized-components).
It removes the limits above (accessibility, language, SVG export, arrow snapping), and the pivot
data format belongs to Locavern.

## Rich text

Confirmed choice: Tiptap Core. Locavern is not meant for very detailed document writing.

Initial scope: paragraphs, emphasis, links, checklists and local images. Out of scope: complex
tables, advanced page layout, code blocks, remote collaboration, cloud or AI services, and
specialized extensions with no demonstrated need.

Integration principles, all applied:

- Use Core without a React or Vue wrapper.
- Select only the free extensions that are needed.
- Isolate the editor behind an adapter (`src/adapters/rich-text-tiptap.js`).
- Store a validated JSON document.
- Control URLs, imports and pastes, and never load an image from a remote URL.

Status today: delivered. The scope grew to headings 1 to 3, strikethrough, inline code and bulleted
and numbered lists, and the editor is `@tiptap/core` v3 with the extensions listed in
`package.json`. The one point of the original scope that differs is code: inline code is supported,
code blocks are not.

## Storage and backups

Confirmed decisions, all delivered:

- IndexedDB holds the working state in the browser.
- No automatic saving to a file chosen on disk.
- Manual import and export, in versioned JSON; the schema version is distinct from the app version.
- Images are included in transferable backups; a `blob:` URL is not a standalone backup.
- A storage error must be shown, and browser storage does not replace an exported backup.

Limits that were declared then: no application-level encryption, plain exports, a quick close that
can interrupt a write, and storage that the user can clear or that can become unavailable.

Status today: backups are ZIP archives (plain or password-encrypted), with merge and selective
import, a local trash, and optional saving to a chosen folder. See
[Storage limits and errors](../reference/storage-limits-and-errors.md). Single-writer locking through
Web Locks is shared by all apps through `packages/storage`. Browser storage can still be cleared by
the user, which is why exporting remains advised.

## Privacy

Confirmed decisions, all delivered: no business backend, no telemetry, no remote error report, no font,
image or library loaded from a CDN, no remote link preview, no user data in URLs, no freely imported
active HTML, and no automatic synchronization transport.

The production build injects a strict Content Security Policy that forbids network connections other
than to the app's own origin, embedded frames, objects, remote images and form submissions. Raster
images embedded as `data:` and `blob:` URLs are allowed. The policy complements the application
validations; on its own it is not proof that nothing leaks. The exact policy is in `vite.config.js`;
it still allows inline styles (`style-src 'self' 'unsafe-inline'`), and the service worker is allowed
for the app's own origin only (`worker-src 'self'`).

## CSS

Confirmed: native CSS, no CSS framework, formatting with Prettier.

Recommendations that were still to be confirmed then: CUBE CSS to organize styles, light BEM naming,
semantic tokens as custom properties, `@layer` to control the cascade, third-party styles in a
`vendor` layer, Grid and Flexbox, logical properties and relative dimensions, low-specificity
selectors, no IDs for styling, avoiding `!important`, respecting `prefers-reduced-motion`, and
Stylelint to complement Prettier.

Status today: the semantic tokens and the component conventions come from the Covenant design system
(`@simple-web-tools/covenant`) and the app's own rules are in `src/styles/app.css`. CUBE CSS and
Stylelint were not adopted (no Stylelint dependency or configuration exists in the repository).

## Quality and tests

Tools in place at the time: strict TypeScript, ESLint, Prettier, Vitest, Playwright, axe-core and
GitHub Actions. Still to be defined then: complete accessibility criteria, a coverage policy,
additional ESLint rules, CSS lint, and a test strategy for migrations and future editors.

Status today: the accessibility criterion is WCAG 2.2 AA, checked by axe in the Playwright journeys
(several of them in both themes). Migrations are tested against data in the previous format. A coverage policy and CSS lint remain undefined.

## Documentation

Decisions at the time: user and technical documentation in French, organized by Diataxis, concise and
factual, distinguishing implemented behavior from recommendation and research; relative links
between documents.

Status today: Diataxis and the factual style are kept. The language changed: documentation is
English, and the interface is available in English and French
([decision 0002](../../../../docs/decisions/0002-english-code-translated-ui.md)).

## Choices that were left open

| Topic             | Proposal at the time                           | What was done                                                                                                |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Kanban            | SortableJS, with independent keyboard commands | Native HTML drag and drop, an actions menu and `Alt` + arrow keys                                            |
| Calendar          | Native month view and agenda                   | A native Month and Week grid with an `.ics` export                                                           |
| Tiptap extensions | A free and minimal set                         | Done                                                                                                         |
| Code organization | Modules by feature                             | `src/core` and `src/adapters` ([decision 0004](../../../../docs/decisions/0004-reference-architecture.md))   |
| Naming            | English, kebab-case / camelCase / PascalCase   | Done                                                                                                         |
| CSS               | CUBE + light BEM + tokens + layers             | Covenant tokens and components; CUBE not adopted                                                             |
| CSS lint          | Stylelint                                      | Not adopted                                                                                                  |
| Extended storage  | Native IndexedDB, other libraries if justified | `idb` (a small wrapper), see `apps/locavern/README.md`                                                       |
| Local files       | Optional File System Access                    | Delivered (`showSaveFilePicker`, export folder)                                                              |
| PWA               | Manifest and native service worker             | Delivered, with an update notice                                                                             |
| Publication       | GitHub Pages, automation to define             | Delivered for the whole monorepo ([decision 0005](../../../../docs/decisions/0005-single-origin-hosting.md)) |

A service worker allows reopening the app offline, but its installation and updates can issue
requests for static files; it does not guarantee a total absence of remote connections.
