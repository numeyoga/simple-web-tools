# Simple Web Tools: agent guide

Public monorepo of small local-first web apps. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[decisions](docs/decisions/) before changing anything structural.

## Commands

- `npm install` at the root: one lockfile for every workspace.
- `npm run verify`: typecheck, lint, format check, unit tests, build. Run it before
  every commit.
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
- Commits: `type(scope): summary`, where the scope is the app or package name.
- `apps/chrono` is legacy (global IIFE scripts, French identifiers, `node:test`) until its
  port. Keep fixes there minimal, and do not add new code in that style.
