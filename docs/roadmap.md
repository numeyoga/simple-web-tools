# Roadmap

Convergence work between the apps, in order. Each step leaves `main` deployable.

## 1. Foundation (done)

- [x] Monorepo with npm workspaces, shared Node version, Prettier, CI and Pages deployment.
- [x] Locavern and Chrono imported with their history.
- [x] Root docs: README, contributing guide, security policy, architecture decisions.

## 2. Publish

- [x] Create the public GitHub repository and enable Pages ("GitHub Actions" source).
- [ ] Replace Locavern's old Pages site with a redirect to its new path.
- [ ] Put a "this app has moved" notice on Chrono's GitLab Pages site, with a link to
      [Moving your data](moving-your-data.md). Archive the old repositories afterwards.

## 3. Shared packages

Extracted from Locavern, the reference app ([decision 0004](decisions/0004-reference-architecture.md)):

- [x] `packages/config`: ESLint, Prettier and `jsconfig` bases. Lint `scripts/` too.
- [x] `packages/covenant`: a single copy of the design system, copied byte for byte from the
      `covenant-design-system` skill (`.claude/skills/`, in English, WCAG 2.2 AA), with a sync
      script and a test that fails when the two drift. IBM Plex and Phosphor are bundled from
      npm, never loaded from a CDN. Locavern uses it; Chrono adopts it when it is ported (step 4).
- [x] `packages/i18n`: message catalogs, plurals, `Intl` formatting ([decision 0002](decisions/0002-english-code-translated-ui.md)).
- [x] `packages/storage`: IndexedDB opening and migrations, single-writer Web Lock, workspaces,
      JSON export and import, name prefixing.
- [x] `packages/dates`: local calendar dates, DST-safe arithmetic.
- [x] `packages/test-utils`: fake IndexedDB setup, Playwright and axe presets.

## 4. Port Chrono

- [x] **Before porting, and before `packages/covenant`, compare the two interfaces.** Chrono's interface is considered more
      attractive than Locavern's. List the visual differences (density, typography,
      surfaces, color use, icons, motion, layout) and decide which ones become Covenant
      defaults, so that the port keeps Chrono's look instead of falling back to Locavern's.
- [x] IIFE scripts to ES modules with Vite; `src/core` and `src/adapters` split. Chrono still
      carries its own `covenant.css` and Google Fonts import: both give way to
      `@simple-web-tools/covenant` when its interface is ported.
- [ ] English identifiers; English and French interface. English identifiers done; interface
      translation comes with i18n.
- [x] Single-writer multi-tab model; storage on `packages/storage`.
- [x] Unit tests moved from `node:test` to Vitest; Playwright and axe journeys added.
      Axe (WCAG 2.2 AA) runs on the four views and every dialog, in both themes, at 1280 and 390 px.
- [ ] Bundled fonts, strict CSP, PWA. Chrono's typecheck already covers all of `src` and the unit tests (views included).

## 5. Translate Locavern

- [ ] English identifiers are already in place: extract the French interface strings into
      catalogs and add English.
- [ ] Translate the user documentation, English first.

## Known issues inherited from the imported apps

- Locavern's `src/styles/app.css` still uses primitive Covenant tokens that have no semantic role
  (the skill's rule forbids them in component CSS). They need a decision: add roles to the skill,
  or build app-level tokens from semantic ones.
  - Whiteboard artwork (12 references): `--lc-wb-*` tokens (lines about 682-715) and the stroke
    and fill rules (about 1004-1028) use `accent-500`, `accent-800`, `success-700`, `warning-600`
    and `danger-700`.
  - Status borders and stripes (10 references): `warning-600`, `info-600`, `danger-500`,
    `warning-500`, `info-500` (lines about 1243-1510 and 2166). `--cv-<status>-border` is the
    nearest role; check that it reaches 3:1 where the stripe carries meaning.

- Locavern's main bundle exceeds Vite's chunk size warning; the notes editor is a candidate
  for a lazy import.
