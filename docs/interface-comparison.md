# Interface comparison: the Covenant skill, Chrono and Locavern

> **Proposal — awaiting the maintainer's decision.**
> Roadmap step 4, first item, redone against the updated `covenant-design-system` skill.
> Nothing here is applied: no app code, CSS, package or skill was changed, and the roadmap item
> is not ticked. Every recommendation is for the maintainer to accept, change or reject.
> This replaces the comparison of 2026-11-18, which was written against the old French skill.

Date: 2026-11-19. The skill (`.claude/skills/covenant-design-system/`) is the normative target for
`packages/covenant`. Chrono's interface stays the visual reference.

**Skill version checked: commit `185c9b1`** (`CHANGELOG.md`, entries "2026-11-19" and "2026-11-19 (2)").
This is the second pass: commit `3f27774` audited the previous version, the maintainer sent that audit
to Claude Design, and `185c9b1` is the answer. Every claim of the new `CHANGELOG.md` was rechecked, not
trusted.

## Summary

1. **The skill update does what it says, with one wrong figure and no new failure.** axe-core (wcag2a,
   wcag2aa, wcag21aa, wcag22aa) reported **0 violations in 28 runs** (page template and a gallery of 34
   Anatomy blocks, light and dark, 1440 and 320 px, plus every overlay open). The three audited WCAG
   failures (invalid border, focus ring on the checked segment, toast timer) are fixed and measured.
   The other audited items are fixed too (table in [Item by item](#item-by-item-verdict)).
2. **The page makes zero external requests.** 28 runs recorded, every non-local request blocked and
   counted: 0. IBM Plex and Phosphor load from the skill's own files, no fallback font is rendered, icons are
   visible.
3. **Defects found in the update itself, all small:** `fg-subtle` on `surface-3` in dark is
   **4.03:1, not the 4.10 stated** (`CHANGELOG.md` and `tokens.json:394`); the first CHANGELOG entry is
   stale on danger hover and pressed (the second entry and the CSS agree with each other);
   in dark, primary against danger is now 1.72:1 in lightness (it was 2.78:1); the primary hover step is
   1.11:1. None fails a criterion. No primitive scale token remains in component CSS or markup.
4. **Locavern's vendored files were identical to the previous skill, so it is now behind by 41 + 50 + 39
   lines** (tokens, CSS, JS). Its own toast fix is replaced by the skill's equivalent. Its app CSS still
   has 28 primitive references plus one in `index.html`, of which the tooltip is a real dark-mode defect.
   See [What Locavern must take](#what-locavern-must-take-from-the-new-skill).
5. **The update settles two of the old questions and narrows a third.** Accent fill (A) is decided by the
   skill: `#cb4a00`, 4.65:1, close to Chrono's `#ea580c`. The skill defects (E) are fixed. The ink card
   (D) now has `--cv-surface-inverse`; only a muted caption role is still missing. Six questions stay open
   (B, C, D, F, G, H); the one that changes how the apps look is still **project colour** (C).
6. **Chrono is still far from the skill, and the distance is where its charm comes from.** Thirteen
   Chrono traits conflict; the accent fill is now the smallest of them. I recommend following the skill
   for eleven, extending it for one (project colour) and leaving shortcuts to question H.

## How this was done

- Read: `CLAUDE.md`, the previous comparison, the new `CHANGELOG.md`, the diff of the skill between
  `3f27774` and `185c9b1` (tokens, CSS, JS, template, every changed reference page), `tokens.json`,
  Locavern's vendored files and app CSS. The earlier Chrono and Locavern reading (`public/assets/*.css`,
  `js/*.js`, `src/styles/app.css`) was reused, with every skill line number remapped to the new files.
- Contrast: a Node script resolves the `var()` chains of `covenant-tokens.css` and applies the WCAG
  relative-luminance formula, compositing translucent colours over the real surface (230 pairs, both
  themes, plus a script that recomputes every number stated in the CHANGELOG). Scripts and results stay in
  the session scratchpad, not in the repository.
- Browser: Chromium through Playwright. The skill's `assets/` and `templates/` were served as one flat
  folder (the layout the skill's workflow asks for: assets next to the page). The page template and a
  gallery rebuilt from the Anatomy markup of every component page (34 blocks) were tested with axe,
  keyboard tabbing, 320 px reflow, `data-text-size`, every dialog, the menu, the combobox, toasts and
  tooltips. All network requests were recorded and non-local ones aborted.
- Screenshots in the scratchpad, none committed: `skill-v2-*` (see [Three-way comparison](#three-way-comparison)).
- Abbreviations. Skill: **S** `SKILL.md`, **F** `references/foundations.md`, **K**
  `assets/covenant.css`, **T** `assets/covenant-tokens.css`, **J** `assets/covenant.js`, all as of
  `185c9b1`. Chrono: **CC** `apps/chrono/public/assets/covenant.css`, **CA** `…/app.css`, **UI**
  `…/js/ui.js`, other `js/*.js` by name. Locavern: **LT** and **LC**
  `apps/locavern/public/vendor/covenant/covenant-tokens.css` and `covenant.css`, **LA**
  `apps/locavern/src/styles/app.css`.

## Verification of the updated skill (commit 185c9b1)

### Verdict

The claim holds. Every audited item is fixed in the CSS, the JS or the docs, and each fix was measured in
the browser. One figure in the CHANGELOG is wrong, one entry is stale, and a few thin margins or trade-offs
come from the second change (orange fill and darker danger). There is no regression of a WCAG criterion.

### Network, fonts, icons

| Check                                                                                            | Result                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-local requests (Playwright `route`, page and gallery, 4 combinations, plus all overlay runs) | **0**. No `@import` in K (header comment only), no `<script src>` in the template, no 4xx                                                                                                                                                                                 |
| Fonts                                                                                            | `fonts/covenant-fonts.css` resolves; loaded: IBM Plex Sans 400, 500, 600, Mono 400, 500, Phosphor (Bold on use). `Plex` text measures 361 px against 351 px for the fallback at 40 px: Plex is rendered. Sans 700 and Mono 600 files exist and are not needed by the page |
| Icons                                                                                            | 31 visible `.ph` elements in the gallery, none zero-width; 9 more sit in closed dialogs. Logo: the light lockup shows in light, the dark lockup in dark (`cv-logo`)                                                                                                       |
| Paths                                                                                            | `phosphor/*/style.css` and `fonts/*.woff2` resolve. `phosphor/*/style.css` also lists `.woff`, `.ttf` and `.svg` fallbacks that are not shipped; Chromium never asks for them (woff2 is first), only very old browsers would get a 404                                    |
| The skill folder as shipped                                                                      | `templates/page.html` does not open correctly in place (`fonts/`, `covenant.css` live in `../assets/`); this is as documented (workflow step 2: copy `assets/` next to the page) and was the same before                                                                  |

### axe-core

| Scope                                                                                      | Runs | Violations |
| ------------------------------------------------------------------------------------------ | ---- | ---------- |
| `templates/page.html`: light and dark, 1440x900 and 320x800                                | 4    | 0          |
| Gallery (34 Anatomy blocks): same four combinations                                        | 4    | 0          |
| Gallery with Modal, Drawer, CommandMenu, Menu open, then four toasts plus tooltips visible | 20   | 0          |

axe "incomplete": only the `⌘` keycap (non-BMP glyph, axe cannot read it; `fg-muted` on `surface` is
7.73:1), as before. The four "overlapped" elements of the narrow modal reported last time no longer appear.
No horizontal scroll at 320 px (`scrollWidth` 320 in both themes, page and gallery; also with
`data-text-size="large"` at 320 and 1280 px; 2560 px: body 16.25 px, rows 40 px, sidebar 290 px). Smallest
computed text: 12 px. Smallest targets: 28 px controls; inline links 17 to 20 px (exempt, inline in a
sentence).

### Behaviour

| Check                                                                  | Result                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toast pause and resume (J:211-240)                                     | A 2 s toast hovered at 0.5 s, held 3 s (past its timeout): still there, removed **1460 ms** after the pointer left (expected 1500). Hovered at 1.2 s: **807 ms** (800). Enter, leave, enter: **1304 ms** (1300). Focus on the dismiss button: stays, removed **1519 ms** after blur. Hover plus focus: stays until both end. Warning and danger stay 7 s+; default success leaves at 6 s; dismiss works |
| Segmented control, keyboard focus, dark                                | Ring `#0a0b0e` on `#f5f6f8` (K:320), 18.20:1; light `#ffffff` on `#18181b`, 17.72:1 (`skill-v2-focus-segmented-dark.png`, `-light.png`)                                                                                                                                                                                                                                                                 |
| Menu (K:532) and listbox (K:327)                                       | Both run `cv-pop-in`, 120 ms (opacity 0.15 at 30 ms, 1 after 300 ms). Closing is instant (the doc says "fade in"). Escape and outside click close the menu and return focus to its button; Escape closes the combobox list. With `prefers-reduced-motion: reduce`: duration tokens compute to 0 ms, no animation is created, opacity 1; toast animation is 0.01 ms                                      |
| Top bar (K:590)                                                        | `position: sticky; top: 0; z-index: 100`, 48 px; still at `top: 0` after scrolling 1500 px. With 45 extra rows and 70 Tab and Shift+Tab stops, the focused element never came closer than **7.4 px** below the bar at 1440 px and **7.3 px** at 320 px (the ring needs 4 px). Anchor jump lands flush under the bar (2.4.11)                                                                            |
| Drawer at 320 px (K:514)                                               | Width 320 (was 288), left 0, `scrollWidth` 320. 420 px at 420 and at 1440 px                                                                                                                                                                                                                                                                                                                            |
| Alert anatomy (`Alert.md`)                                             | success `role="status"`, warning `role="status"`, danger `role="alert"`, info no role. Toasts: success `status`, warning `alert` (unchanged)                                                                                                                                                                                                                                                            |
| `code`, `kbd`, `samp`, `pre` (K:99)                                    | Minimum 12 px at auto and standard scale, including inside a 12 px and a 10 px parent; 15 px at `large`                                                                                                                                                                                                                                                                                                 |
| Primary against danger (`skill-v2-primary-vs-danger-{light,dark}.png`) | `#cb4a00` and `#9f1239`, luminance ratio **1.72** in both themes, hue 21.9° against 343.4°. Visibly different side by side, on `bg` and on `surface-2`. Hover `#c2410c` and `#881337`, pressed `#9a3412` and `#6b0f2a` measured on the buttons                                                                                                                                                          |

### Computed contrast

Light / dark. "Needs" is 4.5 for text, 3 for components and focus. 230 pairs were computed; every pair a
component uses passes. The 18 pairs under their threshold are explained: pressed-only surfaces
(`fg-subtle` and `fg-accent` on `surface-3`, `accent-fill` on `surface-3` in dark), hairlines and button or
keycap borders the label identifies, `fg-disabled` (exempt), and the focus ring against the fill it is
offset from.

| Pairing                                                                                              | Light                         | Dark                              | Result                                                                  |
| ---------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `fg` on bg / surface / surface-2 / surface-3                                                         | 16.97 / 17.72 / 16.12 / 13.96 | 16.58 / 15.08 / 13.29 / 11.03     | pass                                                                    |
| `fg-muted` on bg / surface / surface-2 / surface-3                                                   | 7.41 / 7.73 / 7.03 / 6.09     | 10.57 / 9.61 / 8.47 / 7.03        | pass                                                                    |
| `fg-subtle` on bg / surface / surface-2                                                              | 5.28 / 5.52 / 5.02            | 6.06 / 5.51 / **4.86**            | pass; the dark near-miss (4.5009) now has a 0.36 margin                 |
| `fg-subtle` on surface-3                                                                             | 4.35                          | **4.03**                          | fail, ruled out (no component uses it); CHANGELOG says 4.10             |
| `fg-accent` (link) on bg / surface / surface-2                                                       | 4.96 / 5.18 / 4.71            | 7.92 / 7.20 / 6.35                | pass                                                                    |
| `fg-success`, `-warning`, `-danger`, `-info` on surface                                              | 7.13 / 8.67 / 8.02 / 14.63    | 8.67 / 9.99 / 6.46 / 7.95         | pass                                                                    |
| `fg-<status>` on its surface (badge, alert) = badge dot on its tint                                  | 6.81 to 13.35                 | 6.89 to 9.64                      | pass (dot is `currentColor`, same ratio)                                |
| `fg-accent` on accent tint (accent badge, tab count)                                                 | 4.88                          | 6.33                              | pass                                                                    |
| `fg-on-accent` (white) on accent-fill / hover / pressed                                              | 4.65 / 5.18 / 7.31            | 4.65 / 5.18 / 7.31                | pass; same in both themes                                               |
| `fg-on-danger` on danger-fill / hover / pressed                                                      | 8.02 / 9.57 / 12.16           | 8.02 / 9.57 / 12.16               | pass                                                                    |
| Selected segment and ring on it: `fg-inverse` on `surface-inverse`                                   | 17.72                         | 18.20                             | pass                                                                    |
| Unselected segment ring and every focus ring: `border-focus` on bg / surface / surface-2 / surface-3 | 4.96 / 5.18 / 4.71 / 4.08     | 7.92 / 7.20 / 6.35 / 5.27         | pass                                                                    |
| Tooltip text `fg-inverse` on `surface-inverse`                                                       | 17.72                         | 18.20                             | pass                                                                    |
| Tooltip bubble `surface-inverse` against bg / surface                                                | 16.97 / 17.72                 | 16.58 / 15.08                     | pass (was 1.01 against dark bg)                                         |
| Avatar `fg` on `surface-3`                                                                           | 13.96                         | 11.03                             | pass                                                                    |
| Invalid border `border-danger` on surface / surface-2 / surface-raised                               | 8.02 / 7.29 / 8.02            | 6.46 / 5.69 / 5.69                | pass (was 2.59 and 2.29 in dark)                                        |
| Tab underline `border-selected` on bg / surface / surface-2                                          | 4.96 / 5.18 / 4.71            | 7.92 / 7.20 / 6.35                | pass (was 3.41 in light)                                                |
| Checked box, switch on, current page: `accent-fill` on bg / surface / surface-2 / surface-raised     | 4.45 / 4.65 / 4.23 / 4.65     | 3.86 / 3.51 / **3.09** / **3.09** | pass; thin in dark on surface-2 and surface-raised (modal, menu, toast) |
| Check mark and switch thumb `fg-on-accent` on `accent-fill`                                          | 4.65                          | 4.65                              | pass                                                                    |
| `accent-fill` on `surface-3`                                                                         | 3.66                          | **2.57**                          | no component puts a checked control there; theoretical                  |
| `fg-disabled` on surface                                                                             | 2.56                          | 2.66                              | exempt (1.4.3); buttons use opacity 0.5                                 |
| Default button border `border-strong` on surface                                                     | 1.48                          | 2.04                              | not required: the label identifies the button                           |
| Danger button fill against surface                                                                   | 8.02                          | 2.03                              | not required (white label 8.02:1)                                       |
| Status icons on `surface-raised` (toast)                                                             | 7.13 to 14.63                 | 5.69 to 8.81                      | pass                                                                    |

`tokens.json` against `covenant-tokens.css`: **87 colour tokens compared in both themes, 0
differences**; every CSS token has an entry in `tokens.json`.

### CHANGELOG figures, recomputed

Every ratio the CHANGELOG states was recomputed from `covenant-tokens.css`: 1.72, 4.65, 5.18, 7.31, 8.02,
9.57, 12.16, 4.65 / 3.51, 4.23 / 3.09, 8.02 / 6.46, 7.29 / 5.69, 17.72 / 18.20, 5.18 / 7.20, 16.58, 13.96 /
11.03, all badge dot figures (6.81 / 8.58, 8.38 / 9.64, 7.34 / 6.89, 13.35 / 7.88, 4.88 / 6.33), tab underline
4.96 / 7.92 and 5.18 / 7.20, `fg-subtle` 5.02 / 4.86, `fg` and `fg-muted` on `surface-3`, and the "was"
figures (1.85, 2.13, 1.01, 3.41). All match, except:

| Statement                        | Stated | Computed | Where                                                                    |
| -------------------------------- | ------ | -------- | ------------------------------------------------------------------------ |
| `fg-subtle` on `surface-3`, dark | 4.10   | **4.03** | `CHANGELOG.md` (entry 1, section 2) and `tokens.json:394` ("4.1:1 dark") |

The two entries disagree on `--cv-danger-fill-pressed`. **The second entry is right**: K:178-179, T:75-76
and 129-130 and `tokens.json:461-474` use `danger-800` for hover (9.57:1) and `danger-900` for pressed
(12.16:1), and `Button.md:20` and F:157 say the same. Entry 1 still says "pressed =
`--cv-danger-800` (9.57)" and "hover keeps `--cv-danger-fill-hover` (8.02)", which was true only before
entry 2. No doc contradicts the CSS.

Primitive scale tokens in component CSS or markup (the rule "semantic tokens only"): searched
`covenant.css`, `covenant.js`, `templates/page.html`, every Anatomy block and every other line of
`references/components/*.md`, `SKILL.md` and the checklist for `--cv-(neutral|accent|success|warning|danger|info)-<n>`,
hex, `rgb()` and `style=` attributes outside `covenant-tokens.css`. **0 violations.** The only matches are
prose naming the rule (K:5 comment, `Button.md:37`, S, F, checklist). The checklist's own grep (step 3)
returns nothing. The logo SVG files in `assets/logos/` carry fixed hex colours; they are artwork, not
component CSS.

### Item by item verdict

Items are those of the previous audit (this document before this revision), with the CHANGELOG's numbering.

| Item                                                        | Verdict                           | Evidence                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1 Invalid input border, dark (1.4.11)                     | **fixed**                         | K:217-218 use `--cv-border-danger`; 8.02 / 6.46 on surface, 7.29 / 5.69 on surface-2; computed border `rgb(159,18,57)` light, `rgb(255,122,122)` dark                                                                                                                    |
| 1.2 Focus ring on the checked segment (2.4.7, 1.4.11)       | **fixed**                         | K:317, 320: fill `surface-inverse`, ring `fg-inverse`; 17.72 / 18.20; `skill-v2-focus-segmented-dark.png`. The offset table is in F:158-166                                                                                                                              |
| 1.3 Toast timer never resumed (2.2.1)                       | **fixed**                         | J:211-240; five timed measurements above, all within 40 ms of the expected remaining time                                                                                                                                                                                |
| 2 Tooltip on primitives                                     | **fixed**                         | K:424 `surface-inverse` + `fg-inverse`; dark bubble `#f5f6f8`, 16.58 against bg; `skill-v2-gallery-tooltip-dark.png`                                                                                                                                                     |
| 2 Avatar on primitives                                      | **fixed**                         | K:475 `surface-3` + `fg`; 13.96 / 11.03                                                                                                                                                                                                                                  |
| 2 Badge dots                                                | **fixed**                         | K:355 `currentColor`; computed dot equals badge text colour in both themes; 4.88 to 13.35 on the tints                                                                                                                                                                   |
| 2 Tab underline                                             | **fixed**                         | K:626 `border-selected`; 4.96 / 7.92 on bg, minimum 4.71 on surface-2                                                                                                                                                                                                    |
| 2 Selected segment fill used `--cv-fg`                      | **fixed**                         | K:317 `surface-inverse` (same colour, now a named role)                                                                                                                                                                                                                  |
| 2 Logo point and cover artwork                              | **fixed** (cover not testable)    | Template, `SidebarNav.md` and `AppShell.md` inline marks use `var(--cv-brand-accent)`; `cv-logo` swaps lockups with the theme (K:131-135, verified). `brand-tint` and `brand-deep` exist in both files but no shipped component uses them: the cover is not in the skill |
| 2 `fg-subtle` on `surface-2`, dark, 4.5009                  | **fixed**                         | `#9096a6`: 4.86 (T:120)                                                                                                                                                                                                                                                  |
| 2 `fg-subtle` on `surface-3`                                | **fixed as a rule; figure wrong** | F:110 and checklist:32 forbid it; K uses `fg-subtle` only for `.cv-hint`, placeholder and the breadcrumb chevron. Dark ratio is 4.03, not 4.10                                                                                                                           |
| 3 Menu and listbox motion                                   | **fixed**                         | K:327, 532, tokens used; 120 ms measured; reduced motion removes it (tokens 0 ms)                                                                                                                                                                                        |
| 3 Radius `full` on `.cv-tab__count`                         | **fixed** (in the doc)            | F:152 "status badges, tab counters, avatars and switches"; K:628 unchanged                                                                                                                                                                                               |
| 3 Danger pressed token                                      | **fixed**                         | K:178-179, T:76, `tokens.json:469`; hover 9.57, pressed 12.16 measured on the button. CHANGELOG entry 1 stale (see above)                                                                                                                                                |
| 3 Every size in rem                                         | **fixed**                         | K:564 `20rem`; K:99 `max(0.95em, var(--cv-text-xs))`, 12 px minimum measured; F:118 says Covenant sets the root size and applications never do. Left on purpose: `--cv-target-min: max(24px, 1.5rem)` (K:61), 8 px keyframe offsets, borders                             |
| 3 Sticky top bar                                            | **fixed**                         | K:590 sticky; 2.4.11 measured (7.4 px minimum gap, 70 stops); `TopBar.md` writes `3rem`                                                                                                                                                                                  |
| 3 Drawer below 420 px                                       | **fixed**                         | K:514 `max-width: 100vw`; 320 px wide at 320 px                                                                                                                                                                                                                          |
| 3 Alert roles                                               | **fixed**                         | `Alert.md` anatomy: status, status, alert, none; text explains the two cases                                                                                                                                                                                             |
| 3 Focus ring offsets undocumented                           | **fixed**                         | F:158-166 table, matches K:213-215, 318, 542                                                                                                                                                                                                                             |
| 3 Motion only on overlays and toasts                        | **holds**                         | Computed animations on the gallery: listbox, toasts; menu and dialogs when open; no hover or press transition anywhere                                                                                                                                                   |
| 3 `tokens.json` equals the CSS                              | **holds**                         | 87 colour tokens, 0 differences, both themes                                                                                                                                                                                                                             |
| 4 Self-hosting (fonts, Phosphor, no `@import`)              | **fixed**                         | 0 non-local requests in 28 runs; fonts and icons rendered; caveats in [Network, fonts, icons](#network-fonts-icons) (unshipped fallback formats, template not openable in place)                                                                                         |
| Second entry: primary `#cb4a00`, white label, darker danger | **fixed, with trade-offs**        | Every figure recomputed and right; 1.72 and 22° / 343° confirmed; buttons distinguishable in both themes. Trade-offs below                                                                                                                                               |

### What the CHANGELOG does not say

None of these fails a criterion; they are worth telling Claude Design.

1. **Dark primary against danger is closer than before.** In dark the old pair (`#fb923c` against `#be123c`)
   differed by 2.78:1 in luminance; the new pair is 1.72:1, the same as light. They are still told apart by
   hue (orange against crimson), and the CHANGELOG's "was 1.21" is the light figure only.
2. **The primary hover step is small:** `accent-fill` to `accent-fill-hover` is 1.11:1 (`#cb4a00` to
   `#c2410c`), pressed 1.57:1 from the fill. Danger steps are 1.19 and 1.27. Hover is visible but faint.
3. **Checked controls have a thin margin in dark** on `surface-2` and `surface-raised` (3.09:1, 0.09 above
   the 3:1 limit), which is where a checkbox in a modal, a menu or a hovered row sits. The checked box and
   switch have no other boundary (their border is the fill).
4. **The dark theme has one orange fill for both themes.** The accent fill is lower against dark surfaces
   (3.51 on surface, 3.86 on bg) than the old `#fb923c` (about 7), so a dark primary button stands out less
   from the page; its white label (4.65:1) is what carries it.
5. **A dark danger button against the page is 2.03:1**; its label (8.02:1) identifies it, so 1.4.11 does not
   apply.
6. **`phosphor/*/style.css` lists fonts that are not shipped** (see above) and `templates/page.html`
   cannot be opened from its own folder.

### Not verified

- No screen reader (NVDA, VoiceOver). Not run: the text-spacing bookmarklet (1.4.12), real 200 % and
  400 % browser zoom (320 px width and `large` text size were used instead), 2.5.7 dragging (no component
  drags), tooltip hover and Escape behaviour (1.4.13), Combobox and CommandMenu typing beyond ArrowDown and
  Escape.
- Fonts and Phosphor were the skill's own files this time (no CDN, no npm copy). The design system's
  published preview pages (which the CHANGELOG says still load Phosphor from unpkg) are not in the skill
  and were not looked at.
- The Locavern and Chrono apps were not run with the new skill files; only their code was read.
- Axe finds about a third of WCAG issues; "0 violations" is not "conformant".

## Verification of the category colour export (ce6ed32)

### Verdict

The export holds. Every contrast range and every colour-distance figure in the CHANGELOG entry
"2026-11-19 (3)" was recomputed and matches. All 16 categories pass in both themes, `tokens.json` equals
`covenant-tokens.css`, there are no primitive tokens in the new code, nothing external is requested and axe
finds 0 violations in 28 runs. Decisions C (category colours) and D (`--cv-fg-inverse-muted`) are
**delivered**. What is left are small defects and limits (see [Open](#open-after-this-check)), none of which
fails a WCAG criterion. The 16 colours keep Chrono's hues in Chrono's order, but they are not a copy of
Chrono's colours: five of them moved by more than 10 on the light marker (table below).

Method: contrast with the WCAG formula; ΔE2000 and the colour-vision simulation (Machado 2009, severity
1.0, applied in linear sRGB) implemented from scratch (the ΔE code reproduces the Sharma test pairs); axe
with `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa`; Chromium through Playwright; the skill folder served
flat as before. Scripts stay in the session scratchpad.

### Contrast, recomputed

| Statement                                                   | Stated                      | Computed                                                          |
| ----------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Bright tier (odd) markers, worst ground per marker          | 3.20 - 3.24                 | **3.20 - 3.24** (light 3.20 - 3.23, dark 3.20 - 3.24)             |
| Bright tier fills, white label                              | 4.60 - 4.64                 | **4.60 - 4.64**                                                   |
| Deep tier (even) markers, light                             | 4.60 - 4.64                 | **4.60 - 4.64**                                                   |
| Deep tier markers, dark                                     | 5.21 - 5.25                 | **5.21 - 5.25**                                                   |
| Deep tier fills, white label                                | 6.51 - 6.57                 | **6.51 - 6.57**                                                   |
| Markers on `surface-3` (forbidden), worst                   | 2.66                        | **2.66** (dark), 2.77 (light)                                     |
| Dark marker on the highlighted option (`bg-accent-subtle`)  | 2.82                        | **2.82** (category 11 over `surface-2` and `surface-raised`)      |
| `--cv-fg-inverse-muted` on `--cv-surface-inverse`           | 6.91 / 5.16                 | **6.91 / 5.16** (`#a1a1aa` on `#18181b`, `#626877` on `#f5f6f8`)  |
| `--cv-fg-inverse` on `--cv-surface-inverse`                 | 17.72 / 18.20               | **17.72 / 18.20**; muted against it 2.56 / 3.53 (visibly quieter) |
| `--cv-fg-muted` and `--cv-fg-subtle` on the inverse surface | 2.29 / 1.57 and 3.21 / 2.74 | **match** (they stay forbidden there)                             |
| `--cv-fg-subtle` on `--cv-surface-3`, dark (correction)     | 4.03                        | **4.03**; `tokens.json` now says 4.03, no "4.10" is left          |

All 32 per-token usage notes in `tokens.json` (the ratio of each marker in both themes, the white ratio of
each fill, the default-order position of each hue) match the computed values: 0 differences. The 16
markers pass 3:1 against `bg`, `surface`, `surface-2` and `surface-raised` in both themes (lowest 3.20,
on `surface-2`), and the 16 fills pass 4.5:1 under white (lowest 4.60). `--cv-fg-on-cat` is `#ffffff` in
both themes. The rendered dot, stripe, segment and block colours equal the tokens for 1 to 16 in both
themes; without `data-cat`, and with `data-cat="0"`, `"17"` or `"x"`, category 16 (slate) applies, as
documented.

`tokens.json` against `covenant-tokens.css`: **121 colour tokens compared in both themes, 0
differences** (every category token and both new text roles included).

Primitive-token rule: searched `covenant.css`, `covenant.js`, `templates/page.html`, every
`references/components/*.md` (all Anatomy blocks, CategoryColor included), `SKILL.md` and the references
for `var(--cv-(neutral|accent|success|warning|danger|info)-<n>)`, hex, `rgb()` and colour inline styles.
**0 violations.** The Anatomy blocks only set the layout properties `--cv-start`, `--cv-span` and
`--cv-share`. The only literal colours in `covenant.js` are the `#000000` and `#ffffff` search fallbacks.

### Colour distances, recomputed

ΔE2000 of the closest pair. "Wheel neighbours" are the 15 chromatic hues in a ring (including rose to
orange, the pair the CHANGELOG names) plus slate against rose and orange. Fills are the same in both themes.

| Set                    | Normal vision         | Protanopia             | Deuteranopia      | Tritanopia          |
| ---------------------- | --------------------- | ---------------------- | ----------------- | ------------------- |
| Wheel, markers light   | 11.8 violet-purple    | 6.2 yellow-lime        | 8.7 blue-indigo   | 4.3 rose-orange     |
| Wheel, markers dark    | 14.6 violet-purple    | 11.1 blue-indigo       | 8.9 rose-orange   | **4.0** rose-orange |
| Wheel, fills           | **9.8** violet-purple | 5.2 purple-fuchsia     | 7.8 blue-indigo   | 5.3 rose-orange     |
| First 6, markers light | 14.8 blue-indigo      | 9.5 blue-indigo        | 8.7 blue-indigo   | 6.5 blue-cyan       |
| First 6, markers dark  | 16.1 blue-indigo      | 6.6 pink-cyan          | 6.1 pink-teal     | 8.5 blue-cyan       |
| First 6, fills         | 13.9 blue-indigo      | 9.3 blue-indigo        | 7.8 blue-indigo   | 8.7 blue-cyan       |
| First 8, markers light | 12.8 indigo-slate     | 3.9 indigo-fuchsia     | 6.0 blue-fuchsia  | 6.5 blue-cyan       |
| First 8, markers dark  | 10.5 indigo-slate     | 5.1 pink-slate         | 4.6 teal-slate    | 6.5 indigo-slate    |
| First 8, fills         | 13.9 blue-indigo      | **3.1** indigo-fuchsia | 5.3 blue-fuchsia  | 7.1 lime-slate      |
| All 120 pairs, fills   | 8.8 indigo-purple     | 1.4 orange-lime        | 1.9 indigo-purple | 5.1 teal-sky        |

Against the CHANGELOG: worst neighbour, normal vision **9.8** (violet-purple, fills): confirmed. Worst
neighbour under any of the three simulations **4.0** (rose-orange, tritanopia, dark markers): confirmed
(4.03). I rebuilt the previous palette from the earlier prompt: violet-purple was 3.4 to 3.6 and 0.44 under
protanopia, amber-yellow 1.28 under deuteranopia, as the CHANGELOG says. The ordering claims also hold in
substance: the first six are at least 6.1 apart for everyone; the first eight drop to 3.1 (protanopia,
indigo against fuchsia, fills), which is why "for most" is the right wording. Past eight, pairs collapse
(orange and lime are 1.0 apart for protanopia): the "group the rest as Other" rule is needed, not
decorative.

### Custom colours: `Covenant.categoryColors(hex)` and `setCategory(element, hex)`

Tested in Chromium in both page themes. For every valid input: no exception, derived light marker 3.10 to
3.14 on all four light grounds, derived dark marker 3.11 to 3.14 on all four dark grounds, fill 4.60 to 4.64
under white, and the rendered dot, stripe and block equal the derived values in both themes. **0 failures.**

| Input     | Light marker | Dark marker | Fill      | Note                                        |
| --------- | ------------ | ----------- | --------- | ------------------------------------------- |
| `#ffffe0` | `#8f8f00`    | `#797900`   | `#797900` | very light yellow becomes olive             |
| `#ffff00` | `#8f8f00`    | `#797900`   | `#797900` | same result as the pale yellow              |
| `#000033` | `#7b7bff`    | `#5f5fff`   | `#5e5eff` | very dark navy becomes a lighter periwinkle |
| `#0a0a2a` | `#8181e1`    | `#6767db`   | `#6767db` |                                             |
| `#808080` | `#8a8a8a`    | `#757575`   | `#757575` | pure grey                                   |
| `#ffffff` | `#8a8a8a`    | `#757575`   | `#757575` | identical to grey                           |
| `#000000` | `#8a8a8a`    | `#757575`   | `#757575` | identical to grey and to white              |
| `#ff0000` | `#ff4444`    | `#eb0000`   | `#eb0000` | saturated red                               |
| `#1d4ed8` | `#6386ea`    | `#426de6`   | `#426de6` | close to palette blue (9)                   |

Also accepted: `#f00`, `ff0000` (no hash), upper case, surrounding spaces. Invalid input (`red`, `#12`,
`xyz`, empty string, `#gggggg`, `#abcd`, `#12345`, `rgb(1,2,3)`, `null`, `undefined`, `{}`, `[]`) returns
`null` from both functions and never throws; `setCategory(null, 5)` returns `null`.

`setCategory(el, n)`: 1 to 16 (number, `"3"`, `" 7 "`, `[5]`) set `data-cat` and remove any custom
properties. `0`, `17`, `-1`, `1.5`, `true`, `NaN`, `"17"`, `"#5"` return `null` and leave the element as it
was (no reset to the default, no error). Edge cases: a digit string that is not a valid category is read as
a hex colour, so `"123"`, `"012"`, `"1e1"`, `"abc"` and the number `123456` become custom colours
(`#112233` and so on), where `0` and `17` are refused. The documented form is `#rrggbb`.

What the derivation means in practice (it works as documented: hue and saturation kept, lightness moved):
colours that differ only in lightness collapse (white, black, grey; pale and pure yellow), a dark colour can
come out lighter than the input, markers always land at the contrast floor (about 3.1), so custom colours
never use the deep tier, and nothing keeps a custom colour apart from a palette colour or from another
custom colour. The recommendation to restrict users to the 16 entries stands.

### Nested `data-theme`

Pages with a dark section in a light page and the reverse (plus a third level), at 1440 and 320 px.
Measured colours of the section, its text, a muted caption, a button, a badge, an alert, an input, the
running-timer card on `surface-inverse` and the three levels of nesting: all equal the tokens of the
section's own theme (0 wrong in 12 checks per page), and `--cv-fg-inverse-muted` renders as `#a1a1aa` in
a light page's card and `#626877` in a dark page's card. axe: 0 violations on all four pages. No
horizontal scroll. One defect: with **dark > light > dark** nesting a `data-cat="custom"` element at the
third level gets the **light** marker (`#6386ea` instead of `#426de6` for `#1d4ed8`), because the rule
`[data-theme="dark"] [data-theme="light"] [data-cat="custom"]` also matches there and comes after the dark
rule. Palette categories 1 to 16 are not affected (tokens are redefined per scope). The light marker is
still above 3:1 on a dark ground, so this is cosmetic.

### Network, axe and regressions

| Check                                                                                                                                                                                      | Result                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requests not to the local server (Playwright `route`, all runs below)                                                                                                                      | **0**; no 4xx; fonts and Phosphor load                                                                                                                          |
| `templates/page.html`, gallery of the **35** Anatomy blocks (CategoryColor: card, table, timeline, chart, legend), plus a palette section built here, light and dark, 1440x900 and 320x800 | **0 violations** in 8 runs; no horizontal scroll (`scrollWidth` 1440 and 320)                                                                                   |
| Gallery with modal, drawer, command menu, menu, four toasts and tooltips                                                                                                                   | **0 violations** in 20 runs                                                                                                                                     |
| axe "incomplete"                                                                                                                                                                           | only the `⌘` keycap (non-BMP glyph), as before; the 19 category blocks (white on fill) are checked and pass                                                     |
| Nested-theme pages                                                                                                                                                                         | 0 violations in 4 runs                                                                                                                                          |
| Focus ring, selected segment                                                                                                                                                               | `#ffffff` on `#18181b` (17.72) light, `#0a0b0e` on `#f5f6f8` (18.20) dark: unchanged                                                                            |
| Toast pause and resume                                                                                                                                                                     | hover past the timeout: stays, removed 1358 ms after leave (expected about 1360); focus: 1503 ms after blur; warning and danger stay 7 s; success leaves at 6 s |
| Sticky top bar, 70 tab stops                                                                                                                                                               | `top: 0` after a 1500 px scroll; focused element never closer than 7.39 px (1440) and 7.28 px (320) below it                                                    |
| Drawer                                                                                                                                                                                     | 320 px at 320, 420 px at 420 and 1440                                                                                                                           |
| Menu motion, reduced motion, alert roles, `code` floor                                                                                                                                     | unchanged (120 ms, 0 ms with reduce, status/status/alert/none, 12 px)                                                                                           |

Two things looked like regressions and are not. My gallery puts the toast region in the middle of a long
page, so the toast hover test missed the toast; on `page.html` it passes. The combobox list opens with
ArrowDown or typing, not with a click, as before. `covenant.js` and `covenant.css` change by additions only
(the only removed lines are the header comment and the export list in `covenant.js`). One gallery artefact is worth telling Claude
Design: a `.cv-cat-timeline` inside a flex column with `align-items: flex-start` collapses to 8 px wide
(its children are absolute and the list has no width), which also made axe report "overlapped" for two
blocks; with `align-self: stretch` it renders and passes.

### What the colours look like

Screenshots in `scratchpad/ui-compare/`: `skill-v3-palette-{light,dark}.png` (16 swatches, 16 fills, the
default order as bar charts, legend, timer card), `skill-v3-timeline-{light,dark}.png`,
`skill-v3-chart-{light,dark}.png`, `skill-v3-card-{light,dark}.png`, `skill-v3-categorycolor-{light,dark}.png`,
`skill-v3-palette-cvd-{protanopia,deuteranopia,tritanopia}-{light,dark}.png`, the four-row sheets
`skill-v3-palette-cvd-sheet-{light,dark}.png` and `skill-v3-nested-{light,dark}-{1440,320}.png`.

- **Chrono-like?** In light, yes for the family: same 16 hues in the same order, same saturated look, hue
  moved by 0.6 degrees at most. But the deep tier makes amber read as brown, lime as olive and teal as dark
  green, while blue, violet, fuchsia and rose are lighter than Chrono's. The odd and even tiers alternate
  visibly in the swatch row. In dark, the even tier is the light one (indigo, purple, pink, slate are
  pastel) and the odd tier is saturated and darker: the dark palette looks quite different from the light
  one, which Chrono never had (it has no dark mode).
- **Neighbours, normal vision:** clearly distinguishable, in both themes (closest 9.8 as fills).
- **Neighbours under simulation:** protanopia and deuteranopia collapse the palette to blue, olive and
  grey, and the lightness alternation is what keeps neighbours apart; the first six remain separable,
  the 16-colour chart does not (many segments look alike). Tritanopia keeps teal, red and grey families
  apart; rose and orange are closest (4.0).
- **Same project, two colours:** a marker (chart segment, dot) and a fill (timeline block) differ in
  lightness by design. In light it is a small step. In dark it is large for several hues (lime
  `#6bad0e` against `#416808`, pink `#e877a9` against `#b11d5f`), so one project looks like two colours
  when a chart and a timeline share a screen. The name or legend next to each resolves it.

### Chrono drift

ΔE2000 from Chrono's original hex (`Projets.js:7-10`) to the new colour. "Marker" is what a stripe or dot
uses (light theme); "fill" is what a block with a white label uses. Under 2 is near identical, 2 to 6 is a
slight shift, 6 to 10 is visible, over 10 is a clearly different colour.

| #   | Hue     | Chrono    | Marker, light | ΔE   | ΔL\*  | Fill      | ΔE   | Reading   |
| --- | ------- | --------- | ------------- | ---- | ----- | --------- | ---- | --------- |
| 1   | orange  | `#ea580c` | `#eb580c`     | 0.2  | +0.2  | `#ca4c0a` | 7.5  | same      |
| 2   | amber   | `#d97706` | `#a75b05`     | 13.3 | -13.3 | `#8d4d04` | 21.0 | different |
| 3   | yellow  | `#ca8a04` | `#b77d04`     | 5.0  | -5.5  | `#9d6b03` | 12.7 | slight    |
| 4   | lime    | `#65a30d` | `#4d7b0a`     | 14.1 | -14.1 | `#416808` | 21.9 | different |
| 5   | green   | `#16a34a` | `#159d48`     | 1.9  | -2.0  | `#12873e` | 9.5  | same      |
| 6   | teal    | `#0d9488` | `#0b7c72`     | 8.7  | -8.5  | `#096961` | 15.6 | visible   |
| 7   | cyan    | `#0891b2` | `#0894b6`     | 1.0  | +1.1  | `#077f9c` | 6.6  | same      |
| 8   | sky     | `#0284c7` | `#0274af`     | 6.2  | -6.1  | `#026396` | 12.6 | visible   |
| 9   | blue    | `#2563eb` | `#5484ef`     | 11.4 | +10.6 | `#336dec` | 3.4  | different |
| 10  | indigo  | `#4f46e5` | `#625ae8`     | 5.9  | +5.9  | `#4c42e4` | 1.1  | slight    |
| 11  | violet  | `#7c3aed` | `#9e6ef2`     | 14.5 | +13.5 | `#8c51ef` | 5.9  | different |
| 12  | purple  | `#9333ea` | `#973beb`     | 1.7  | +1.6  | `#8318e5` | 4.9  | same      |
| 13  | fuchsia | `#c026d3` | `#d052e0`     | 8.4  | +8.3  | `#c226d5` | 0.5  | visible   |
| 14  | pink    | `#db2777` | `#d0236f`     | 2.7  | -2.6  | `#b11d5f` | 9.4  | slight    |
| 15  | rose    | `#e11d48` | `#e95374`     | 10.3 | +8.1  | `#e2214c` | 0.9  | different |
| 16  | slate   | `#475569` | `#5d708a`     | 10.0 | +10.9 | `#4f5f75` | 3.6  | visible   |

Mean marker drift 7.2, median 7.3. Four markers are near identical (orange, cyan, green, purple), three
slight (yellow, indigo, pink), four visible (teal, sky, fuchsia, slate) and five clearly different
(**amber, lime, violet, blue, rose**). The fills move more than the markers for the deep tier (amber 21.0,
lime 21.9, teal 15.6, yellow 12.7, sky 12.6) and less for the bright tier (blue 3.4, indigo 1.1, fuchsia
0.5, rose 0.9). Chrono's stripes and dots were its raw hex in both roles, so every hue now shows two
related colours. If the port keeps the Chrono look as a goal, amber and lime are the two to look at first:
they are the ones a Chrono user will call another colour.

### Open after this check

For Claude Design (none blocks adoption):

1. **Nested custom colour** (dark > light > dark): fix the third rule so it only applies when the nearest
   `data-theme` ancestor is light.
2. **`tokens.json` usage text** of `cv-fg-inverse-muted` and `cv-fg-on-cat` ends with the boilerplate "Reads
   on `cv-bg`, `cv-surface` and `cv-surface-2`", which is wrong for both (`fg-inverse-muted` on those
   grounds is 2.33 to 2.56 in light and 2.58 to 3.22 in dark; white on the light `bg` is about 1.05).
3. **`setCategory`** with a bare digit string (`"123"`, `"1e1"`) becomes a hex colour, and an invalid
   value silently keeps the previous category. Accept only `#rgb` and `#rrggbb`, and say what happens on
   `null`.
4. **`.cv-cat-timeline`** needs a width (`width: 100%` or `align-self: stretch`) to survive a flex parent.
5. **The "full palette" and the "both themes side by side" demo** named in the CHANGELOG are not in the
   skill (the Anatomy has the card, the table, the timeline and the chart only); I built the palette to
   test. The design system's preview pages are still out of reach.
6. **Dark palette character:** pastel even tier, and large marker against fill steps in dark (see above).
   Worth one look by the maintainer; nothing fails.

For the port (not a skill defect): Chrono stores a hex per project. Migration: map each of the 16 original
hexes to its number, store the number, and decide what happens to custom hexes (keep them as `custom` through
`setCategory`, or ask the user to pick one of the 16). New projects in either app take the default order,
starting at blue (9). Decide whether Chrono's native colour picker stays; the skill recommends
dropping it.

Not verified: real colour-vision users or a hardware simulator (only Machado matrices, my implementation;
it maps white to white and reproduces the published ΔE test pairs); forced-colors and high-contrast modes
(markers are backgrounds and a box-shadow, so they probably vanish; the name stays); print; 200 % browser
zoom and `data-text-size="large"` with the chart and timeline (320 px was used); long names in narrow
timeline blocks (the ellipsis rule says the full name must be elsewhere); screen readers (the `cv-sr-only`
time ranges and values were read in the DOM, not heard); the design system's own preview pages.

## Three-way comparison

Screenshots, kept outside the repository in the session scratchpad (`…/scratchpad/ui-compare/`), new
for skill `185c9b1`: `skill-v2-page-{light,dark}-{desktop,narrow}.png`,
`skill-v2-page-{light,dark}-narrow-nav-open.png`, `skill-v2-gallery-{light,dark}-{desktop,narrow}.png`
(full-page), `skill-v2-overlay-{md-delete,dr-entry,cmd,menu,toasts}-{light,dark}.png`,
`skill-v2-focus-segmented-{light,dark}.png`, `skill-v2-formfield-invalid-{light,dark}.png`, `skill-v2-primary-vs-danger-{light,dark}.png`,
`skill-v2-gallery-{tooltip,toast,badge,tabs,avatar}-{light,dark}.png`, `skill-v2-topbar-sticky-scrolled.png`,
`skill-v2-drawer-320.png`. The `skill-*` images of the first pass (old skill) and the `chrono-*` and
`locavern-*` images (42) are in the same folder.

In the Locavern column, "Skill's" means the previous skill version that Locavern vendors, unless a row says
otherwise; what differs from `185c9b1` is listed under
[What Locavern must take](#what-locavern-must-take-from-the-new-skill).

### Tokens and colour

| Skill                                                                                                                                                                                                    | Chrono                                                                                                                                                 | Locavern                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Zinc neutrals 0 to 1000, one orange accent, four status hues; semantic roles for surfaces, text, borders, fills, status pairs, `surface-inverse`, `border-danger`, `border-selected`, `brand-*` (T:3-97) | Same primitive hex values (CC:19-69); roles for surfaces and text only (CC:72-92). No `accent-fill`, `fg-on-accent`, `border-control`, status surfaces | Identical to the previous skill (LT = old T); 41 lines behind the new one                                                  |
| Accent fill `#cb4a00` with white in both themes (4.65:1), hover `#c2410c`, pressed `#9a3412`; `--cv-brand-accent` (`#ea580c` light, `#fb923c` dark) for graphics only, never behind text (S:63, F:88-93) | Fill `#ea580c`, white label 3.56:1 (CA:99); accent-500 as text and fill throughout                                                                     | Previous skill's fill: `#c2410c` light, `#fb923c` with a dark label in dark (LT:55)                                        |
| Status colours mean status only (S:64); danger fill is deep crimson `#9f1239` with white text (8.02:1), pressed `#6b0f2a`                                                                                | Used for status; also 16 categorical project hues (`Projets.js:7-10`), including green, yellow, red                                                    | Status only                                                                                                                |
| Raw literals and primitive scale tokens forbidden in components (checklist, S:62); 0 found in the skill                                                                                                  | 53 hex or `rgba(` literals and about 103 primitive references in `js/*.js` and `app.css`                                                               | No hex in `app.css`; 28 primitive references there, 12 of them `accent-500`, and one in `index.html` (non-text; see below) |

### Typography and numerals

| Skill                                                                                                                                                                                                                    | Chrono                                                                                                                                                            | Locavern                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| IBM Plex Sans and Mono, self-hosted in `assets/fonts/` (`covenant-fonts.css`, OFL); 13 px body; 12 px floor, `code` and `kbd` included (K:99); every size in rem; headings 600; `cv-num` mono tabular (F:115-121, K:102) | Plex via Google Fonts `@import` (CC:12); 10 and 11 px tokens (CC:99-100) and 9 px literal (`App.js:39`); px everywhere; `html, body` forced to 13 px (CC:228-232) | Skill's, fonts bundled with `@fontsource` (`src/main.js:1-6`)                        |
| Page title is the top bar `h1` at `--cv-text-md` (TopBar.md, K:595); type roles up to `cv-display-lg` 48 px exist for numerals and headings (T:181-193)                                                                  | 20 px page title in content (CA:46); durations and KPIs in Plex Mono 500 at 15 to 26 px (`Timeline.js:39,412`, `Rapport.js:59`)                                   | Topbar `h1` 14 px plus an `h2` with a class that does not exist (`today-view.js:89`) |
| Overline 12 px / 600 / 0.08em uppercase (T:193)                                                                                                                                                                          | 11 px, 10 px, tracking 0.06em (CA:42-44)                                                                                                                          | Skill's                                                                              |

### Density and sizing

| Skill                                                                                                      | Chrono                                                                                                                                   | Locavern                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Controls and rows 32 px (`--cv-row-md`), small 28 px, tabs 40 px, targets 24 px; padding 8 x 12; 4 px grid | Buttons 28, 32, 36; inputs 32; nav 30; icon buttons 26, 30, 36 (`UI:15,41`, `CA:71-73`); off-grid 6, 7, 10, 11, 14 px gaps (CA:32-36,72) | Skill's; many actions use `cv-btn--sm` (28 px), the skill's default is 32 |
| Cards 20 px padding (16 compact, 24 prominent); content padding 24 px, max 90rem (K:454-462,669)           | Card header 12 x 16, flush rows 10 x 16 (CA:63); page padding 24 x 32, no max width (`App.js:151`)                                       | Skill's card, plus `surface-2` sub-cards inside (LA:1659-1665)            |

### Surfaces, radius, elevation

| Skill                                                                                                                                                                       | Chrono                                                                                                 | Locavern                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Flat; card 1 px border, radius 8, `shadow-sm`; radius 12 only for modal, drawer, command menu; never nest cards (F:148-153, Card.md)                                        | Card radius 12 (CA:61), panel 10 (off scale, CA:64); hairline rows in one card (CA:145-147)            | Radius 8 (LC:444-449); box in box: cards holding bordered sub-cards and chips                                                                    |
| Modal 30rem, footer on `surface-2`; toast on `surface-raised`, themed, `shadow-xl` (K:496-511,396-404)                                                                      | Modal 460 px, hand-built; toast always `#09090b`, radius 10 (`UI:332,405-423`)                         | Skill's                                                                                                                                          |
| No gradients, no `backdrop-filter`; scrim is the only transparency (F:128,169-171)                                                                                          | None; custom 10 px scrollbars (CA:19-21, not in the skill)                                             | None                                                                                                                                             |
| `--cv-surface-inverse` (`#18181b` light, `#f5f6f8` dark) with `--cv-fg-inverse`, 17.72 / 18.20:1; used by the tooltip and the selected segment. No muted caption role on it | Near-black "ink" card for running timers, `--cv-fg` used as a background (`PointageWidget.js:100-110`) | Pressed toolbar buttons use `--cv-fg` as a fill (LA:508,751); the tooltip uses `neutral-900` (LA:2098), which is invisible against the dark page |

### Icons

| Skill                                                                                                                                                                                                                | Chrono                                                                                                                        | Locavern                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Phosphor 2.1.x self-hosted (2.1.2 shipped in `assets/phosphor/`), regular default, bold for emphasis only; 1rem (`--cv-icon-size`), `aria-hidden`; no icon next to self-explanatory labels (Icons.md, F:ICONOGRAPHY) | Phosphor 2.1.1 vendored; regular plus **fill** for play, timer (`PointageWidget.js`); explicit 12, 14, 15, 16 px (`UI:29,52`) | Phosphor 2.1.2 from npm; regular and bold (`src/main.js:7-8`) |

### Motion

| Skill                                                                                                                                                                                                                                        | Chrono                                                                                                                                                                                                                                                     | Locavern                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Only overlays and toasts move: 180 ms enter, 280 ms drawers; buttons, inputs, rows instant; no transform on press; no loop; menus and listboxes fade in 120 ms (K:327,532); reduced motion zeroes the duration tokens (F:173-178, checklist) | 120 ms on 10 interactive classes (CA:76,86,96,108,121,130,139,145,152,162); `scale(0.97)` on press set from JS (`UI:25-27`); infinite pulses (`PointageWidget.js:50,116`, `Timeline.js:342,572`); reduced-motion rule only shortens durations (CC:280-285) | Previous skill's (LC = old K): no menu fade; no hover motion |

### Layout, shell, sidebar, top bar

| Skill                                                                                                                                             | Chrono                                                                                                                                           | Locavern                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Grid shell: sidebar 14.5rem, sticky top bar 3rem (K:590), content max 90rem; drawer below 1024 px; one column below 768 px; skip link (K:666-701) | Flex shell, sidebar 264 px hard-coded (`App.js:107`), no top bar, no `@media` besides reduced motion; fails reflow (main column 64 px at 320 px) | Skill's shell; page not framed correctly (8 px body margin, 916 px page in a 900 px viewport) |
| Sidebar: brand logo SVG, icon plus label, overline groups (SidebarNav.md); logos copied, never redrawn                                            | 28 px ink square with a white icon; presence widget and timers inside the sidebar (`App.js:113-145`)                                             | Skill's                                                                                       |

### Forms and controls

| Skill                                                                                                                                                                                                                                         | Chrono                                                                                                                                                          | Locavern                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Input boundary `border-control` (3:1 or more; `#71717a` light, `#7d8494` dark), 2 px focus outline in `border-focus` (`border-danger` when invalid, 8.02 / 6.46:1), native `<select>` in `.cv-select`, 24 px checkbox hit area with 16 px box | Boundary `neutral-300`, 1.48:1 (CA:118); focus by inline JS glow and `outline: none` (CA:119, `UI:73-77`); select has no focus indicator; custom 18 px checkbox | Skill's; some selects in the tasks table lack the `.cv-select` wrapper                                       |
| SegmentedControl on native radios; `cv-btn--ghost cv-btn--icon` with `aria-label` for icon actions; Tooltip; Menu                                                                                                                             | Pill tabs in the add-timer modal; icon ghost buttons (`UI:39-53`)                                                                                               | Text buttons, four per row (`task-list-view.js:622-654`), seven per project card (`project-view.js:101-125`) |

### Data display

| Skill                                                                                                                                                       | Chrono                                                                                                                                                           | Locavern                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| DataTable: 32 px rows, 12 px sentence-case header, mono right-aligned numbers, focusable scroll region; Badge with dot and word; Card; EmptyState with icon | Rows are flex lists with hairlines, not tables; badges at 11 px; empty state is centred text (`.ch-vide`, CA:58); project colour stripe, dot and timeline blocks | `cv-table`, up to three or four chips per row, `cv-empty` |

### Overlays

| Skill                                                                                                                                                                                           | Chrono                                                                                       | Locavern                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Native `<dialog>` with `showModal()` (focus trap, Escape, focus return); popover Menu; Toast with live roles that pauses on hover and focus and resumes with the time left; Tooltip with Escape | Hand-built `div role="dialog"`, Escape only, no focus return (`UI:331-386`); toast dark-only | Previous skill's, plus a tooltip helper (`tooltip.js`) and its own toast pause and resume |

### Focus and accessibility

| Skill                                                                                                                                                                                                      | Chrono                                                                                                                         | Locavern                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 2 px `border-focus` outline, keyboard only, never removed, offset per component (F:158-166), `fg-inverse` on the checked segment; skip link; landmarks; global shortcuts use a modifier (2.1.4, checklist) | Ring in `accent-500` (3.56:1 on white); no focus on selects; no skip link; single-key shortcuts Space, N, S (`App.js:207-231`) | Skill's; `Ctrl+K` only (`command-palette.js:213`) |

### Dark mode

| Skill                                                                                                                                                                                    | Chrono                                                                                                                                          | Locavern                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `data-theme="dark"` token overrides, all roles, themed status surfaces; same accent fill and white `fg-on-accent` in both themes; tooltip bubble inverts; same component CSS (T:100-150) | Base overrides exist (CC:193-222), no switch; forced dark breaks the ink card, session rows, tiles (`PointageWidget.js:107,122`, CA:88,141,146) | Complete, OS preference plus switch (`theme-init.js`, `index.html:165`) |

### Text size setting

| Skill                                                                                                                   | Chrono                         | Locavern                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `data-text-size` standard, comfortable (x1.125), large (x1.25), automatic by width (K:78-84); TextSize control; all rem | None; px, root forced to 13 px | Implemented, stored as `locavern-text-size` (`app-shell.js:9,120-163`) |

## What it means for the plan

### 1. Chrono traits the skill already provides (keep, free)

- **Type and numerals:** IBM Plex Sans and Mono, 13 px body, semibold headings, mono tabular
  numbers (`cv-num`), and the larger display roles (`cv-text-2xl` 22 px, `cv-display-sm` 28 px) for KPI
  numerals. Chrono's hierarchy through numerals needs no new token.
- **Palette and accent:** the zinc neutrals and the single orange. Chrono's `#ea580c` is the skill's
  `--cv-brand-accent` (graphics such as the now-line and dots, never behind text); the tab underline and
  selection borders use `--cv-border-selected`.
- **Surfaces:** hairline rows inside one bordered white card with `shadow-sm` (DataTable, Card), page on
  `bg`, selected tint `bg-accent-subtle`.
- **Quiet chrome:** icon-only ghost buttons with `aria-label`, Tooltip, Menu for the rest, `Kbd` keycaps
  for the shortcuts panel.
- **Components Chrono hand-builds:** Badge with dot, SegmentedControl (the modal's pill tabs),
  EmptyState, Skeleton, native `<dialog>` Modal and Drawer, themed Toast, Pagination.
- **Status text and chips:** the status pairs Chrono already got right map one to one onto
  `cv-<status>-surface` / `-border` / `fg-<status>`.

### 2. Chrono traits that conflict with the skill

For each: follow the skill (A) or propose a deliberate skill extension (B). The skill says never to
invent, so B means a documented addition to `packages/covenant`, reviewed like the rest.

| #   | Chrono trait                                                                                       | A. Follow the skill                                                                                                    | B. Extension                                                                                                      | Recommendation and WCAG consequence                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 120 ms hover fades (CA:76-162) and press `scale(0.97)` (`UI:25-27`)                                | Instant hover and press; no transform                                                                                  | Colour-only fade of `background-color` and `border-color` at `--cv-duration-fast`; no scale                       | **A.** Visible cost is small; the skill gives a reason for no scale (movement reads as latency). No WCAG difference (2.3.3 is AAA); B must keep the reduced-motion rule.                                                                                                                                                                         |
| 2   | Text at 9, 10, 11 px (CC:99-100, CA:42-54, `Timeline.js:337,340,363`)                              | 12 px floor                                                                                                            | none sensible                                                                                                     | **A, no choice.** Not a WCAG criterion, but it fails the skill's floor and 1.4.4 headroom. Timeline blocks, overlines and counters need layout work.                                                                                                                                                                                             |
| 3   | 16 project hues for stripe, dot, timeline blocks, chart (`Projets.js:7-10`, `Timeline.js:324,400`) | One accent; project shown by name only (the page becomes monochrome)                                                   | `--cv-cat-1..16` tokens with light and dark values and a computed on-colour each, always next to the project name | **B**: it is Chrono's strongest trait. Constraints: markers that carry meaning alone need 3:1 on every surface (today 2 of 16 fail in light, 3 in dark); white text on blocks fails 4.5:1 for 8 of 16 hues, so each hue needs a computed on-colour; avoid hues that read as status (green, yellow, red) or accept that the word carries it.      |
| 4   | Near-black "ink" card for running timers, `--cv-fg` as background (`PointageWidget.js:100-110`)    | `cv-surface-inverse` with `cv-fg-inverse`: `#18181b` in light (Chrono's own value), `#f5f6f8` in dark, 17.72 / 18.20:1 | One more token, `--cv-fg-inverse-muted`, for captions                                                             | **A, now with a named role.** The card becomes `background: var(--cv-surface-inverse)` instead of `--cv-fg`, and the dark flip is the skill's design. Still missing: a muted caption on it (`fg-muted` is 2.29 / 1.57:1 and `fg-subtle` 3.21 / 2.74:1 there). Do not copy Chrono's `rgba(255,255,255,.6)` captions (1.05:1 in dark). Question D. |
| 5   | Accent fill `#ea580c` with a white label (CA:99), 3.56:1                                           | `accent-fill` `#cb4a00`, white 4.65:1 in both themes; `accent-500` stays for graphics as `brand-accent`                | None left: the skill took the thin-margin option                                                                  | **A, decided by the skill.** `#cb4a00` is the most vivid orange that keeps white at AA, and it is closer to Chrono's `#ea580c` (hue 21.9° against 20.5°) than the old `#c2410c` was. Chrono's label goes from 3.56 to 4.65:1; the focus ring from `accent-500` (3.56:1) to `border-focus` (5.18:1 light).                                        |
| 6   | Control border `neutral-300`, 1.48:1 (CA:118)                                                      | `border-control` `#71717a` (4.83:1), heavier outlines                                                                  | Lighter 3:1 token (`#8b8b94`, 3.38:1; dark `#6e7584`, 3.52:1)                                                     | **A.** A is the skill's explicit contract (1.4.11). B is AA too but moves Locavern's look, which then needs re-testing on three surfaces (3.07 on surface-2).                                                                                                                                                                                    |
| 7   | Infinite pulses on live indicators (`PointageWidget.js:50,116`, `Timeline.js:342,572`)             | Static indicator plus the word ("en cours")                                                                            | Pulse allowed for live state, one iteration under reduced motion, and a way to pause                              | **A.** F bans loops. B needs 2.2.2 handling (a pause control for anything that moves over 5 s).                                                                                                                                                                                                                                                  |
| 8   | Card radius 12, panel 10 (CA:61,64)                                                                | Cards 8; 12 stays on modal, drawer, command menu                                                                       | Allow 12 on cards                                                                                                 | **A.** Cosmetic. Never mix radii on adjacent surfaces is a skill rule, so B would change inputs inside cards too.                                                                                                                                                                                                                                |
| 9   | Sidebar 264 px with the presence widget and timers (`App.js:107`)                                  | 14.5rem; the widget moves to the page header or the top bar                                                            | Per-app `--cv-sidebar-w`                                                                                          | **A**, see question F. The skill calls the width fixed. No WCAG difference; B costs reflow work at 400 % zoom.                                                                                                                                                                                                                                   |
| 10  | Icons in `fill` weight (`PointageWidget.js`)                                                       | Regular, bold for emphasis                                                                                             | Add fill for the active state of one control per view                                                             | **A.** Use bold for the play and pause emphasis.                                                                                                                                                                                                                                                                                                 |
| 11  | Ink square brand, custom scrollbars (`App.js:113-122`, CA:19-21)                                   | Skill logo SVG (`cv-logo` follows the theme); native scrollbars                                                        | Add to the base styles                                                                                            | **A.** Neither is in the skill, neither carries meaning. Custom scrollbars can hurt usability (1.4.11 for the thumb).                                                                                                                                                                                                                            |
| 12  | Page title 20 px in content, no top bar (CA:46)                                                    | Title in the sticky top bar `h1`; KPI numerals carry the focal point                                                   | `cv-h1` in content, top bar keeps tools                                                                           | **A**, see question G.                                                                                                                                                                                                                                                                                                                           |
| 13  | Single-key shortcuts Space, N, S (`App.js:207-231`)                                                | Modifier shortcuts only (checklist 2.1.4)                                                                              | Keep them with a preference that turns them off                                                                   | See question H. WCAG 2.1.4 is met by either "off switch" or "only on focus".                                                                                                                                                                                                                                                                     |

### 3. What Locavern and Chrono must change to conform

Ordered by effort, smallest first. This becomes the port and alignment work.

#### What Locavern must take from the new skill

Locavern's vendored `covenant-tokens.css` and `covenant.css` were identical to the previous skill (the CSS
without its Google Fonts `@import`); `covenant.js` was identical but for its own toast fix. They are now
behind `185c9b1` by 41, 50 and 39 changed lines. This all goes into `packages/covenant` (roadmap step 3),
not into Locavern's `vendor/` folder.

| File                  | What changes                                                                                                                                                                                                                                                                                                                                                                                                                   | Visible in Locavern                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `covenant-tokens.css` | New primitives `--cv-accent-550`, `--cv-danger-800`, `--cv-danger-900`. Changed: `accent-fill` (550 in both themes), `accent-fill-hover` (600), `accent-fill-pressed` (700), `fg-on-accent` (white in dark), `danger-fill` (700), `danger-fill-hover` (800), dark `fg-subtle` (`#9096a6`). New roles: `surface-inverse`, `danger-fill-pressed`, `border-danger`, `border-selected`, `brand-accent`, `brand-tint`, `brand-deep` | 38 primary buttons become `#cb4a00` with a white label in both themes (dark was light orange with a dark label); 11 danger buttons are darker |
| `covenant.css`        | `.cv-logo`; danger pressed; invalid border via `border-danger`; checked segment fill and ring; `cv-pop-in` 120 ms on `.cv-menu` and `.cv-listbox`; badge dots in `currentColor`; tooltip on `surface-inverse`, avatar on `surface-3`; drawer `max-width: 100vw`; sticky top bar; tab underline `border-selected`; `code` and `kbd` 12 px floor; command list `20rem`; reduced motion zeroes the duration tokens                | 7 segmented controls, 9 menus, 4 listboxes, 5 badge dots, 13 drawer references, the top bar, `aria-invalid` fields (backup modal)             |
| `covenant.js`         | The skill's toast pause and resume replaces Locavern's: same behaviour (hover, focus, remaining time), and it also sets `data-cv-wired` on every toast. Nothing local is left to keep                                                                                                                                                                                                                                          | None expected                                                                                                                                 |
| `logos/`              | Identical. `cv-logo` is new but unused (Locavern inlines the mark in `index.html:38`)                                                                                                                                                                                                                                                                                                                                          | None                                                                                                                                          |
| Fonts and icons       | No change: `@fontsource/ibm-plex-*` `^5.3.0` (the skill ships 5.3.0) and `@phosphor-icons/web` 2.1.2 (same). The skill's `assets/fonts` and `assets/phosphor` stay the reference copy                                                                                                                                                                                                                                          | None                                                                                                                                          |

Locavern's own code that the new rules touch (not changed here; 28 primitive references in `app.css`, one
in `index.html`):

1. **Tooltip** (LA:2098-2099): `neutral-900` and `neutral-0` become `surface-inverse` and `fg-inverse`.
   Today the bubble is dark on the dark page, the 1.01:1 pair the skill fixed in its own tooltip.
2. **Pressed toolbar buttons** (LA:508, 751): `--cv-fg` as a fill becomes `--cv-surface-inverse` (same
   value, now named). Optional.
3. **Selection borders and stripes** (LA:260, 465, 1842, 1854): `accent-500` becomes `--cv-border-selected`
   (`accent-600` in light, `accent-400` in dark: 5.18 / 7.20:1 against 3.56 / 4.58:1 on `surface`).
4. **Sidebar mark** (`index.html:38`): `var(--cv-accent-500)` becomes `var(--cv-brand-accent)`, or the
   `cv-logo` lockup.
5. **Whiteboard artwork** (LA:682-683, 706-715, 1004-1028; twelve references): `accent-500` strokes can use
   `brand-accent`; the `accent-800`, `success-700`, `warning-600` and `danger-700` fills have no semantic
   role. They need a decision when porting (app-level `--lc-wb-*` tokens built from semantic ones).
6. **Status borders and stripes** (LA:1243, 1251, 1315, 1370, 1437, 1441, 1502, 1506, 1510, 2166; ten
   references): `--cv-<status>-border` is the nearest role; check it reaches 3:1 where the stripe carries
   meaning.

Things to recheck in Locavern after taking the files, none run here: the sticky top bar against the
maximised whiteboard (`LA:1037-1040` offsets it by `--cv-topbar-h`; `app.css` sets no `z-index`, so the bar's
`z-index: 100` collides with nothing there), the drawer width at 320 px, and axe in both themes.

**Locavern** (the design system is already the skill, one version behind):

0. Take the new skill files through `packages/covenant` (table above) and apply the six code changes
   above. Hours to a day.
1. Reset the 8 px `body` margin and fix the missing `cv-heading-2` class (`today-view.js:89`). Hours.
2. Wrap the table selects in `.cv-select`; make `cv-btn` default size 32 px where `sm` is used
   for the page's main action. Hours.
3. Replace the topbar-plus-`h2` duplicate heading by the single topbar `h1` the skill defines. Hours.
4. Cut chips to exceptions; neutral metadata as muted text (`lc-` row styles, LA:1659-1665). A day.
5. Row actions: icon ghost buttons plus `cv-menu` for archive and delete instead of four or seven text
   buttons (`task-list-view.js:622-654`, `project-view.js:101-125`). A day or two.
6. Flatten the nested cards on Today and Kanban (hairline rows in one card). A day.
7. Re-run axe and the checklist after 0 to 6; Locavern was not re-audited here.
8. Adopt whatever project-colour extension is accepted (question C) with a data field, a migration and
   a test that loads the previous format. Later roadmap item.

**Chrono** (port items; the skill removes most of the old failures 1 to 17 by construction):

1. Delete the hover transitions, press scale, pulses, custom scrollbars, ink square brand. Hours.
2. Remove `--cv-text-2xs` and `--cv-text-3xs`, move everything to the 12 px floor; fix the `fill` icons. A day.
3. Replace the 53 literals and 103 primitive references by roles; apply `accent-fill`, `fg-on-accent`, `brand-accent`, `border-selected`, `surface-inverse`,
   `border-control`, `cv-<status>-surface`. Two to three days.
4. Replace hand-built primitives by Covenant ones: native `<dialog>`, `.cv-select`, `.cv-check`,
   `.cv-badge`, `.cv-btn`, `cv-table`, themed Toast, EmptyState. Three to five days.
5. Convert px to rem and drop the 13 px root; adopt `data-text-size` and the TextSize control. A day
   once step 4 is done.
6. Responsive shell: grid, top bar, off-canvas drawer, skip link, landmarks; the presence widget and
   timers leave the sidebar (question F). Three to five days; the largest layout change.
7. Dark mode switch and a real dark pass over the timeline, session rows, tiles. Two days after 3.
8. Shortcuts (question H), the ink card (question D), the project colour system (question C),
   timeline blocks with computed on-colours. Depends on the answers; the timeline is the heaviest.
9. Chrono's UI text and app docs are still French: translate in the roadmap step that already
   covers it, not here.

### 4. The 11 questions of the previous comparison

| #   | Old question                       | Now                                                                                                                                                                                                                                                            |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Accent fill `accent-550` or `600`  | **Answered**: `accent-550` `#cb4a00` fill with white in both themes (4.65:1); `accent-500` is `--cv-brand-accent`, graphics only (S:63, F:88-93). The optional question A is closed.                                                                           |
| 2   | Card radius 12 or 8                | **Answered**: 8 on cards, 12 on modal, drawer, command menu (F:148-153).                                                                                                                                                                                       |
| 3   | Project colour in Covenant or app  | **Open**, now question C: the skill has no categorical palette.                                                                                                                                                                                                |
| 4   | Icon-only or text row actions      | **Answered in part**: ghost icon buttons with `aria-label`, Tooltip and Menu are components; "skip icons next to self-explanatory text" is the only rule. The app-level guideline (three or more repeated actions) stays a recommendation, no question needed. |
| 5   | Page title in content or top bar   | **Answered**: top bar `h1` (TopBar.md). Question G keeps the option of a content title.                                                                                                                                                                        |
| 6   | Sidebar 232 or 264 px              | **Answered**: 14.5rem. How the presence widget fits is question F.                                                                                                                                                                                             |
| 7   | Control border lighter or skill's  | **Answered**: `border-control` `#71717a` / `#7d8494` (T:56,110). The lighter value is not adopted (conflict 6).                                                                                                                                                |
| 8   | Inverse "ink" card                 | **Answered in part**: `--cv-surface-inverse` exists (Chrono's ink in light, a light card in dark); there is no muted caption role on it. Question D.                                                                                                           |
| 9   | Hover and focus transitions        | **Answered**: none (F:173-178); an extension is question B.                                                                                                                                                                                                    |
| 10  | Text below 12 px                   | **Answered**: floor 12 px (S:69).                                                                                                                                                                                                                              |
| 11  | Source of truth, skill or `--cv-*` | **Answered**: the skill is normative and now matches the `--cv-*` implementation; the old premise (blue primary, 14 px, Lucide) no longer applies. Phosphor and bundled fonts are confirmed.                                                                   |

## Decisions (2026-11-19)

The maintainer answered the six open questions below. They are binding for `packages/covenant` and the
Chrono port.

| Question                           | Decision                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B. Hover and press                 | **Instant**, no fade and no press scale, as the skill says.                                                                                                                                                                                                                                            |
| C. Project colour                  | **Add to Covenant** as an extension. A prompt for Claude Design proposes categorical tokens (a marker value per theme and a fill value for white labels) for the 16 Chrono hues. **Delivered in `ce6ed32` and verified**, see [the verification](#verification-of-the-category-colour-export-ce6ed32). |
| D. Running-timers card             | `--cv-surface-inverse` with `--cv-fg-inverse`, plus a **new `--cv-fg-inverse-muted`** role (4.5:1 or more in both themes) for captions. Requested from Claude Design with C. **Delivered in `ce6ed32` and verified** (6.91 and 5.16:1).                                                                |
| F. Live timers and presence widget | **Page header of the Timeline view**, in the top bar on narrow screens.                                                                                                                                                                                                                                |
| G. Page title                      | **The skill's top bar `h1`.**                                                                                                                                                                                                                                                                          |
| H. Single-key shortcuts            | **Kept, behind a "Single-key shortcuts" preference** that turns them off. They never fire while focus is in a text field.                                                                                                                                                                              |

## Remaining open questions

The skill update closed two of the eight questions (A and E) and narrowed a third (D). Six stay open
(B, C, D, F, G, H). Each is either/or, with a recommendation. Only C changes what the apps look like in a
way you will notice; the others have a clear default. Letters are kept from the previous version.

**Closed by the skill update**

- **A. Accent fill.** The skill chose `#cb4a00` in both themes with a white label (4.65:1; hover `#c2410c`,
  pressed `#9a3412`). It is closer to Chrono's `#ea580c` than `#c2410c` was (hue 21.9° against 20.5°), so
  the port changes the look less. The optional alternative I had listed (`#d0490c`, 4.53:1) is moot.
  Nothing to decide unless you want another orange; `accent-500` stays as `brand-accent` for graphics.
- **E. Skill defects.** The invalid border, the focus ring on the checked segment, the toast pause and
  resume, the radius rule and the menu motion are all fixed in `185c9b1` (see
  [Item by item](#item-by-item-verdict)). What is left to send back is small: the `4.10` figure
  (`4.03`; `CHANGELOG.md` and `tokens.json:394`), the stale first CHANGELOG entry on danger pressed, and
  the optional observations under "What the CHANGELOG does not say". `CLAUDE.md` allows a small local
  fix noted in the commit if you want the two figures corrected here before they are merged back.

**Still open**

**B. Instant hover and press (skill), or a 120 ms colour fade as an extension?**
Recommendation: **instant, no press scale.** If you want the fade after seeing the port, add it as one
documented rule on buttons, nav items, rows and inputs (colours only).

**C. Project colour: ship `--cv-cat-1..16` in `packages/covenant`, or drop it (names only)?**
Recommendation: **ship it**, as an extension reviewed like any component: light and dark values, a
computed on-colour per hue, 3:1 against each surface when it marks without a label, and never the
only carrier of meaning. Starting points from the previous run: `#ca8a04` to `#c28504`, `#65a30d` to
`#64a10d`; dark `#4f46e5` to `#6961e9`, `#7c3aed` to `#8a4fef`, `#475569` to `#61748f`; `#0284c7` has no
passing label colour and needs a darker light variant. Without this, Chrono loses its most distinctive
trait and Locavern stays monochrome.

**D. Running-timers card: `cv-surface-inverse` with `cv-fg-inverse`, or add a muted caption role on it?**
The skill now has `--cv-surface-inverse` (`#18181b` in light, Chrono's own ink; `#f5f6f8` in dark, where
Chrono's `--cv-fg` already flips the card). The only text role on it is `--cv-fg-inverse` (17.72 / 18.20:1);
`fg-muted` (2.29 / 1.57:1) and `fg-subtle` (3.21 / 2.74:1) fail there, so captions have no role.
Recommendation: **use `surface-inverse` and `fg-inverse` and carry the hierarchy with size and weight.** Add
`--cv-fg-inverse-muted` (4.5:1 in both themes) only if the captions are needed. The dark flip is now the
skill's design, not an omission.

**F. Where do Chrono's live timers and presence widget go once the sidebar is 14.5rem?**
Either the page header of the Timeline view (and the top bar on narrow screens), or a Drawer opened from
the top bar. Recommendation: **page header of the Timeline view**, because the timers are the screen's
subject and a sidebar of 232 px cannot hold two running timers legibly.

**G. Page title: top bar `h1` (skill), or content `h1` at 22 px with a non-heading top bar title?**
Recommendation: **the skill's top bar `h1`**; Chrono's focal point comes from the KPI numerals (`cv-num` at
`--cv-text-2xl`), which need no extension.

**H. Single-key shortcuts in Chrono (Space, N, S): modifier only, or keep them with a preference to turn them off?**
Recommendation: **keep them behind a preference "Single-key shortcuts", on by default only where the
page has focus on nothing else.** WCAG 2.1.4 accepts either; a modifier-only Space for start and stop
would be a regression for the app's main action.

Not a question, already decided by the roadmap and decision 0003: fonts are bundled, not loaded from
the Google Fonts CDN.

### Port status

Decisions B, C, D, F, G and H are applied in Chrono (step 3 of the port):

- **B** (instant hover and press): no transition on buttons, rows and inputs in `apps/chrono/src/styles/app.css`; motion only
  on overlays and toasts, from Covenant.
- **C** (project colour): a category 1 to 16 per project, or a free colour kept through `Covenant.setCategory`
  (schema version 3, `core/migrations.js` and `core/categories.js`); drawn with the `cv-cat-*` recipes in the Timeline,
  Projets, Rapport, Todos and quick add views.
- **D** (running-timers card): `--cv-surface-inverse` with `--cv-fg-inverse` and `--cv-fg-inverse-muted`
  (`.ch-ink` in `app.css`, `AttendanceWidget.js`).
- **F** (live timers and presence): page header of the Timeline (`AttendanceWidget.js`); a compact summary in the
  top bar on the other views and on the Timeline below 1024 px (`.ch-topstatus`).
- **G** (page title): the top bar `h1`, set by `App.js` on each view.
- **H** (single-key shortcuts): kept behind a "Single-key shortcuts" preference, off in text fields (`Preferences.js`,
  `adapters/preferences.js`).

## What could not be checked

- Everything under [Not verified](#not-verified) above (screen readers, text spacing, real browser
  zoom, tooltip hover and Escape, combobox typing).
- Locavern and Chrono were not run with the new skill files; Locavern was not re-audited against the
  skill's checklist. Its vendored files were diffed against the old and the new skill, and its app CSS,
  JS and HTML searched for primitive tokens (28 plus one), `cv-*` class counts and `z-index` (none).
- Chrono's dark mode is still not reachable in the product; earlier dark renders force `data-theme="dark"`.
  Chrono screens and Locavern views not captured last time are still not captured.
- Hover and press states of the apps were read from the CSS, not photographed.
- Single-key shortcuts were found by reading `App.js`; Locavern's whiteboard shortcuts use a modifier
  (`whiteboard-canvas.js:2576-2590`); no other app keyboard handler was audited.
- The design system's published preview pages and the "cover" artwork behind `brand-tint` and
  `brand-deep` are not in the skill and were not checked.
