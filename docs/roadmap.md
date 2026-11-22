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

## 7. Shared app kit

Three more apps are coming (steps 8 to 10). What every app copies today moves to shared code
first, so that the new apps start from it instead of adding three more copies.

- [x] **CSS reset in Covenant.** Each app resets on its own (`html, body { margin: 0 }`,
      `.ch-title-reset`, repeated `margin: 0`), and Locavern forgot it (fixed in `2ad3c67`).
      Make the change in the `covenant-design-system` skill, then sync the package:
  - a minimal modern reset in Covenant's base, inside `@layer cv-reset`: it beats the browser's
    styles but loses to every unlayered rule, so no component or app rule changes. Body
    margin; margins of headings, paragraphs, lists, `figure`, `blockquote`, `dl`, `dd`;
    `img, picture, video, canvas` as `display: block; max-width: 100%`; `overflow-wrap` on
    text; `text-wrap: balance` on headings. Inline `svg` is left alone (icons and logos);
  - `.cv-prose`: the vertical rhythm of user content (notes, rich-text surface, Markdown
    preview, slides), since the reset removes the browser's margins;
  - the apps drop their own reset rules and use `.cv-prose` where they show user content;
  - safety net: screenshots of the main views of the three apps, both themes, 1280 and 390 px,
    taken before and compared after; any difference is explained or fixed.
- [x] **`packages/pwa`**: the offline shell rules (`src/core/pwa.js`), the worker source and
      the Vite plugin (CSP meta tag, `precache-manifest.json`, build id stamp) are three
      copies today. One package, parameterised by the app id and its CSP; the three apps use
      it with no change in behaviour (same cache names, same tests passing).
- [x] **`packages/dom`**: Chrono's `ui.js` and `lib.js`, copied into Transient Notes, are one
      package with the no-`innerHTML` rule they enforce: the `el()` builder, and the Covenant
      component builders (`createUi`) parameterised by the app's class prefix and translator.
      Chrono and Transient Notes use it; formatting and project colours stay in the app.
- [x] **Tooltip fix in Covenant**: `liftTooltip` and `placeTooltip` went to the skill (top layer,
      the side with room), joined by Locavern's wrapper-less form (`data-cv-tooltip`,
      `Covenant.setTooltip`), then to the package and to the three apps, which dropped their own
      tooltip code.
- [x] **Opt-in third-party requests**: [decision 0008](decisions/0008-opt-in-third-party-requests.md), for features that contact a
      third party only after the person turns them on, off by default, with the host named
      in the setting and allowed by the app's CSP only. Favoris' site icons are the first
      case (step 8); a future sync would be the next.

## 8. Port Favoris

A rewrite of [favoris](https://github.com/numeyoga/favoris): bookmark pages in several spaces,
groups with a colour, a featured flag and folding, drag and drop, search, JSON import and
export. Today it is one 1,600-line `index.html` with inline script and style, `localStorage`,
Phosphor and IBM Plex from CDNs, site icons from Google and an optional Appwrite sync. The
`favoris.html` page of the customizable dashboard is an older copy of it and is not ported.

- [ ] `apps/favoris` (name "Favoris") on the reference architecture: Vite, `src/core` and
      `src/adapters`, Covenant, `packages/pwa`, English and French catalogs, strict CSP.
- [ ] Spaces become workspaces (`favoris__<id>`, one database each, one write lock); groups
      and links in IndexedDB through `packages/storage`, with a schema version.
- [ ] **Existing data**: the old app is served from `numeyoga.github.io/favoris/`, the same
      origin as the suite, so its `localStorage` is readable. On first start, import
      `favoris.spaces`, `favoris.v1:<id>` and the legacy `favoris.v1` into workspaces, keep the
      old keys untouched, and test it with fixtures of the old format. The old JSON export
      (`{ space, tags, links }`, no version) is accepted by the import.
- [ ] Links accept `http:` and `https:` URLs only (the prototype lets an imported
      `javascript:` URL through); imported records are validated one by one.
- [ ] Site icons: a coloured initial by default; a preference "Load site icons from Google",
      off by default, names the host and is the only reason `img-src` allows it (decision 0008).
- [ ] Native `prompt` and `confirm` give way to Covenant dialogs; tooltips are Covenant's.
- [ ] No sync in this step (see step 11).
- [ ] Vitest for the core, the migration and the storage adapter; Playwright and axe journeys
      in both themes, at 1280 and 390 px; docs; registered in `packages/suite`.

## 9. Port Dashboard

A rewrite of [customizable-dashboard](https://gitlab.com/wallartn/customizable-dashboard):
one place to reach the links of many applications across environments. Templates define the
environments, the metadata fields and the link patterns (`{env}`, `{slug}`, `{jiraKey}`,
`{meta}`); each application fills them in and adds extra links. Admin screens for templates,
metadata fields, tags, import and export, profiles and settings.

- [ ] `apps/dashboard` (name "Dashboard") on the reference architecture, as in step 8.
- [ ] Profiles become workspaces (`dashboard__<id>`); data in IndexedDB through
      `packages/storage`, with a schema version.
- [ ] **Existing data**: the old app is on GitLab Pages, another origin, so its data comes
      over by its JSON export (`{ version: 1, exportedAt, data }`, or the bare object). The
      import accepts it, with a test that loads that format; merge and replace are kept.
- [ ] The prototype's dead tests (they load files that no longer exist) are not ported; the
      core gets its own tests. Ctrl+K opens Covenant's command palette.
- [ ] Vitest, Playwright and axe journeys, docs, registered in `packages/suite`.

## 10. Port Slides

A port of [presentation-engine](https://gitlab.com/wallartn/presentation-engine): Markdown
slides read from a local folder (`slides.md` and its images), with a presenter window
(notes, next slide, timers) kept in step through a `BroadcastChannel`, an overview and a
print view. Its parser and state are already pure and its identifiers are English, so this
is a port rather than a rewrite. It stores nothing.

- [ ] `apps/slides` (name "Slides"): parser, frontmatter, directives and store move to
      `src/core`; the folder reader, timers and views to `src/adapters`. The app chrome uses
      Covenant; the slide themes stay the app's own CSS, built on Covenant tokens.
- [ ] Runtime dependencies justified in the README (decision 0003): `marked`, `yaml`,
      `highlight.js` (core and the registered grammars only) and `mermaid`.
- [ ] **Mermaid on demand**: a lazy chunk, loaded only when a slide has a diagram and
      precached for offline use. Its SVG carries inline styles, so `style-src` allows
      `'unsafe-inline'` in this app only, with the reason in the README.
- [ ] **Sanitize the slide HTML**: raw HTML in `slides.md` reaches `innerHTML` today
      (`<img onerror>` would run). The rendered HTML goes through a sanitizer before it is
      inserted; `script-src 'self'` stays the second line of defence. Remote images are
      blocked by the CSP: document it and show a placeholder.
- [ ] The `BroadcastChannel` is named with the app prefix; French strings move to catalogs.
- [ ] Vitest for the core (the existing 19 tests, plus store, keyboard map, timers);
      Playwright: load a folder, navigate, presenter sync, print; axe on the chrome.
- [ ] Docs, registered in `packages/suite`.

## 11. Retire the old sites

- [ ] Favoris: the old Pages site (`numeyoga.github.io/favoris/`) shows a "this app has moved"
      notice with a link. It must not redirect before the new app has imported the data:
      the import runs in the new app, on the same origin, whatever the old one does.
- [ ] Dashboard and presentation-engine: a notice on their GitLab Pages sites, with the
      export steps for the dashboard.
- [ ] Archive the three repositories, after the maintainer confirms.

## 12. Sync (later)

Favoris' prototype had an optional sync. It is not ported in step 8; if it comes back, it
comes for the whole suite: one design (pluggable backend, per workspace, off by default,
decision 0008), not one per app.

## Known issues inherited from the imported apps

None at the moment.
