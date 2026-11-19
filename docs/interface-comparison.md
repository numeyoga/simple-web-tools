# Interface comparison: the Covenant skill, Chrono and Locavern

> **Proposal — awaiting the maintainer's decision.**
> Roadmap step 4, first item, redone against the updated `covenant-design-system` skill.
> Nothing here is applied: no app code, CSS, package or skill was changed, and the roadmap item
> is not ticked. Every recommendation is for the maintainer to accept, change or reject.
> This replaces the comparison of 2026-11-18, which was written against the old French skill.

Date: 2026-11-19. The skill (`.claude/skills/covenant-design-system/`) is now the normative
target for `packages/covenant`. Chrono's interface stays the visual reference.

## Summary

1. **The skill's WCAG 2.2 AA claim holds for what it documents.** axe-core (wcag2a, wcag2aa,
   wcag21aa, wcag22aa) reported **0 violations in 28 runs** (its page template and a gallery of 32
   components, light and dark, 1440 and 320 px, plus every overlay open). No horizontal scroll at
   320 px. Of 206 computed contrast pairs, every pair the skill documents passes. Computing
   the rest found **two real sub-3:1 states in dark mode** and one behaviour bug (below).
2. **Locavern already is the skill.** Its vendored `covenant-tokens.css` is byte-identical to the
   skill's, and `covenant.css` differs only by the removed Google Fonts `@import`.
   Locavern's gap is app code (chips, actions, nesting, headings), not the design system.
3. **Chrono is far from the skill, and the distance is where its charm comes from.** Its neutral and
   accent scales match the skill's, but it uses them differently. Thirteen Chrono traits conflict
   with the skill; the ones that matter are hover motion and press scale, sub-12 px text, project
   colours, the ink card, looping pulses and the brightest orange fill. I recommend following the
   skill for eleven, extending it for one (project colour) and leaving shortcuts to question H.
4. **Eight of the 11 old questions are answered** by the skill, one in part (4) and two stay open
   (3 and 8). Eight decisions remain (section
   [Remaining open questions](#remaining-open-questions)); the one that changes how the apps look
   is **project colour** (question C): the skill has no categorical palette.
5. **Skill defects to fix once, in `packages/covenant`** (three, listed in
   [Skill against itself](#the-skill-against-itself)): dark invalid border 2.59:1, dark focus ring
   on a selected segment 2.09:1, toast timer that never resumes after hover.

## How this was done

- Read: `CLAUDE.md`, roadmap steps 3 and 4, the previous comparison, the whole skill
  (SKILL.md including "In this repository", foundations, checklist, the component pages the apps'
  screens need, tokens, CSS, JS, template), Chrono `public/assets/*.css` and `public/js/*.js`, Locavern
  `public/vendor/covenant/*`, `src/styles/app.css`, `src/adapters/dom/*`.
- Contrast: a Node script resolves the `var()` chains of `covenant-tokens.css` and applies the WCAG
  relative-luminance formula, compositing translucent colours over the real surface (206 pairs,
  both themes). Scripts and results stay in the session scratchpad, not in the repository.
- Browser: Chromium through Playwright. The skill's directory was served statically; the page
  template and a scratch gallery (Anatomy markup copied from each component page) were tested
  with axe, keyboard tabbing, 320 px reflow, `data-text-size="large"` at 1280 px, 2560 px
  (body 16.25 px, rows 40 px) and every dialog, the menu, toasts and tooltips open.
- The previous screenshots of the two apps were reused; skill screenshots were added.
  None is committed.
- Abbreviations. Skill: **S** `SKILL.md`, **F** `references/foundations.md`, **K**
  `assets/covenant.css`, **T** `assets/covenant-tokens.css`, **J** `assets/covenant.js`.
  Chrono: **CC** `apps/chrono/public/assets/covenant.css`, **CA** `…/app.css`, **UI**
  `…/js/ui.js`, other `js/*.js` by name. Locavern: **LT** and **LC**
  `apps/locavern/public/vendor/covenant/covenant-tokens.css` and `covenant.css`, **LA**
  `apps/locavern/src/styles/app.css`.

## WCAG 2.2 AA verification of the skill

### Verdict

The claim holds for the documented pairings, the page template and every component tested, with
the exceptions below. They are small, all in dark mode or in a rarely used state, and each has
a one-line fix.

### axe-core

| Scope                                                                                      | Runs | Violations |
| ------------------------------------------------------------------------------------------ | ---- | ---------- |
| `templates/page.html`: light and dark, 1440x900 and 320x800                                | 4    | 0          |
| Gallery (32 components): same four combinations                                            | 4    | 0          |
| Gallery with Modal, Drawer, CommandMenu, Menu open, then four toasts plus tooltips visible | 20   | 0          |

axe "incomplete" results, checked by hand: the `⌘` keycap (non-BMP glyph, axe cannot read it;
`fg-muted` on `surface` is 7.73:1) and four elements of the narrow modal that axe called overlapped
(`elementFromPoint` returns the element itself, and the pairs are the documented ones).
Inline links 17 to 20 px high are exempt from 2.5.8 (inline in a sentence); every other
interactive element is 24 px or more.

### Keyboard, reflow, text size

- Tab order on the template: skip link, sidebar items, search (desktop); skip link, menu button,
  search (320 px). Every stop shows a 2 px outline, `#c2410c` light and `#fb923c` dark, 2 px
  offset, inside the viewport.
- 320 px: `scrollWidth` 320 in both themes, page and gallery. At 320 px with `data-text-size="large"`,
  nothing but data tables overflows. At 1280 px with `large`: no horizontal scroll.
- Off-canvas nav: opens, focus moves to its first link, Escape closes it and returns focus to the
  menu button. Dialogs opened from their buttons close on Escape and return focus to the opener.
- 2560x1440: body 16.25 px, nav items 40 px, sidebar 290 px: as stated by F:104.

### Computed contrast (ratios, WCAG formula)

Light / dark. "Needs" is 4.5 for text, 3 for components and focus.

| Pairing                                                              | Light                      | Dark                      | Result                                        |
| -------------------------------------------------------------------- | -------------------------- | ------------------------- | --------------------------------------------- |
| `fg` on bg / surface / surface-2                                     | 16.97 / 17.72 / 16.12      | 16.58 / 15.08 / 13.29     | pass                                          |
| `fg-muted` on bg / surface / surface-2                               | 7.41 / 7.73 / 7.03         | 10.57 / 9.61 / 8.47       | pass                                          |
| `fg-subtle` on bg / surface / surface-2                              | 5.28 / 5.52 / 5.02         | 5.62 / 5.11 / **4.50**    | pass; dark surface-2 has 0.0009 margin        |
| `fg-subtle` on surface-3                                             | 4.35                       | 3.74                      | fail, but not used (pressed state)            |
| `fg-accent` (link) on bg / surface / surface-2                       | 4.96 / 5.18 / 4.71         | 7.92 / 7.20 / 6.35        | pass                                          |
| `fg-success`, `-warning`, `-danger`, `-info` on surface              | 7.13 / 8.67 / 8.02 / 14.63 | 8.67 / 9.99 / 6.46 / 7.95 | pass                                          |
| `fg-<status>` on its status surface (badge, alert)                   | 6.81 to 13.35              | 6.89 to 9.64              | pass (skill says 6.8 or more: true)           |
| `fg-accent` on accent tint (accent badge, tab count)                 | 4.88                       | 6.33                      | pass                                          |
| `fg-on-accent` on accent-fill / hover / pressed                      | 5.18 / 7.31 / 9.37         | 8.70 / 11.67 / 14.54      | pass (skill: 5.18 and 8.7: true)              |
| `fg-on-danger` on danger-fill / hover                                | 6.29 / 8.02                | 6.29 / 8.02               | pass                                          |
| Segmented selected, `fg-inverse` on `fg`                             | 17.72                      | 18.20                     | pass                                          |
| Placeholder (`fg-subtle`) on surface                                 | 5.52                       | 5.11                      | pass                                          |
| Tooltip `neutral-0` on `neutral-900`                                 | 17.72                      | 17.72                     | pass (skill: 17.7)                            |
| `fg-disabled` on surface                                             | 2.56                       | 2.66                      | exempt (1.4.3); buttons use opacity 0.5       |
| `border-control` on bg / surface / surface-2                         | 4.63 / 4.83 / 4.40         | 4.78 / 4.35 / 3.83        | pass                                          |
| Focus ring `border-focus` on bg / surface / surface-2 / surface-3    | 4.96 / 5.18 / 4.71 / 4.08  | 7.92 / 7.20 / 6.35 / 5.27 | pass (skill: 4:1 or more: true)               |
| Checked box, switch on, current page: `accent-fill` on surface       | 5.18                       | 7.20                      | pass                                          |
| Check mark `fg-on-accent` on `accent-fill`                           | 5.18                       | 8.70                      | pass                                          |
| Tab underline `accent-500` on surface / bg                           | 3.56 / 3.41                | 4.58 / 5.04               | pass (thin in light)                          |
| Status icons on `surface-raised` (toast)                             | 7.13 to 14.63              | 5.69 to 8.81              | pass                                          |
| Default button border `border-strong` on surface                     | 1.48                       | 2.04                      | not required: the label identifies the button |
| **Invalid input border `danger-600` on surface** (K:205)             | 6.29                       | **2.59**                  | **fail 1.4.11 in dark**                       |
| **Focus ring on a selected segment** (`border-focus` on `fg`, K:306) | 3.42                       | **2.09**                  | **fail 2.4.7 / 1.4.11 in dark**               |

The failures, precisely:

1. **Invalid control boundary in dark.** `.cv-input[aria-invalid="true"]` sets
   `border-color: var(--cv-danger-600)` (K:205). `danger-600` is a primitive that does not
   change with the theme: `#be123c` on dark `surface` `#1d2027` is **2.59:1** (2.29:1 on
   surface-2). The boundary identifies the control, so it needs 3:1 (1.4.11). The error
   text and icon are fine (6.46:1), so the user is not left without information, but the box
   itself fails. Fix: `var(--cv-fg-danger)` (8.02 light, 6.46 dark), which K:206 already uses for the
   focused invalid state.
2. **Focus ring on the selected segment in dark.** `outline-offset: -4px` (K:306) draws the
   ring over the selected segment, whose fill is `--cv-fg`. In dark, `#fb923c` on `#f5f6f8`
   is **2.09:1**. Visible to the eye (orange on near-white, `skill-focus-segmented-dark.png`)
   but below 3:1. Fix: draw the ring in `--cv-fg-inverse` over the selected segment.
3. **Behaviour, not contrast: a hovered toast never leaves.** J:213-217 clears the timer on
   `mouseenter` and `focusin` and never restarts it, while `Toast.md` says "paused on hover or
   focus". Locavern's copy of `covenant.js` already fixes this (pause and resume); the fix must
   be merged back into the package.

Everything else the skill states about contrast was recomputed and is true.

### Not verified

- No screen reader (NVDA, VoiceOver). Not run: the text-spacing bookmarklet (1.4.12), real 200 %
  and 400 % browser zoom (320 px width and `large` text size were used instead), 2.5.7 dragging
  (no component drags), tooltip hover and Escape behaviour (1.4.13), Combobox and CommandMenu
  typing, toast timers (2.2.1).
- Phosphor was loaded from the repository's npm copy (2.1.2) because unpkg is unreachable
  from this sandbox. Fonts came from Google Fonts, as the template does.
  Glyph metrics can differ by a pixel from 2.1.1; nothing measured depends on it.
- Axe finds about a third of WCAG issues; "0 violations" is not "conformant".

## The skill against itself

Rules in S and F against what K, J and T do. Verified in the browser unless a line is cited.

| Rule                                                                   | What the CSS does                                                                                                                                                                                                                                             | Verdict                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Motion only on overlays and toasts (S:63, F:150)                       | Computed transitions and animations across the page and gallery: only toast entrance, modal and drawer entrance, and the nav drawer slide (K:674,677). No hover or press transition anywhere.                                                                 | holds                           |
| Menus and dropdowns have transitions (F:151, checklist)                | `.cv-menu` and `.cv-listbox` have none. `--cv-duration-fast` (120 ms) and `--cv-ease-emphasize` are defined and unused.                                                                                                                                       | doc says more than the CSS does |
| Text floor 12 px (S:65, F:106)                                         | Smallest computed text in page and gallery: 12 px. Every `font-size` is a `--cv-text-*` token. `code, kbd` use `0.95em` (K:98): inside a 12 px context that is 11.4 px.                                                                                       | holds, one latent gap           |
| Every size in rem; nothing sets `font-size` on `<html>` (S:65)         | `html { font-size: calc(100% * …) }` (K:83) is the scaling mechanism, so the rule means "consumers must not". Raw px remain: `--cv-target-min: max(24px, 1.5rem)` (K:60, deliberate), `max-height: 320px` on the command list (K:552), 8 px keyframe offsets. | wording imprecise, one real px  |
| Targets 24 px (S:64)                                                   | Smallest controls: 28 px (sm button, page, search), checkbox and switch hit areas 24 px. Verified.                                                                                                                                                            | holds                           |
| Sidebar 14.5rem, top bar 3rem, container 90rem                         | 232 px, 48 px, 1440 px at standard scale; 290 px sidebar at 2560 px. Verified.                                                                                                                                                                                | holds                           |
| Sticky top bar never hides focus (TopBar checklist)                    | `scroll-padding-top` is set (K:100) but `.cv-topbar` is not sticky, so the padding does nothing today. `TopBar.md` writes `48px`, the CSS uses `3rem`.                                                                                                        | harmless inconsistency          |
| Radius `full` only on badges, avatars, switches (F:133, checklist)     | Also `.cv-tab__count` (K:615), which breaks the skill's own checklist line.                                                                                                                                                                                   | inconsistent                    |
| Pressed moves two steps (F:142)                                        | Danger button: hover and pressed use the same `--cv-danger-fill-hover` (K:167, `Button.md`); no pressed token.                                                                                                                                                | inconsistent                    |
| Focus ring 2 px offset (F:143)                                         | Inputs offset 0, segmented -4 px, menu items -2 px (K:201-203,306,530). Reasonable, undocumented; the segmented one fails in dark (above).                                                                                                                    | undocumented, one failure       |
| Every colour is a `--cv-*` token (checklist)                           | True, but several are primitives that do not follow the theme: `danger-600` border (K:205, the dark failure), tooltip and avatar `neutral-*` (K:414,465), badge dots (K:340-350), tab underline `accent-500` (K:613).                                         | the source of failure 1         |
| Drawer is full width below 420 px (`Drawer.md`)                        | At 320 px the drawer is 288 px wide with a 32 px scrim strip (user-agent `dialog` max-width).                                                                                                                                                                 | doc wrong, no WCAG impact       |
| Alert roles (`Alert.md`)                                               | `role="alert"` only for errors after an action, but the danger anatomy uses `role="status"`.                                                                                                                                                                  | doc inconsistency               |
| `tokens.json` equals `covenant-tokens.css`                             | 77 colour tokens compared in both themes: 0 differences.                                                                                                                                                                                                      | holds                           |
| Setup step loads unpkg and Google Fonts (S workflow, `covenant.css:1`) | Overridden by the "In this repository" section (decision 0003). Locavern's copy already dropped the `@import`.                                                                                                                                                | known, handled                  |

## Three-way comparison

Screenshots, kept outside the repository in the session scratchpad
(`…/scratchpad/ui-compare/`): `skill-page-{light,dark}-{desktop,narrow}.png`,
`skill-page-{light,dark}-narrow-nav-open.png`, `skill-gallery-{light,dark}-{desktop,narrow}.png`
(full-page), `skill-overlay-{md-delete,dr-entry,cmd}-{light,dark}[-narrow].png`,
`skill-overlay-{menu,toasts}-{light,dark}.png`, `skill-focus-segmented-{light,dark}.png`,
`skill-formfield-invalid-{light,dark}.png`; the earlier `chrono-*` and `locavern-*` images (42)
are in the same folder.

### Tokens and colour

| Skill                                                                                                                                  | Chrono                                                                                                                                                 | Locavern                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Zinc neutrals 0 to 1000, one orange accent, four status hues; semantic roles for surfaces, text, borders, fills, status pairs (T:3-87) | Same primitive hex values (CC:19-69); roles for surfaces and text only (CC:72-92). No `accent-fill`, `fg-on-accent`, `border-control`, status surfaces | Identical to the skill (LT = T)                                                  |
| Accent fill `#c2410c` with white (5.18:1); `accent-500` for graphics only, never behind text (S:59, F:89)                              | Fill `#ea580c`, white label 3.56:1 (CA:99); accent-500 as text and fill throughout                                                                     | Skill's fill (LT:55)                                                             |
| Status colours mean status only (S:60)                                                                                                 | Used for status; also 16 categorical project hues (`Projets.js:7-10`), including green, yellow, red                                                    | Status only                                                                      |
| Raw literals forbidden (checklist)                                                                                                     | 53 hex or `rgba(` literals and about 103 primitive references in `js/*.js` and `app.css`                                                               | no hex in `app.css`; 28 primitive references, 12 of them `accent-500` (non-text) |

### Typography and numerals

| Skill                                                                                                                                                   | Chrono                                                                                                                                                            | Locavern                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| IBM Plex Sans and Mono; 13 px body; 12 px floor; every size in rem; headings 600; `cv-num` mono tabular (F:99-106, K:101)                               | Plex via Google Fonts `@import` (CC:12); 10 and 11 px tokens (CC:99-100) and 9 px literal (`App.js:39`); px everywhere; `html, body` forced to 13 px (CC:228-232) | Skill's, fonts bundled with `@fontsource` (`src/main.js:1-6`)                        |
| Page title is the top bar `h1` at `--cv-text-md` (TopBar.md, K:582); type roles up to `cv-display-lg` 48 px exist for numerals and headings (T:164-176) | 20 px page title in content (CA:46); durations and KPIs in Plex Mono 500 at 15 to 26 px (`Timeline.js:39,412`, `Rapport.js:59`)                                   | Topbar `h1` 14 px plus an `h2` with a class that does not exist (`today-view.js:89`) |
| Overline 12 px / 600 / 0.08em uppercase (T:176)                                                                                                         | 11 px, 10 px, tracking 0.06em (CA:42-44)                                                                                                                          | Skill's                                                                              |

### Density and sizing

| Skill                                                                                                      | Chrono                                                                                                                                   | Locavern                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Controls and rows 32 px (`--cv-row-md`), small 28 px, tabs 40 px, targets 24 px; padding 8 x 12; 4 px grid | Buttons 28, 32, 36; inputs 32; nav 30; icon buttons 26, 30, 36 (`UI:15,41`, `CA:71-73`); off-grid 6, 7, 10, 11, 14 px gaps (CA:32-36,72) | Skill's; many actions use `cv-btn--sm` (28 px), the skill's default is 32 |
| Cards 20 px padding (16 compact, 24 prominent); content padding 24 px, max 90rem (K:444-452,656)           | Card header 12 x 16, flush rows 10 x 16 (CA:63); page padding 24 x 32, no max width (`App.js:151`)                                       | Skill's card, plus `surface-2` sub-cards inside (LA:1659-1665)            |

### Surfaces, radius, elevation

| Skill                                                                                                                                    | Chrono                                                                                                 | Locavern                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Flat; card 1 px border, radius 8, `shadow-sm`; radius 12 only for modal, drawer, command menu; never nest cards (F:133-137,170, Card.md) | Card radius 12 (CA:61), panel 10 (off scale, CA:64); hairline rows in one card (CA:145-147)            | Radius 8 (LC:444-449); box in box: cards holding bordered sub-cards and chips |
| Modal 30rem, footer on `surface-2`; toast on `surface-raised`, themed, `shadow-xl` (K:486-501,386-394)                                   | Modal 460 px, hand-built; toast always `#09090b`, radius 10 (`UI:332,405-423`)                         | Skill's                                                                       |
| No gradients, no `backdrop-filter`; scrim is the only transparency (F:147)                                                               | None; custom 10 px scrollbars (CA:19-21, not in the skill)                                             | None                                                                          |
| No inverse surface token; `cv-fg` on `cv-fg-inverse` is the "selected" recipe (SegmentedControl.md)                                      | Near-black "ink" card for running timers, `--cv-fg` used as a background (`PointageWidget.js:100-110`) | none                                                                          |

### Icons

| Skill                                                                                                                                                              | Chrono                                                                                                                        | Locavern                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Phosphor 2.1.1, regular default, bold for emphasis only; 1rem (`--cv-icon-size`), `aria-hidden`; no icon next to self-explanatory labels (Icons.md, F:ICONOGRAPHY) | Phosphor 2.1.1 vendored; regular plus **fill** for play, timer (`PointageWidget.js`); explicit 12, 14, 15, 16 px (`UI:29,52`) | Phosphor 2.1.2 from npm; regular and bold (`src/main.js:7-8`) |

### Motion

| Skill                                                                                                                                             | Chrono                                                                                                                                                                                                                                                     | Locavern                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Only overlays and toasts move: 180 ms enter, 280 ms drawers; buttons, inputs, rows instant; no transform on press; no loop (F:150-154, checklist) | 120 ms on 10 interactive classes (CA:76,86,96,108,121,130,139,145,152,162); `scale(0.97)` on press set from JS (`UI:25-27`); infinite pulses (`PointageWidget.js:50,116`, `Timeline.js:342,572`); reduced-motion rule only shortens durations (CC:280-285) | Skill's (LC = K); no hover motion |

### Layout, shell, sidebar, top bar

| Skill                                                                                                                              | Chrono                                                                                                                                           | Locavern                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Grid shell: sidebar 14.5rem, top bar 3rem, content max 90rem; drawer below 1024 px; one column below 768 px; skip link (K:653-688) | Flex shell, sidebar 264 px hard-coded (`App.js:107`), no top bar, no `@media` besides reduced motion; fails reflow (main column 64 px at 320 px) | Skill's shell; page not framed correctly (8 px body margin, 916 px page in a 900 px viewport) |
| Sidebar: brand logo SVG, icon plus label, overline groups (SidebarNav.md); logos copied, never redrawn                             | 28 px ink square with a white icon; presence widget and timers inside the sidebar (`App.js:113-145`)                                             | Skill's                                                                                       |

### Forms and controls

| Skill                                                                                                                                                                                           | Chrono                                                                                                                                                          | Locavern                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Input boundary `border-control` (3:1 or more; `#71717a` light, `#7d8494` dark), 2 px focus outline in `border-focus`, native `<select>` in `.cv-select`, 24 px checkbox hit area with 16 px box | Boundary `neutral-300`, 1.48:1 (CA:118); focus by inline JS glow and `outline: none` (CA:119, `UI:73-77`); select has no focus indicator; custom 18 px checkbox | Skill's; some selects in the tasks table lack the `.cv-select` wrapper                                       |
| SegmentedControl on native radios; `cv-btn--ghost cv-btn--icon` with `aria-label` for icon actions; Tooltip; Menu                                                                               | Pill tabs in the add-timer modal; icon ghost buttons (`UI:39-53`)                                                                                               | Text buttons, four per row (`task-list-view.js:622-654`), seven per project card (`project-view.js:101-125`) |

### Data display

| Skill                                                                                                                                                       | Chrono                                                                                                                                                           | Locavern                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| DataTable: 32 px rows, 12 px sentence-case header, mono right-aligned numbers, focusable scroll region; Badge with dot and word; Card; EmptyState with icon | Rows are flex lists with hairlines, not tables; badges at 11 px; empty state is centred text (`.ch-vide`, CA:58); project colour stripe, dot and timeline blocks | `cv-table`, up to three or four chips per row, `cv-empty` |

### Overlays

| Skill                                                                                                                             | Chrono                                                                                       | Locavern                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Native `<dialog>` with `showModal()` (focus trap, Escape, focus return); popover Menu; Toast with live roles; Tooltip with Escape | Hand-built `div role="dialog"`, Escape only, no focus return (`UI:331-386`); toast dark-only | Skill's, plus a tooltip helper (`tooltip.js`) |

### Focus and accessibility

| Skill                                                                                                                               | Chrono                                                                                                                         | Locavern                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 2 px `border-focus` outline, keyboard only, never removed; skip link; landmarks; global shortcuts use a modifier (2.1.4, checklist) | Ring in `accent-500` (3.56:1 on white); no focus on selects; no skip link; single-key shortcuts Space, N, S (`App.js:207-231`) | Skill's; `Ctrl+K` only (`command-palette.js:213`) |

### Dark mode

| Skill                                                                                                 | Chrono                                                                                                                                          | Locavern                                                                |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `data-theme="dark"` token overrides, all roles, themed status surfaces; same component CSS (T:90-133) | Base overrides exist (CC:193-222), no switch; forced dark breaks the ink card, session rows, tiles (`PointageWidget.js:107,122`, CA:88,141,146) | Complete, OS preference plus switch (`theme-init.js`, `index.html:165`) |

### Text size setting

| Skill                                                                                                                   | Chrono                         | Locavern                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `data-text-size` standard, comfortable (x1.125), large (x1.25), automatic by width (K:77-83); TextSize control; all rem | None; px, root forced to 13 px | Implemented, stored as `locavern-text-size` (`app-shell.js:9,120-163`) |

## What it means for the plan

### 1. Chrono traits the skill already provides (keep, free)

- **Type and numerals:** IBM Plex Sans and Mono, 13 px body, semibold headings, mono tabular
  numbers (`cv-num`), and the larger display roles (`cv-text-2xl` 22 px, `cv-display-sm` 28 px) for KPI
  numerals. Chrono's hierarchy through numerals needs no new token.
- **Palette and accent:** the zinc neutrals and the single orange, used for the now-line, dots, the
  tab underline and selection borders (`accent-500` is sanctioned for "active indicators,
  selection borders").
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

| #   | Chrono trait                                                                                       | A. Follow the skill                                                                                      | B. Extension                                                                                                      | Recommendation and WCAG consequence                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 120 ms hover fades (CA:76-162) and press `scale(0.97)` (`UI:25-27`)                                | Instant hover and press; no transform                                                                    | Colour-only fade of `background-color` and `border-color` at `--cv-duration-fast`; no scale                       | **A.** Visible cost is small; the skill gives a reason for no scale (movement reads as latency). No WCAG difference (2.3.3 is AAA); B must keep the reduced-motion rule.                                                                                                                                                                    |
| 2   | Text at 9, 10, 11 px (CC:99-100, CA:42-54, `Timeline.js:337,340,363`)                              | 12 px floor                                                                                              | none sensible                                                                                                     | **A, no choice.** Not a WCAG criterion, but it fails the skill's floor and 1.4.4 headroom. Timeline blocks, overlines and counters need layout work.                                                                                                                                                                                        |
| 3   | 16 project hues for stripe, dot, timeline blocks, chart (`Projets.js:7-10`, `Timeline.js:324,400`) | One accent; project shown by name only (the page becomes monochrome)                                     | `--cv-cat-1..16` tokens with light and dark values and a computed on-colour each, always next to the project name | **B**: it is Chrono's strongest trait. Constraints: markers that carry meaning alone need 3:1 on every surface (today 2 of 16 fail in light, 3 in dark); white text on blocks fails 4.5:1 for 8 of 16 hues, so each hue needs a computed on-colour; avoid hues that read as status (green, yellow, red) or accept that the word carries it. |
| 4   | Near-black "ink" card for running timers, `--cv-fg` as background (`PointageWidget.js:100-110`)    | `cv-fg` fill with `cv-fg-inverse` text, the skill's own selected recipe; in dark it becomes a light card | Tokens `--cv-surface-inverse`, `--cv-fg-on-inverse`, `--cv-fg-on-inverse-muted`, dark in both themes              | **A for now.** It is AA in both themes (17.7 and 18.2:1) but flips in dark and has no muted caption role: `fg-subtle` on `#18181b` is only 3.21:1. Do not copy Chrono's `rgba(255,255,255,.6)` captions (1.05:1 in dark). If the flip is unwelcome, B costs three tokens.                                                                   |
| 5   | Accent fill `#ea580c` with a white label (CA:99), 3.56:1                                           | `accent-fill` `#c2410c`, white 5.18:1; `accent-500` stays for graphics                                   | `accent-550` `#d0490c`, white 4.53:1 (thin margin), or a dark label on `accent-500` (`#18181b`, 4.98:1)           | **A.** B changes the fill in both apps for a small gain; the dark theme already uses a lighter orange. Revisit after the port if buttons look dull. A fails nothing.                                                                                                                                                                        |
| 6   | Control border `neutral-300`, 1.48:1 (CA:118)                                                      | `border-control` `#71717a` (4.83:1), heavier outlines                                                    | Lighter 3:1 token (`#8b8b94`, 3.38:1; dark `#6e7584`, 3.52:1)                                                     | **A.** A is the skill's explicit contract (1.4.11). B is AA too but moves Locavern's look, which then needs re-testing on three surfaces (3.07 on surface-2).                                                                                                                                                                               |
| 7   | Infinite pulses on live indicators (`PointageWidget.js:50,116`, `Timeline.js:342,572`)             | Static indicator plus the word ("en cours")                                                              | Pulse allowed for live state, one iteration under reduced motion, and a way to pause                              | **A.** F bans loops. B needs 2.2.2 handling (a pause control for anything that moves over 5 s).                                                                                                                                                                                                                                             |
| 8   | Card radius 12, panel 10 (CA:61,64)                                                                | Cards 8; 12 stays on modal, drawer, command menu                                                         | Allow 12 on cards                                                                                                 | **A.** Cosmetic. Never mix radii on adjacent surfaces is a skill rule, so B would change inputs inside cards too.                                                                                                                                                                                                                           |
| 9   | Sidebar 264 px with the presence widget and timers (`App.js:107`)                                  | 14.5rem; the widget moves to the page header or the top bar                                              | Per-app `--cv-sidebar-w`                                                                                          | **A**, see question F. The skill calls the width fixed. No WCAG difference; B costs reflow work at 400 % zoom.                                                                                                                                                                                                                              |
| 10  | Icons in `fill` weight (`PointageWidget.js`)                                                       | Regular, bold for emphasis                                                                               | Add fill for the active state of one control per view                                                             | **A.** Use bold for the play and pause emphasis.                                                                                                                                                                                                                                                                                            |
| 11  | Ink square brand, custom scrollbars (`App.js:113-122`, CA:19-21)                                   | Skill logo SVG; native scrollbars                                                                        | Add to the base styles                                                                                            | **A.** Neither is in the skill, neither carries meaning. Custom scrollbars can hurt usability (1.4.11 for the thumb).                                                                                                                                                                                                                       |
| 12  | Page title 20 px in content, no top bar (CA:46)                                                    | Title in the top bar `h1`; KPI numerals carry the focal point                                            | `cv-h1` in content, top bar keeps tools                                                                           | **A**, see question G.                                                                                                                                                                                                                                                                                                                      |
| 13  | Single-key shortcuts Space, N, S (`App.js:207-231`)                                                | Modifier shortcuts only (checklist 2.1.4)                                                                | Keep them with a preference that turns them off                                                                   | See question H. WCAG 2.1.4 is met by either "off switch" or "only on focus".                                                                                                                                                                                                                                                                |

### 3. What Locavern and Chrono must change to conform

Ordered by effort, smallest first. This becomes the port and alignment work.

**Locavern** (the design system is already the skill; the vendored `covenant.js` has one local
improvement, the toast resume, to merge back):

1. Reset the 8 px `body` margin and fix the missing `cv-heading-2` class (`today-view.js:89`). Hours.
2. Wrap the table selects in `.cv-select`; make `cv-btn` default size 32 px where `sm` is used
   for the page's main action. Hours.
3. Replace the topbar-plus-`h2` duplicate heading by the single topbar `h1` the skill defines. Hours.
4. Cut chips to exceptions; neutral metadata as muted text (`lc-` row styles, LA:1659-1665). A day.
5. Row actions: icon ghost buttons plus `cv-menu` for archive and delete instead of four or seven text
   buttons (`task-list-view.js:622-654`, `project-view.js:101-125`). A day or two.
6. Flatten the nested cards on Today and Kanban (hairline rows in one card). A day.
7. Re-run axe and the checklist after 1 to 6; Locavern was not re-audited here.
8. Adopt whatever project-colour extension is accepted (question C) with a data field, a migration and
   a test that loads the previous format. Later roadmap item.

**Chrono** (port items; the skill removes most of the old failures 1 to 17 by construction):

1. Delete the hover transitions, press scale, pulses, custom scrollbars, ink square brand. Hours.
2. Remove `--cv-text-2xs` and `--cv-text-3xs`, move everything to the 12 px floor; fix the `fill` icons. A day.
3. Replace the 53 literals and 103 primitive references by roles; apply `accent-fill`, `fg-on-accent`,
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
| 1   | Accent fill `accent-550` or `600`  | **Answered**: `accent-600` fill, `accent-500` graphics only (S:59, F:88-90). `accent-550` would be an extension: kept as optional question A.                                                                                                                  |
| 2   | Card radius 12 or 8                | **Answered**: 8 on cards, 12 on modal, drawer, command menu (F:133-137).                                                                                                                                                                                       |
| 3   | Project colour in Covenant or app  | **Open**, now question C: the skill has no categorical palette.                                                                                                                                                                                                |
| 4   | Icon-only or text row actions      | **Answered in part**: ghost icon buttons with `aria-label`, Tooltip and Menu are components; "skip icons next to self-explanatory text" is the only rule. The app-level guideline (three or more repeated actions) stays a recommendation, no question needed. |
| 5   | Page title in content or top bar   | **Answered**: top bar `h1` (TopBar.md). Question G keeps the option of a content title.                                                                                                                                                                        |
| 6   | Sidebar 232 or 264 px              | **Answered**: 14.5rem. How the presence widget fits is question F.                                                                                                                                                                                             |
| 7   | Control border lighter or skill's  | **Answered**: `border-control` `#71717a` / `#7d8494` (T:53,100). The lighter value is not adopted (conflict 6).                                                                                                                                                |
| 8   | Inverse "ink" card                 | **Open in a smaller form**: no inverse tokens in the skill; `cv-fg` on `cv-fg-inverse` is available. Question D.                                                                                                                                               |
| 9   | Hover and focus transitions        | **Answered**: none (F:150-154); an extension is question B.                                                                                                                                                                                                    |
| 10  | Text below 12 px                   | **Answered**: floor 12 px (S:65).                                                                                                                                                                                                                              |
| 11  | Source of truth, skill or `--cv-*` | **Answered**: the skill is normative and now matches the `--cv-*` implementation; the old premise (blue primary, 14 px, Lucide) no longer applies. Phosphor and bundled fonts are confirmed.                                                                   |

## Remaining open questions

Each is either/or, with a recommendation. Only C changes what the apps look like in a way you will
notice; the others have a clear default.

**A. Keep the skill's `accent-600` fill, or add `accent-550` (`#d0490c`, 4.53:1)?**
Recommendation: **keep `accent-600`.** `accent-550` is thin and changes both apps; it is easy to add
later if the port feels dull.

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

**D. Running-timers card: use `cv-fg` / `cv-fg-inverse` now, or add inverse tokens?**
Recommendation: **use the existing roles**, without muted captions. Add `--cv-surface-inverse`,
`--cv-fg-on-inverse` and a muted variant only if the dark-mode flip (card turns light) is rejected.

**E. Fix the three skill defects in the local skill copy now, or once in `packages/covenant`?**
Recommendation: **once, in `packages/covenant`** (roadmap step 3), then copy back to the skill.
Proposed fixes: invalid border to `var(--cv-fg-danger)`; focus ring on the checked segment in
`var(--cv-fg-inverse)`; merge Locavern's toast pause and resume from its copy of `covenant.js`. Also
reconcile the radius rule with `.cv-tab__count`, and add the missing menu transition or drop the claim.
`CLAUDE.md` allows small local skill fixes noted in the commit; choose that only if you want the skill
fixed before step 3.

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

## What could not be checked

- Everything under [Not verified](#not-verified) above (screen readers, text spacing, real browser
  zoom, tooltip and combobox behaviour, toast timers).
- Locavern was not re-audited against the skill's checklist. Only its vendored files were diffed
  (identical to the skill apart from the removed `@import` and the toast fix) and its app CSS searched
  for transitions, px font sizes and hex colours (none).
- Chrono's dark mode is still not reachable in the product; earlier dark renders force `data-theme="dark"`.
  Chrono screens and Locavern views not captured last time are still not captured.
- Hover and press states of the apps were read from the CSS, not photographed.
- Single-key shortcuts were found by reading `App.js`; Locavern's whiteboard shortcuts use a modifier
  (`whiteboard-canvas.js:2576-2590`); no other app keyboard handler was audited.
