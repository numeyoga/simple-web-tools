# @simple-web-tools/suite

What ties the apps together: the registry of the apps, the brand (logo and name) at the top of
every sidebar, and the group of links to the sibling apps pinned at the bottom of it. Shared so
that the brand has the same size and position in every app and the links never drift apart.
Private workspace package: it is not published. No runtime dependency.

## Entry points

| Import                              | Contents                               | DOM |
| ----------------------------------- | -------------------------------------- | --- |
| `@simple-web-tools/suite`           | `APPS`, `appHref`, `findApp`           | no  |
| `@simple-web-tools/suite/dom`       | `createAppBrand`, `createAppSwitcher`  | yes |
| `@simple-web-tools/suite/suite.css` | Styles of the brand icon and the group | -   |

The root entry is pure (no DOM, no clock) and safe in an app's `src/core`. `/dom` belongs in
`src/adapters` ([decision 0004](../../docs/decisions/0004-reference-architecture.md)).

### Registry

- `APPS`: the frozen, ordered list of `{ id, name, icon }`. `id` is the folder under `apps/`
  and the path segment on the assembled site, `icon` is a
  [Phosphor](https://phosphoricons.com) name without the `ph-` prefix (Covenant loads the
  regular and bold weights). App names are proper nouns, the same in every language, so they
  live here and not in a catalog ([decision 0002](../../docs/decisions/0002-english-code-translated-ui.md)).
- `appHref(id)`: `../<id>/`, relative to the root of the current app.
- `findApp(id)`: the entry of an id. Both functions throw on an unknown id.

### Sidebar

```js
import '@simple-web-tools/suite/suite.css'; // after Covenant
import { createAppBrand, createAppSwitcher } from '@simple-web-tools/suite/dom';

const nav = document.querySelector('nav.cv-sidebar');
nav.prepend(createAppBrand('chrono')); // first child
nav.append(createAppSwitcher('chrono', { label: t('suite.apps') })); // last child
```

- `createAppBrand(currentId, { doc })`: `<div class="cv-sidebar__brand">` with the app's icon
  (1.5rem, in `--cv-brand-accent`) and its name.
- `createAppSwitcher(currentId, { label, doc })`: a `<div class="swt-switcher">` with an
  overline heading and a list of links, one per app. The current app links to `./` and has
  `aria-current="page"`. `label` is required: it is the only text the package does not own, so
  the app passes it translated ("Apps", "Applications"). The block is not a `<nav>`, because
  the Covenant sidebar already is one. `margin-top: auto` pins it to the bottom of the
  sidebar, which is a flex column.

Both build elements with `createElement` and `textContent` only, never `innerHTML`. `doc`
defaults to `document`; pass another `Document` to build elsewhere (or in a test).

## Rules

- **A new app is added to the registry.** Add it to `APPS` in `src/apps.js` (in the order of
  the switcher). A test compares the registry with the folders of `apps/` and fails when they
  differ.
- **Sibling links only resolve on the assembled site.** The apps live side by side under one
  origin (`<site>/chrono/`, `<site>/locavern/`, ...; see `scripts/assemble-site.mjs`). On a
  single app's Vite dev server or preview, `../<id>/` leads nowhere: run `npm run site` to try
  the links.
- **No app import, no storage, no clock, no network.**

## Tests

`npm test -w @simple-web-tools/suite` runs the registry, the DOM builders and the stylesheet
checks. The repository has no DOM library, so the builders are tested against a minimal fake
`Document` (`tests/support/fake-dom.js`); the Playwright specs of the apps cover the real
rendering.
