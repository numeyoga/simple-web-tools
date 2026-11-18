# Stack: vanilla web apps (this repository)

Browser apps in plain JavaScript (ES modules), built with Vite, data in IndexedDB. Read this
before the first test. It replaces the Elixir tooling named in the other references: the
`scripts/` and `templates/` they mention are `mix`-based and are **not** shipped in this
repository; use the commands below instead.

## Levels and where they live

| Level | Tool | Location | Covers |
| --- | --- | --- | --- |
| Unit | Vitest (`environment: 'node'`) | `apps/<app>/tests/unit/*.test.js` | `src/core` (reducer, commands, effects), pure helpers, dates, file formats |
| Storage | Vitest + a fake IndexedDB | next to the unit tests | adapters: migrations, export/import, single-writer lock. `fake-indexeddb` is not a dependency yet: propose it (tooling.md) when the first storage test needs it, ideally in `packages/test-utils` |
| End-to-end | Playwright (Chromium) | `apps/<app>/tests/e2e/*.spec.js` | user journeys against `vite preview`, multi-tab behavior, offline |
| Accessibility | `@axe-core/playwright` | inside the e2e specs | WCAG 2.2 AA on every screen, light and dark themes |
| Legacy | `node:test` + `node:vm` harness | `apps/chrono/tests/` | Chrono until its port; migrate those tests to Vitest, do not add new ones |

`src/core` is pure by rule (decision 0004): test it without DOM and without storage. Pass the
clock in; never read `Date.now()` inside core code, so no fake timers are needed there.

## Commands (quiet by default)

```bash
npm test -w <app> -- --reporter=dot --silent=passed-only   # unit, output only for failures
npx vitest run tests/unit/dates.test.js -t "DST"          # one file, one test (from apps/<app>)
npx vitest run --changed                                  # tests touched by uncommitted changes
npm run test:e2e -w <app> -- --reporter=line              # e2e
npx playwright test --last-failed                         # rerun only the failures
npm run verify                                            # end-of-work chain, from the root
```

## Equivalents of the Elixir helpers

| Need (see tooling.md) | Here |
| --- | --- |
| Flaky sample | `npx playwright test <spec> --repeat-each=20 --retries=0 --reporter=line`; for Vitest: `for i in $(seq 20); do npx vitest run <file> -t "<name>" --reporter=dot >/dev/null 2>&1 && echo pass \|\| echo fail; done \| sort \| uniq -c` |
| One hand-picked mutation | edit the source line, run the one test, confirm it fails, `git checkout -- <file>` |
| Mutation testing of a module | StrykerJS with its Vitest runner. Not a dependency: propose it for high-criticality modules (storage migrations, import) |
| One test's logs | Vitest prints the console of failing tests only with `--silent=passed-only`; Playwright keeps a trace on retry (`trace: 'on-first-retry'`) |

## Pitfalls specific to these apps

- **Time zones.** Date logic must pass in several zones. Run the date tests with
  `TZ=UTC`, `TZ=Europe/Paris`, `TZ=America/New_York` and `TZ=Pacific/Auckland`, and include a
  daylight-saving transition day. Calendar dates are local `YYYY-MM-DD`, never `toISOString()`.
- **Multi-tab.** Open two pages in the same browser context to test the single-writer lock;
  separate contexts do not share storage.
- **Storage names.** All apps share one origin: assert that every database, key, lock and
  channel name starts with the app name.
- **Migrations.** A schema change gets a test that loads data written in the previous format.
- **Service Worker.** It needs a secure context: test it against `vite preview` on
  `127.0.0.1`, not through another hostname over plain HTTP.
