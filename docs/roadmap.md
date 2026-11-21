# Roadmap

Convergence work between the apps, in order. Each step leaves `main` deployable.

## 1. Foundation (done)

- [x] Monorepo with npm workspaces, shared Node version, Prettier, CI and Pages deployment.
- [x] Locavern and Chrono imported with their history.
- [x] Root docs: README, contributing guide, security policy, architecture decisions.

## 2. Publish (done)

- [x] Create the public GitHub repository and enable Pages ("GitHub Actions" source).
- [x] Replace Locavern's old Pages site with a redirect to its new path.
- [x] Put a "this app has moved" notice on Chrono's GitLab Pages site, with a link to
      [Moving your data](moving-your-data.md). Archive the old repositories afterwards.

## 3. Shared packages

Extracted from Locavern, the reference app ([decision 0004](decisions/0004-reference-architecture.md)):

- [x] `packages/config`: ESLint, Prettier and `jsconfig` bases. Lint `scripts/` too.
- [x] `packages/covenant`: a single copy of the design system, copied byte for byte from the
      `covenant-design-system` skill (`.claude/skills/`, in English, WCAG 2.2 AA), with a sync
      script and a test that fails when the two drift. IBM Plex and Phosphor are bundled from
      npm, never loaded from a CDN. Locavern and Chrono use it.
- [x] `packages/i18n`: message catalogs, plurals, `Intl` formatting ([decision 0002](decisions/0002-english-code-translated-ui.md)).
- [x] `packages/storage`: IndexedDB opening and migrations, single-writer Web Lock, workspaces,
      JSON export and import, name prefixing.
- [x] `packages/dates`: local calendar dates, DST-safe arithmetic.
- [x] `packages/test-utils`: fake IndexedDB setup, Playwright and axe presets.

## 4. Port Chrono (done)

- [x] **Before porting, and before `packages/covenant`, compare the two interfaces.** Chrono's interface is considered more
      attractive than Locavern's. List the visual differences (density, typography,
      surfaces, color use, icons, motion, layout) and decide which ones become Covenant
      defaults, so that the port keeps Chrono's look instead of falling back to Locavern's.
- [x] IIFE scripts to ES modules with Vite; `src/core` and `src/adapters` split. Chrono's own
      `covenant.css` and Google Fonts import gave way to `@simple-web-tools/covenant`.
- [x] English identifiers; English and French interface.
- [x] Single-writer multi-tab model; storage on `packages/storage`.
- [x] Unit tests moved from `node:test` to Vitest; Playwright and axe journeys added.
      Axe (WCAG 2.2 AA) runs on the four views and every dialog, in both themes, at 1280 and 390 px.
- [x] Bundled fonts, strict CSP, PWA. Chrono then joins Locavern's architecture: its typecheck
      covers all of `src` and the unit tests (views included), and its README is in English.

## 5. Translate Locavern (done)

- [x] English identifiers are already in place: extract the French interface strings into
      catalogs and add English.
- [x] Translate the user documentation, English first.

## 6. Add Transient Notes

A rewrite, not an import, of the [Transient Notes](https://github.com/numeyoga/transient-notes)
prototype (notes sorted with the PARA method, images, text export). The prototype builds its
markup with `innerHTML`, keeps images as `data:` URLs and has French strings in its code; it
has no users, so no data is migrated and its history is not imported.

- [x] `packages/rich-text`: Locavern's Tiptap editor, document sanitizing, plain-text and
      Markdown conversion, extracted so that both apps use one copy (decision 0004). Labels
      and tooltips are passed in by the app. Locavern switches to it with no visible change.
- [x] `apps/transient-notes` on the reference architecture: Vite, `src/core` and
      `src/adapters`, Covenant, English and French catalogs, storage on `packages/storage`
      (one database per workspace, one write lock for the app), strict CSP, PWA scoped to its path.
- [x] Features: PARA categories with folders (create, rename, delete, choose the category),
      notes (create, edit, move, delete after confirmation), search, sort, images pasted or
      dropped and kept as local assets, export of a note or of all notes as text or
      Markdown, JSON backup and restore, preferences (theme, text size, language,
      single-key shortcuts).
- [x] Workspaces, as in Chrono: several independent sets of notes (one database each,
      `transient-notes__<id>`), to keep notes apart by role or by importance. Create, rename,
      delete, switch; the JSON backup covers the current workspace.
- [x] Vitest for the core and the storage adapter; Playwright and axe journeys in both
      themes, at 1280 and 390 px.
- [x] Root README, app README in English, published with Chrono and Locavern.

Follow-ups that came out of this step are listed in [To do](todo.md).

## Known issues inherited from the imported apps

None at the moment.
