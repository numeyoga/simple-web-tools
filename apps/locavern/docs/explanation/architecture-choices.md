# Architecture choices

This page explains why Locavern is built the way it is. The reference architecture is shared by the
apps of the repository ([decision 0004](../../../../docs/decisions/0004-reference-architecture.md));
the original product constraints, the alternatives that were considered and what became of them are
in [Technical choices](technical-choices.md). The progress of the repository as a whole is tracked
in the [roadmap](../../../../docs/roadmap.md).

## Contents

- [Autonomy and privacy](#autonomy-and-privacy)
- [Incremental delivery and controlled complexity](#incremental-delivery-and-controlled-complexity)
- [Web standards, native JavaScript and a pure functional core](#web-standards-native-javascript-and-a-pure-functional-core)
- [Design system and specialized components](#design-system-and-specialized-components)
- [Persistence, trash, encryption and portability](#persistence-trash-encryption-and-portability)

## Autonomy and privacy

The design keeps data on the device and excludes accounts and automatic synchronization. This avoids
depending on a remote business service and leaves transfers to the user's initiative. It also means
that recovering data depends on the local storage and on the exports you made.

Static distribution lets the app be hosted on GitHub Pages with no application server. The Vite
build emits relative paths (`base: './'`), so the app works under a sub-path such as
`/locavern/`. Publication is done for the whole repository by the Pages workflow
(`.github/workflows/deploy.yml`), after the checks of `ci.yml` pass. To reconcile offline use through
a service worker with a strict Content Security Policy, the CSP only allows the local origin
(`'self'`) for scripts, workers (`worker-src 'self'`) and the caching of static resources
(`connect-src 'self'`), and blocks every request or resource from a third-party domain.

During an online update, the service worker (`public/sw.js` and `src/adapters/sw-update.js`) does not
call `skipWaiting()` automatically on an installed app, so that a new set of scripts never takes over
in the middle of an open editing session; the switch is triggered by the user. Because all the apps
share one origin, the worker only deletes caches whose name starts with `locavern-`.

## Incremental delivery and controlled complexity

Rather than building every screen at once, the app grew in layers:

1. **Lot 1 (MVP, `0.1.0`)**: a modern JavaScript base (`.js` ESM + JSDoc), an immutable state store,
   local IndexedDB storage (`idb`), project and task management (List and Kanban views), rich-text
   notes (Tiptap Core) and a full ZIP import/export.
2. **Lot 2 (whiteboard, `0.2.0`)**: the `whiteboards` collection (`schemaVersion: 2`, transparent
   `v1` to `v2` migration) and the native interactive SVG canvas
   (`src/adapters/whiteboard-canvas.js`).
3. **Functional additions on `0.2.0`**: the Today view, the Calendar (Month / Week) and `.ics`
   export, task recurrence, tags, internal links and local templates, `.md` export and note
   duplication, the local trash (`DB_VERSION = 4`), AES-GCM encryption and merge / project selection
   on ZIP import, the advanced whiteboard features (selection by area, arrow snapping, 20 px grid,
   duplication, fit to view), a command palette with full-content search, and the English and
   French interface.

Stabilizing the immutable core model and the split between `src/core/` and `src/adapters/` first made
it possible to add each new capability (calendar dates, recurrence, `.ics` and Markdown
serialization, whiteboard geometry, cryptography, multi-word search, identifier merging) without
bringing UI dependencies into the business logic.

## Web standards, native JavaScript and a pure functional core

Choosing semantic HTML5, native CSS and recent **JavaScript (`.js`, ES modules)** pushes alignment
with web standards as far as possible. The application code can be read and run by the browser
without a language transpilation step. To keep strict static typing on the business model, the store
commands and the data migrations, contracts are declared in `.d.ts` files and checked through
**JSDoc** annotations by `tsc` (`npm run typecheck`). Vite is only used to resolve npm packages
(`@tiptap/core`, `idb`, `fflate`) and to produce the distribution bundle.

Without an application framework, the main risk of a multi-view interface (keeping a task in sync
between **Today**, the list, the Kanban, the **Calendar** and the detail panel, or keeping links and
backlinks consistent between tasks, notes and whiteboards) is scattering mutable state across the DOM
([decision 0003](../../../../docs/decisions/0003-no-runtime-framework.md)). To avoid it, the architecture combines:

- a **pure functional core** (`src/core/`) that holds the model, the immutable state store
  (`dispatch` producing `{ state, effects }`), date and recurrence computation (`dates.js`), pure
  serializations (`ical.js`, `markdown.js`), search (`search.js`), templates (`templates.js`),
  whiteboard geometry (`whiteboard.js`), archive merging (`backup.js`), schemas (`schema.js`),
  cryptography (`crypto-archive.js`) and the translation helpers (`messages.js`, `locale.js`,
  `format.js`);
- **adapters** (`src/adapters/` and `src/adapters/dom/`) that isolate side effects: DOM rendering
  (`<dialog>`, Popover API, Pointer Events), IndexedDB persistence through `idb` and the shared
  `@simple-web-tools/storage` package, file writing through `showSaveFilePicker` with an
  `<a download>` fallback, the service worker lifecycle, the Tiptap Core wrapper and the native SVG
  whiteboard engine.

For **task recurrence**, the next occurrence is computed in a pure, synchronous way in the store
reducer as soon as the task reaches a final status (no background job, no asynchronous clock), which
makes the behavior deterministic offline and testable without a browser.

## Design system and specialized components

Instead of designing a CSS methodology from scratch, the interface relies on the conventions of the
**Covenant Design System** for Vanilla web apps: semantic design tokens as `--cv-*` CSS custom
properties (light and dark themes), fonts and icons bundled locally, and WCAG 2.2 AA accessibility.
Covenant now comes from the shared package `@simple-web-tools/covenant`, bundled by Vite, so Locavern
no longer carries its own copy.

For rich text, **Tiptap Core** is used in headless mode (no React or Vue wrapper) behind a dedicated
adapter, completed by a pure serializer (`src/core/markdown.js`) so that Markdown export needs no
extra third-party converter. The editor and the whiteboard screen are code-split with dynamic
`import()` (`src/adapters/rich-text-lazy.js`, `src/adapters/dom/whiteboard-view-lazy.js`), which keeps
the startup bundle under Vite's 500 kB chunk warning; the service worker precaches every chunk
listed in `precache-manifest.json`, so both open offline after a first visit.

The whiteboard colours are app-level tokens (`--lc-wb-*` in `src/styles/app.css`) built only from
Covenant semantic roles, never from primitive scale tokens. Exports (SVG, PNG) read their computed
values and write concrete colours into the file.

For the calendar, generating RFC 5545 files directly in `src/core/ical.js` (folding at 75 UTF-8
bytes, escaped delimiters, all-day events) avoids any external library and keeps local
`YYYY-MM-DD` dates free from unstable time zone handling.

For the **whiteboard**, **option A (a native SVG canvas with Pointer Events and keyboard shortcuts)**
was chosen over external libraries (`Fabric.js`, `@quickdrawjs/core`) for four reasons:

1. **No extra runtime dependency**: a light bundle and full control of the CSP, including for arrow
   snapping and grid snapping, which live in `src/core/whiteboard.js`;
2. **Native WCAG 2.2 AA accessibility**: each SVG element (`<g tabindex="0" role="group">`) takes
   part in the tab order, in screen reader output and in the keyboard shortcuts (arrows,
   `Shift+Space`, `Enter`/`F2`, add to center without drag and drop);
3. **Direct integration with Covenant**: the five shape color tokens follow the light/dark theme
   switch without reinitializing the canvas;
4. **Data durability**: the pivot `Whiteboard` format (`viewport`, `elements`, `assetIds`, arrow
   attachments) stays independent of any third-party library.

## Persistence, trash, encryption and portability

`IndexedDB` keeps the working state in the browser, accessed through the `idb` micro-library to make
promises, transactions and incremental schema migrations reliable (`DB_VERSION = 4`, which added the
`trash` and `templates` stores). Calling `navigator.storage.persist()` lowers the risk of automatic
eviction by the browser, and the Web Locks API (`navigator.locks`) protects against concurrent
writes between tabs.

A strict distinction is kept between structured data and binary assets (local images stored as a
`Blob` in `assets`). When an item is deleted, moving it to the trash avoids destroying its data
right away; only at the final purge (manual, or after the configured delay) does a cleanup pass
remove the `links` references that point at the purged item and then delete the `Blob`s that became
orphaned.

For the **optional archive encryption**, using only the native **Web Crypto** API (`crypto.subtle`,
`PBKDF2-SHA-256` and `AES-256-GCM` with an explicit AAD, on a ZIP envelope that holds
`encryption.json` and `payload.enc`) brings strong confidentiality at rest without enlarging the
bundle or compromising the readability of existing plain archives (`schemaVersion: 1` and `2`).

For non-destructive import (**merge** or **project selection**), `prepareBackupMerge` in
`src/core/backup.js` reallocates colliding identifiers consistently across projects, tasks, notes,
whiteboards and images before writing to `IndexedDB`, so nothing existing is silently overwritten.
Writing to disk prefers `window.showSaveFilePicker` (so the user picks the location and a
cancellation is detected before `meta.lastBackupAt` is updated), with a transparent fallback to
`<a download>` where the API is not exposed.
