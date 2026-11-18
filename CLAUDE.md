# Simple Web Tools: agent guide

Public monorepo of small local-first web apps. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[decisions](docs/decisions/) before changing anything structural.

## Commands

- `npm install` at the root: one lockfile for every workspace.
- `npm run verify`: typecheck, lint, format check, unit tests, build. Run it before
  every commit.
- `npm run audit`: registry signatures and advisories in shipped dependencies.
- `npm run test:e2e`: Playwright, per app.
- `npm run <script> -w <app>` targets one app; `npm run site` builds the Pages site in `_site/`.

## Rules that are easy to miss

- English for code, comments, commits and docs. UI strings go through the translation
  catalog, never inline (decision 0002). Chrono and Locavern still have French UI text and
  French app docs: translate them as part of their roadmap step, not opportunistically.
- No runtime framework, no CDN, no third-party request. New runtime dependencies need a
  reason in the app README (decision 0003).
- `src/core` stays pure: no DOM, no IndexedDB, no `Date.now()`. Pass time in as an argument
  (decision 0004).
- Every storage name is prefixed with the app name, because all apps share one origin
  (decision 0005).
- Calendar dates: local `YYYY-MM-DD`; never `toISOString()` for a date, never add days as
  `24 * 3600 * 1000`.
- A storage schema change comes with a migration and a test that loads the previous format.
- Install scripts are disabled (`.npmrc`). GitHub Actions are pinned by SHA with a version
  comment; keep it that way when editing workflows (decision 0007).
- Commits: `type(scope): summary`, where the scope is the app or package name.
- `apps/chrono` is legacy (global IIFE scripts, French identifiers, `node:test`) until its
  port. Keep fixes there minimal, and do not add new code in that style.

## Project skills

`.claude/skills/` holds the skills this roadmap needs, so they also work in cloud sessions:

- `covenant-design-system`: read it before any UI work (design tokens, components,
  accessibility). Chrono's interface is the visual reference: when the two apps differ,
  compare before aligning Chrono on Locavern (roadmap step 4).
- `testing`: test strategy; its stack reference for this repository is
  `references/stacks/vanilla-web.md`.

They are copies of the maintainer's personal skills. Keep local improvements small and note
them in the commit, so they can be merged back.
