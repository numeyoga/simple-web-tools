# Changelog

## 2026-11-22 — a reset in `@layer cv-reset`, and `.cv-prose`

Requested by the three applications, which each reset the browser's margins on their own (`html, body { margin: 0 }`, a `margin: 0` per heading or paragraph) and sometimes forgot to. Nothing was renamed or removed. No colour, token or component markup changed.

### Added: `@layer cv-reset`
- **CSS** in `covenant.css` Base, right after the `box-sizing` rule: `body` margin 0; margin 0 on `h1`–`h6`, `p`, `ul`, `ol`, `figure`, `blockquote`, `dl`, `dd`; `img, picture, video, canvas` as `display: block; max-width: 100%`; `overflow-wrap: break-word` on `p` and headings; `text-wrap: balance` on headings.
- **Left alone on purpose:** inline `svg` (icons and logos are sized by their own rules), `list-style` (user content needs its bullets and numbers), and the `margin: 0` of existing components (harmless, they stay).
- **Why a layer:** a layered rule beats the browser's styles but loses to every unlayered rule, so no component or application rule changes with it.
- **Visible effects, all intended:** the browser's margins on headings, paragraphs and lists in application markup are gone (an application that relied on them states its own spacing); headings wrap balanced, so a two-line heading breaks in the middle instead of leaving a short last line.

### Added: `.cv-prose`
- The vertical rhythm of user content, which the reset takes away: `1em` around `p`, `ul`, `ol`, `blockquote`, `pre`, `figure`, `dl`; nested lists with no margin; list indent `--cv-space-9`; headings with the browser's steps above and `--cv-space-2` below; `--cv-space-3` between siblings. All the selectors are in `:where()` (zero specificity). It reproduces the rhythm of the rich-text editor of the applications as it was before the reset, pixel for pixel. Documented in `references/foundations.md` ("Reset and prose") and in the firm rules of `SKILL.md`.

### Corrected
- **EmptyState**: `.cv-empty > p { margin-block: 1em }`. The sentences of an empty state got their space from the browser's paragraph margin, on top of the flex gap; the reset would have closed it, so the component now states it and does not move.

## 2026-11-19 (3) — category colours, muted text on the inverse surface, corrections

Requested by two applications being converted to Covenant. Nothing was renamed or removed; everything below is an addition, except the two corrections.

### Added: category colours (a deliberate extension)
- **Tokens**, in `tokens.json` and `covenant-tokens.css`, light and dark, each with a usage note: `--cv-cat-1` … `--cv-cat-16` (marker, light and dark values), `--cv-cat-1-fill` … `--cv-cat-16-fill` (same in both themes), `--cv-fg-on-cat` (white).
- **CSS** in `covenant.css`, semantic tokens only: `data-cat="1".."16"` (and `"custom"`) sets the local `--cv-cat` and `--cv-cat-fill`; recipes `cv-cat-stripe`, `cv-cat-dot`, `cv-cat-name`, `cv-cat-block`, `cv-cat-segment`, `cv-cat-legend`, `cv-cat-timeline`, `cv-cat-chart` (+ `__rows`, `__row`, `__bar`).
- **JavaScript**: `Covenant.categoryColors(hex)` and `Covenant.setCategory(element, n | hex)`.
- **Component page** `CategoryColor` (anatomy, classes, accessibility, usage, checklist) with a project card and table, a day timeline, a stacked bar chart with its legend and the full palette, in both themes side by side. Foundations and checklist updated.
- **Values**: the suggested values were verified with the WCAG formula and all passed, but neighbours were too close: violet and purple were ΔE2000 3.6 apart (0.4 for protanopia), amber and yellow 1.3 for deuteranopia, blue and indigo 1.3 in dark for deuteranopia. **Adjusted**: hue and saturation kept, lightness set in two tiers that alternate around the wheel. Bright tier (odd numbers): markers at 3.20–3.24:1, fills at 4.60–4.64:1. Deep tier (even numbers): light markers at 4.60–4.64:1, dark markers at 5.21–5.25:1, fills at 6.51–6.57:1. Worst neighbour pair (markers and fills, both themes, wheel neighbours including rose–orange): ΔE2000 9.8 for normal vision (violet–purple, was 3.4) and 4.0 under simulated protanopia, deuteranopia or tritanopia (rose–orange, tritanopia; was 0.4 for violet–purple, protanopia). Simulation: Machado 2009, severity 1.
- **Status look-alikes: kept.** Green, yellow, amber and rose stay in the palette because the name is always shown and a category never replaces a status badge; they are assigned last by default, with orange (the accent look-alike).
- **Distinguishability: reordered and limited.** Default assignment order 9, 4, 14, 10, 7, 6, 16, 13, 8, 11, 12, 5, 3, 2, 15, 1. The first six stay apart for everyone, the first eight for most; beyond eight in one view, group the rest as "Other" in charts or rely on direct labels.
- **Custom colours**: restrict users to the palette (recommended). Fallback: `Covenant.setCategory(element, "#rrggbb")` keeps hue and saturation and picks the lightest light marker and the darkest dark marker at 3:1 on every ground, and the lightest fill at 4.5:1 under white; the grounds are read from the tokens.
- **Assignment**: store the number, not a hex value; after 16 projects the order starts again.

### Added: nested theme scopes
- `:where([data-theme])` re-applies `--cv-fg` and `--cv-bg` on any element that carries `data-theme`, so a dark panel inside a light page (or the reverse) gets the right text and ground. Zero specificity: any component rule still wins. Found while testing the side-by-side gallery, where text in the nested dark section inherited the light page colour.

### Added: `--cv-fg-inverse-muted`
- Captions on `--cv-surface-inverse` (running-timer card): `--cv-neutral-400` `#a1a1aa` in light (6.91:1), `#626877` in dark (5.16:1); `--cv-fg-inverse` is 17.72 / 18.20, so it stays visibly quieter. Documented in foundations, `tokens.json` and the checklist.

### Corrected
- `--cv-fg-subtle` on `--cv-surface-3` in dark is **4.03:1**, not 4.10 (CHANGELOG and the `tokens.json` usage note).
- The first entry of 2026-11-19 is annotated: danger hover is `--cv-danger-800` (9.57) and pressed `--cv-danger-900` (12.16) since the second entry.
- `--cv-radius-full` usage note now lists every pill (status badges, tab counters, avatars, switches, category dots), as the foundations already did.

## 2026-11-19 (2) — primary and danger told apart

In light, the primary button (`#c2410c`) and the danger button (`#be123c`) had almost the same lightness (luminance ratio 1.21), the same white text and neighbouring hues: they were hard to tell apart.

### Changed
- `--cv-accent-fill`: new primitive `--cv-accent-550` (`#cb4a00`), the most vivid orange that keeps white text at AA (4.65:1), in **both** themes. Hover `--cv-accent-fill-hover` → `--cv-accent-600` (5.18:1), pressed `--cv-accent-fill-pressed` → `--cv-accent-700` (7.31:1), both themes.
- `--cv-fg-on-accent` is white in both themes (was near-black in dark). Rule: text on a coloured fill is always white.
- `--cv-danger-fill` → `--cv-danger-700` (`#9f1239`, 8.02:1), hover → `--cv-danger-800` (9.57:1), pressed → new primitive `--cv-danger-900` (`#6b0f2a`, 12.16:1), both themes.
- Result: primary and danger now differ in lightness (ratio 1.72, was 1.21) and in hue (22° against 343°).
- Checked checkboxes, radios and switches and the current page use the same fill: 4.65 / 3.51 against `cv-surface`, 4.23 / 3.09 against `cv-surface-2` (3:1 needed).

No token, class, data attribute or JavaScript API was renamed or removed.

## 2026-11-19 — theme hygiene, WCAG fixes, self-hosting

An external audit (WCAG 2.2 AA, axe-core in light and dark at 1440 px and 320 px, contrast computed from `covenant-tokens.css`) found the defects below. Every item is fixed. Nothing was renamed or removed: every class, token, data attribute, `Covenant.*` function and event name of the previous version still works. Contrast figures are light / dark.

### Added
- Semantic tokens that follow the theme: `--cv-surface-inverse`, `--cv-border-danger`, `--cv-border-selected`, `--cv-danger-fill-pressed`, `--cv-brand-accent`, `--cv-brand-tint`, `--cv-brand-deep`; primitive `--cv-danger-800`. In `tokens.json` and `covenant-tokens.css`, light and dark.
- `cv-logo` (with `cv-logo__light` and `cv-logo__dark`): shows the lockup that matches the theme.
- `fonts/covenant-fonts.css`, seven IBM Plex `.woff2` files and `OFL.txt`.
- Rule: components use semantic tokens only; primitive scale tokens never appear in component CSS or markup. Checked by a search in the checklist (step 3).

### 1. WCAG 2.2 AA failures
- **1.1 Invalid input border (1.4.11): fixed.** `.cv-input[aria-invalid="true"]` uses `--cv-border-danger` (an alias of `--cv-fg-danger`) instead of the primitive `--cv-danger-600`. On `cv-surface`: 8.02 / 6.46 (was 6.29 / 2.59). On `cv-surface-2`: 7.29 / 5.69 (was 5.72 / 2.29).
- **1.2 Focus ring on the selected segment (2.4.7, 1.4.11): fixed.** Keyboard focus always lands on the checked segment. Its ring is now drawn in `--cv-fg-inverse` on `--cv-surface-inverse`: 17.72 / 18.20 (was 3.42 / 2.09). Unselected segments keep `--cv-border-focus` on `cv-surface`: 5.18 / 7.20. The ring offset of every component is documented under **Hover, press, focus** in the README.
- **1.3 Toast timer never resumed (2.2.1): fixed.** `covenant.js` tracks the time left, pauses on `mouseenter` and `focusin`, resumes on `mouseleave` and on `focusout` when focus leaves the toast, and `remove()` clears the timer. Errors and warnings still stay until dismissed.

### 2. Primitive tokens that ignored the theme: fixed
- **Tooltip**: `--cv-surface-inverse` + `--cv-fg-inverse` (was `--cv-neutral-900` + `--cv-neutral-0`). Text 17.72 / 18.20. In dark, the bubble is now light, so it stands out from the page (16.58 against `cv-bg`, was 1.01).
- **Avatar**: `--cv-surface-3` + `--cv-fg` (was `--cv-neutral-200` + `--cv-neutral-900`). 13.96 / 11.03.
- **Badge dots**: `currentColor`, the badge's `--cv-fg-<status>` (was the `-500` primitives). On their tint: success 6.81 / 8.58, warning 8.38 / 9.64, danger 7.34 / 6.89, info 13.35 / 7.88, accent 4.88 / 6.33 (were as low as 1.85 for warning in light and 2.13 for info in dark).
- **Tab underline**: `--cv-border-selected` (was `--cv-accent-500`). On `cv-bg`: 4.96 / 7.92 (was 3.41 / 5.04). On `cv-surface`: 5.18 / 7.20.
- **Selected segment fill**: `--cv-surface-inverse` (was `--cv-fg` used as a fill).
- **Logo point** (sidebar mark) and **cover artwork**: `--cv-brand-accent`, `--cv-brand-tint`, `--cv-brand-deep`, `--cv-fg-subtle`; identical in light, adapted in dark.
- **Near-miss `--cv-fg-subtle` on `--cv-surface-2` in dark: fixed.** Dark value `#8a90a0` → `#9096a6`: 4.86 (was 4.5009). Light unchanged (5.02).
- **`--cv-fg-subtle` on `--cv-surface-3` (4.35 / 4.03): kept, and ruled out.** No component puts it there; the README and the checklist now say that only `--cv-fg` (13.96 / 11.03) and `--cv-fg-muted` (6.09 / 7.03) go on `--cv-surface-3`.

### 3. Rules contradicted by the CSS or the docs
- **Menu and listbox motion: fixed in the CSS.** `.cv-menu` (on `:popover-open`) and `.cv-listbox` fade in over 120 ms with `--cv-duration-fast` and `--cv-ease-emphasize`, which are now used. `prefers-reduced-motion` sets every duration token to `--cv-duration-instant`, which is now used too. No token removed.
- **Radius full on `.cv-tab__count`: fixed in the doc.** The rule now reads "status badges, tab counters, avatars and switches".
- **Danger pressed: fixed.** `--cv-danger-fill-pressed` (`--cv-danger-800`, `#881337`; white text 9.57) added to `tokens.json` and the CSS; hover keeps `--cv-danger-fill-hover` (8.02). *Superseded by the next entry of the same day: the danger fill moved one step darker, so hover is now `--cv-danger-800` (9.57) and pressed `--cv-danger-900` (12.16).*
- **Every size in rem: fixed.** Command list `max-height: 320px` → `20rem`. `code, kbd, samp, pre` use `max(0.95em, var(--cv-text-xs))`: 12 px in a 12 px context (was 11.4 px). The `html` font-size rule now says that `covenant.css` sets it and that applications never do.
- **Top bar: fixed in the CSS.** `.cv-topbar` is `position: sticky; top: 0`, so `scroll-padding-top` now does its job (2.4.11). The TopBar page writes the size in rem.
- **Drawer at 320 px: fixed in the CSS.** `max-width: 100vw` overrides the user-agent dialog limit: full width (320 px, was 288 px).
- **Alert roles: fixed in the anatomy.** Success and warning appear after an action: `role="status"`. The error appears after an action: `role="alert"`. The info alert is in the page on load: no live role. The text explains both cases.

### 4. Self-hosting: fixed
- `covenant.css` no longer starts with a Google Fonts `@import` and makes no network request.
- IBM Plex is self-hosted in `fonts/` (from `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.3.0, OFL 1.1); installing those npm packages is documented as the alternative.
- Phosphor is self-hosted from the `@phosphor-icons/web` npm package, any 2.1.x patch version (2.1.2 is current). The exported skill ships `src/regular` and `src/bold` of 2.1.2 (MIT). The design system's own preview pages still load Phosphor 2.1.2 from unpkg, which the gallery requires to pin exactly.
