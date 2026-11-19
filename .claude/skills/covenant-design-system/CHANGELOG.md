# Changelog

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
- **`--cv-fg-subtle` on `--cv-surface-3` (4.35 / 4.10): kept, and ruled out.** No component puts it there; the README and the checklist now say that only `--cv-fg` (13.96 / 11.03) and `--cv-fg-muted` (6.09 / 7.03) go on `--cv-surface-3`.

### 3. Rules contradicted by the CSS or the docs
- **Menu and listbox motion: fixed in the CSS.** `.cv-menu` (on `:popover-open`) and `.cv-listbox` fade in over 120 ms with `--cv-duration-fast` and `--cv-ease-emphasize`, which are now used. `prefers-reduced-motion` sets every duration token to `--cv-duration-instant`, which is now used too. No token removed.
- **Radius full on `.cv-tab__count`: fixed in the doc.** The rule now reads "status badges, tab counters, avatars and switches".
- **Danger pressed: fixed.** `--cv-danger-fill-pressed` (`--cv-danger-800`, `#881337`; white text 9.57) added to `tokens.json` and the CSS; hover keeps `--cv-danger-fill-hover` (8.02).
- **Every size in rem: fixed.** Command list `max-height: 320px` → `20rem`. `code, kbd, samp, pre` use `max(0.95em, var(--cv-text-xs))`: 12 px in a 12 px context (was 11.4 px). The `html` font-size rule now says that `covenant.css` sets it and that applications never do.
- **Top bar: fixed in the CSS.** `.cv-topbar` is `position: sticky; top: 0`, so `scroll-padding-top` now does its job (2.4.11). The TopBar page writes the size in rem.
- **Drawer at 320 px: fixed in the CSS.** `max-width: 100vw` overrides the user-agent dialog limit: full width (320 px, was 288 px).
- **Alert roles: fixed in the anatomy.** Success and warning appear after an action: `role="status"`. The error appears after an action: `role="alert"`. The info alert is in the page on load: no live role. The text explains both cases.

### 4. Self-hosting: fixed
- `covenant.css` no longer starts with a Google Fonts `@import` and makes no network request.
- IBM Plex is self-hosted in `fonts/` (from `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.3.0, OFL 1.1); installing those npm packages is documented as the alternative.
- Phosphor is self-hosted from the `@phosphor-icons/web` npm package, any 2.1.x patch version (2.1.2 is current). The exported skill ships `src/regular` and `src/bold` of 2.1.2 (MIT). The design system's own preview pages still load Phosphor 2.1.2 from unpkg, which the gallery requires to pin exactly.
