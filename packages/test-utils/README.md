# @simple-web-tools/test-utils

Test helpers shared by the apps, extracted from Locavern (the reference app,
[decision 0004](../../docs/decisions/0004-reference-architecture.md)). Private workspace
package: it is not published, and apps depend on it as a `devDependency` only.

Add `"@simple-web-tools/test-utils": "*"` to the `devDependencies` of the workspace, together
with the peer dependencies it uses (`@playwright/test`, `@axe-core/playwright`, `vitest`):
the apps own those versions.

## Fake IndexedDB for Vitest

```js
// vitest.config.js
export default defineConfig({
  test: { setupFiles: ['@simple-web-tools/test-utils/fake-indexeddb'] },
});
```

The setup file installs `indexedDB`, `IDBKeyRange` and the other IndexedDB globals, and gives
every test a fresh, empty factory (`beforeEach`), so tests cannot see each other's databases.
Helpers from `@simple-web-tools/test-utils/indexeddb`:

| Function                      | Does                                                                       |
| ----------------------------- | -------------------------------------------------------------------------- |
| `createIdbFactory()`          | a new, independent `IDBFactory`, to inject into code that takes one        |
| `resetIndexedDb()`            | replaces `globalThis.indexedDB` with a fresh factory (drops all data)      |
| `deleteAllDatabases(factory)` | deletes every database of a factory; rejects if a connection is still open |

## Playwright preset

```js
// playwright.config.js
import { createPlaywrightConfig } from '@simple-web-tools/test-utils/playwright';

export default createPlaywrightConfig({ port: 4173 });
```

Options: `port` (4173), `host` (`127.0.0.1`, a secure context for Service Workers), `baseURL`,
`command` (`npm run preview`), `testDir` (`tests/e2e`), `serverTimeout`. Chromium only,
`fullyParallel`, `list` reporter, `trace: 'on-first-retry'`; on CI (`CI` set): `forbidOnly`,
one retry, one worker, and no reuse of a running server.

## axe preset

```js
import { expectNoA11yViolations } from '@simple-web-tools/test-utils/axe';

await expectNoA11yViolations(page, { exclude: ['#third-party-widget'] });
```

Runs `@axe-core/playwright` with the WCAG tags `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa`
(`WCAG_TAGS`). Options: `include` and `exclude` (CSS selectors), `tags`. A failure lists each
violated rule with its impact and the selectors of the elements. `findA11yViolations` returns
the violations without asserting; `formatViolations` renders them.

## Dependencies

| Dependency                                                   | Why                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fake-indexeddb` (runtime of this package)                   | Pure-JavaScript IndexedDB for Node, so storage adapters are unit-tested without a browser. Apache-2.0 (on the dependency-review allow-list), no dependencies of its own, actively maintained (6.2.x, 2026). It only runs in tests: nothing reaches an app bundle. Install scripts stay disabled. |
| `@playwright/test`, `@axe-core/playwright`, `vitest` (peers) | Versions are owned by the apps, so one app can upgrade Playwright on its own.                                                                                                                                                                                                                    |

## Tests

```bash
npm test -w @simple-web-tools/test-utils
```
