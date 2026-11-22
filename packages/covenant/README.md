# @simple-web-tools/covenant

The Covenant design system, once for every app: design tokens, component CSS, behaviours,
logos, and the bundled fonts and icons. Private workspace package: it is not published.

It replaces the copy Locavern vendored in `public/vendor/covenant/` and the one Chrono will
drop when it is ported (roadmap step 4). The source of truth is the project skill
`.claude/skills/covenant-design-system/` (its `assets/` folder); this package holds a
verified copy of it, see [Keeping it in sync](#keeping-it-in-sync). Read the skill before any
UI work: it carries the rules, the component pages and the checklists.

## Use it with Vite

Add `"@simple-web-tools/covenant": "*"` to the `dependencies` of the app, run `npm install` at
the root, then import it once, **before the app's own stylesheet** so that the app's CSS can
build on the tokens:

```js
// src/main.js
import '@simple-web-tools/covenant';
import './styles/app.css';
```

Vite bundles everything: the stylesheets become part of the app's CSS, the fonts are copied
to `assets/`, and `Covenant` is available as `window.Covenant` as soon as the module has
run. Nothing is loaded from a CDN (decision 0003), and no inline script or style is added, so
a strict CSP (`script-src 'self'`) keeps working.

Set `<html lang="…" data-theme="light|dark">` in `index.html`. Setting `data-theme` before
the first paint (a small classic script in `<head>`) is the app's job, as Locavern's
`theme-init.js` does.

### Entries

| Import                                    | What it is                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@simple-web-tools/covenant`              | Everything below, in the skill's order: tokens, components, fonts and icons, behaviours             |
| `@simple-web-tools/covenant/tokens.css`   | `covenant-tokens.css`: colours, type, spacing, radii, motion, light and dark                        |
| `@simple-web-tools/covenant/covenant.css` | `covenant.css`: the `cv-*` components. Needs the tokens                                             |
| `@simple-web-tools/covenant/fonts`        | IBM Plex Sans 400, 500, 600, IBM Plex Mono 400, 500, 600, Phosphor regular and bold (see below)     |
| `@simple-web-tools/covenant/covenant.js`  | The behaviours (`window.Covenant`), as a side-effect import. It initialises itself, as in the skill |
| `@simple-web-tools/covenant/logos/*`      | `covenant-logo.svg`, `covenant-logo-dark.svg`, `covenant-mark.svg`, for `<img src>` or `?url`       |

The individual entries are for an app that needs another order or leaves a part out. The
behaviours script is the skill's IIFE, unchanged: it sets `window.Covenant`
(`init`, `toast`, `setTextSize`, `getTextSize`, `openDialog`, `closeDialog`, `categoryColors`,
`setCategory`, `setTooltip`, `hideTooltips`, `placeTooltip`) and calls `init(document)` when the page is ready. Call
`window.Covenant.init(root)` after inserting markup.

### Fonts and icons: why they are dependencies of this package

The skill ships `assets/fonts/` and `assets/phosphor/` as a reference copy for projects that
have no package manager. Here they would be about 3 MB of binaries duplicated in the
repository, so the package depends on the npm packages they come from instead:
`@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (the files the skill's own
`fonts/covenant-fonts.css` documents come from these) and `@phosphor-icons/web` (2.1.2, the
version the skill pins). They moved from Locavern's `package.json` to this one because the
design system, not an app, decides which weights and which icon set it needs: an app now
upgrades or pins them in one place, and Chrono gets the same fonts without repeating the
list. Apps keep using the icons through the skill's `<i class="ph ph-sun"></i>` markup.

## Keeping it in sync

`src/covenant-tokens.css`, `src/covenant.css`, `src/covenant.js` and `src/logos/` are copies
of the skill's assets. **Never edit them here.** Change the skill (and merge the change back to
the maintainer's skill), then:

```bash
npm run sync -w @simple-web-tools/covenant
```

The script `scripts/sync.mjs` copies the files from
`.claude/skills/covenant-design-system/assets/` (`--check` only compares). A Vitest test
(`tests/sync.test.js`, part of `npm test`, so of `npm run verify`) fails when a file of the
package differs from the skill's, is missing or is extra, except for the documented
differences below. The skill and the package cannot drift without a red build.

## Differences from the skill

None. The skill's CSS has no `@import` and no `url()`, and its JavaScript is a self-contained
IIFE, so the files bundle as they are and are byte-for-byte copies. The skill's `fonts/` and
`phosphor/` folders and `tokens.json` are not copied (fonts and icons come from the npm
packages above; `tokens.json` is documentation).

If a difference ever becomes necessary, add the transformation to `TRANSFORMS` in
`scripts/sync.mjs` (the sync and the test both apply it) and describe it in this section,
with the file path: the test checks that the README mentions every transformed file.

## Rules for the apps

- Semantic tokens only (`--cv-fg`, `--cv-surface-*`, `--cv-border-*`, `--cv-*-fill`,
  `--cv-brand-*`), never a primitive scale token such as `--cv-accent-500` or
  `--cv-neutral-900` (the skill's firm rules).
- Never add an inline script or style to load Covenant: the production CSP forbids the
  former and the app does not need the latter.
- A component that Covenant lacks is a gap to report in the skill, not a primitive to borrow.
