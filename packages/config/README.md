# @simple-web-tools/config

Shared ESLint, Prettier and `jsconfig` bases, extracted from Locavern (the reference app,
[decision 0004](../../docs/decisions/0004-reference-architecture.md)). Private workspace
package: it is not published.

## Usage

Add `"@simple-web-tools/config": "*"` to the `devDependencies` of the workspace, then:

**Prettier**, in `package.json` (Prettier resolves it from every folder below the root):

```json
{ "prettier": "@simple-web-tools/config/prettier" }
```

**TypeScript**, in `jsconfig.json` (keep only `include` and `exclude` locally):

```json
{ "extends": "@simple-web-tools/config/jsconfig.base.json", "include": ["src/**/*.js"] }
```

**ESLint**, in `eslint.config.js`. The helpers each return one flat-config object; later
entries override earlier ones, so order matters.

```js
import { base, browserModule, serviceWorker } from '@simple-web-tools/config/eslint';

export default [
  ...base(['dist/**']),
  browserModule(['src/**/*.js']),
  serviceWorker(['public/sw.js']),
];
```

| Helper                 | Applies to                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| `base(ignores)`        | ignores + `@eslint/js` recommended (spread it first)                   |
| `browserModule(files)` | ES modules for the browser, with the project rules                     |
| `node(files)`          | ES modules for Node.js (scripts, config files), with the project rules |
| `nodeGlobals(files)`   | adds Node.js globals to files another preset already covers            |
| `serviceWorker(files)` | classic script in a service worker                                     |
| `classicScript(files)` | classic script loaded by a page                                        |
| `tests(files)`         | test files (Node.js and browser globals)                               |
| `rules`                | the project rules object, if you need to compose your own              |

## Dependencies

- `@eslint/js` and `globals` are regular dependencies: only this package imports them, so
  apps do not repeat them in their own `devDependencies`.
- `eslint` and `prettier` are peer dependencies: the app owns the tool version and the
  binary it runs, this package only supplies configuration.
- `typescript` is a dev dependency, to typecheck this package's own JSDoc
  (`npm run typecheck -w @simple-web-tools/config`).

No new third-party package: all of them were already used by Locavern or the root.

## Scope

The root `eslint.config.js` lints `scripts/` and the root config files; apps and packages
lint themselves. `apps/chrono` is legacy and is not linted until its port.
