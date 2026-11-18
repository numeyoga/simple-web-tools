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
- [ ] `packages/covenant`: a single copy of the design system. Today Locavern and Chrono each
      carry their own version, and Chrono's loads Google Fonts from a CDN. Translate the
      `covenant-design-system` skill (`.claude/skills/`) to English at the same time.
      **Do this after the interface comparison of step 4**: extracting Locavern's copy first
      would make Locavern's look the default, which the comparison exists to avoid.
- [ ] `packages/i18n`: message catalogs, plurals, `Intl` formatting ([decision 0002](decisions/0002-english-code-translated-ui.md)).
- [ ] `packages/storage`: IndexedDB opening and migrations, single-writer Web Lock, workspaces,
      JSON export and import, name prefixing.
- [x] `packages/dates`: local calendar dates, DST-safe arithmetic.
- [x] `packages/test-utils`: fake IndexedDB setup, Playwright and axe presets.

## 4. Port Chrono

- [ ] **Before porting, and before `packages/covenant`, compare the two interfaces.** Chrono's interface is considered more
      attractive than Locavern's. List the visual differences (density, typography,
      surfaces, color use, icons, motion, layout) and decide which ones become Covenant
      defaults, so that the port keeps Chrono's look instead of falling back to Locavern's.
- [ ] IIFE scripts to ES modules with Vite; `src/core` and `src/adapters` split.
- [ ] English identifiers; English and French interface.
- [ ] Single-writer multi-tab model; storage on `packages/storage`.
- [ ] Unit tests moved from `node:test` to Vitest; Playwright and axe journeys added.
- [ ] Bundled fonts, strict CSP, PWA. Chrono then joins Prettier, ESLint and the typecheck.

## 5. Translate Locavern

- [ ] English identifiers are already in place: extract the French interface strings into
      catalogs and add English.
- [ ] Translate the user documentation, English first.

## Known issues inherited from the imported apps

- Locavern's main bundle exceeds Vite's chunk size warning; the notes editor is a candidate
  for a lazy import.
- `apps/locavern/skills/system/run-workflow/` is an agent tooling skill left over from
  Locavern's first commit, unrelated to the app. Remove it during a cleanup.
