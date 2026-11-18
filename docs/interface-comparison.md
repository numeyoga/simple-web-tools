# Interface comparison: Chrono and Locavern

> **Proposal — awaiting the maintainer's decision.**
> Roadmap step 4, first item. Nothing in this document is applied: no app code, CSS or skill
> was changed, and the roadmap item is not ticked. Every "Proposed" value below is a
> recommendation for the maintainer to accept, change or reject.

Date: 2026-11-18. Scope: the visual and interaction differences between the two apps that
should be settled before the Chrono port and before `packages/covenant` is extracted
([roadmap](roadmap.md), steps 3 and 4).

## How this was done

- Read: Chrono `public/assets/covenant.css`, `app.css`, `index.html`, `public/js/*.js` (the
  markup is built in JavaScript); Locavern `public/vendor/covenant/*`, `src/styles/app.css`,
  `index.html`, `src/adapters/dom/*`; the `covenant-design-system` skill.
- Rendered with Chromium (Playwright), light and dark, desktop 1440x900 and narrow 390x844.
  Chrono was served statically from `public/`; Locavern from `npm run build` and `preview`.
  The Google Fonts CDN was reachable, so Chrono rendered the intended IBM Plex Sans and Mono
  (checked with `document.fonts`); no fallback font was involved. Locavern bundles the same
  families through `@fontsource`.
- Chrono's demo data was used as is. Locavern was seeded through its own UI with the same
  project and task names, so both apps show comparable content.
- Chrono has no way to switch to dark mode (see [Dark mode](#dark-mode)). Its dark renders
  force `data-theme="dark"` on `<html>`; they show what the current code does with the dark
  tokens, not a supported state.
- Contrast ratios are computed with the WCAG 2.x relative-luminance formula, not estimated.
  Translucent colors are composited over their actual background first.
- Screenshots are kept outside the repository (not committed).

### Reference abbreviations

| Short | File                                                             |
| ----- | ---------------------------------------------------------------- |
| CC    | `apps/chrono/public/assets/covenant.css`                         |
| CA    | `apps/chrono/public/assets/app.css`                              |
| UI    | `apps/chrono/public/js/ui.js` (primitives), other `*.js` by name |
| LT    | `apps/locavern/public/vendor/covenant/covenant-tokens.css`       |
| LC    | `apps/locavern/public/vendor/covenant/covenant.css`              |
| LA    | `apps/locavern/src/styles/app.css`                               |

## Finding that frames everything else

**The two Covenant copies have almost the same tokens.** The neutral, accent and status
scales, the surfaces, the radii, the shadows, the spacing scale, the type scale, the weights,
the line heights, the motion durations and easings and the z-index layers are the same
values. Chrono does not look better because of its tokens. It looks better because of how it
applies them (component recipes, hierarchy, color use) and because of a few things Locavern
does not do at all (project color, hover transitions, a styled page title).

Conversely, Locavern's copy is the more evolved _system_: it already fixed several
accessibility problems that Chrono's copy still has (see the
[token diff](#token-by-token-diff)). So the proposals below keep Locavern's token layer and
move Chrono's look into the component defaults, instead of picking one copy.

The skill is a third, different thing: it describes `--color-*` tokens, a blue primary, a
14px base text size, 4/6/8px radii and Lucide icons. Neither app implements it (see
[Open questions](#open-questions-for-the-maintainer), question 11).

## Summary: what makes Chrono look better

Ranked by visual impact. "Covenant" means it can be a shared default; "App" means it belongs
to Chrono's domain (time tracking) and should stay in the app.

1. **Project color is the visual identity (Covenant palette, app usage).** Every project has
   one of 16 hues. It appears as a 4px stripe on cards and sessions, a dot in lists and
   filters, the fill of timeline blocks and the segments of the weekly chart
   (`Timeline.js:324,400`, `Projets.js:7-10,234`). Locavern's pages are monochrome apart from
   the orange accent and semantic chips; its data model has no project color at all. This is
   the largest single difference in how the two screens read.
2. **Hierarchy through numerals and scale (Covenant).** Chrono sets durations and KPIs in
   IBM Plex Mono at weight 500 and 15 to 26px (`Timeline.js:39,412`, `Rapport.js:59`,
   `Projets.js:243`) under a 20px page title (`CA:46`). Locavern uses 13px almost everywhere,
   a 14px topbar title and a default-styled `h2` (the class `cv-heading-2` it uses does not
   exist, `today-view.js:89`). Chrono's screens have one clear focal point; Locavern's do not.
3. **Surfaces: one card per section, hairline rows, 12px radius (Covenant).** Chrono sections
   are a single white card (radius 12, `shadow-sm`) with a header and hairline-separated rows
   (`CA:61-64`). Locavern nests boxes: a card containing `surface-2` sub-cards, each with its
   own border, plus bordered chips (Today, Kanban columns). The nesting makes it look busier
   and flatter at once.
4. **Quiet chrome (Covenant).** Chrono rows end in three icon-only ghost buttons (play, edit,
   delete) and each card has one primary action. Metadata is muted text with a color dot.
   Locavern rows end in four outlined text buttons ("Consulter, Modifier, Archiver,
   Supprimer", `task-list-view.js:622-654`), project cards carry seven buttons
   (`project-view.js:101-125`), and each task row shows three or four bordered chips. Locavern
   controls also use a `#71717a` border everywhere (4.83:1), which reads as heavy outlines.
5. **A brighter accent and one deliberate focal element (Covenant token, app component).**
   Chrono fills with `#ea580c`; Locavern with `#c2410c`, which reads browner. Chrono also uses
   accent as state (now-line, selected-row tint) and places one near-black "ink" card (the
   running timers, `PointageWidget.js:100-110`) against the white page. The ink card is
   app-specific; the fill is not. Chrono's brighter fill does not pass contrast with a white
   label (3.56:1), so this needs a decision (question 1).
6. **Interaction feel (Covenant).** Chrono transitions background and border over 120ms on
   every interactive surface (`CA:76,86,96,108,121,139,145,152,162`), scales buttons to 0.97
   on press (`UI:25-27`), pulses live indicators and slides toasts in. Locavern has no hover
   or focus transition at all; its only transitions are the mobile nav drawer (`LC:673,676`).
7. **Polish and rhythm (Covenant, small).** Chrono has custom 10px scrollbars (`CA:19-21`),
   a wider 264px sidebar with a brand mark in an ink square (`App.js:107,113-122`), 11px
   tracked uppercase overlines and off-grid gaps of 6, 10 and 14px (`CA:32-36`) that give it
   more air. Locavern has an 8px `body` margin that nothing resets (the whole app sits in an
   8px frame and the page always overflows vertically by 16px: 916px content in a 900px
   viewport).

Things Chrono does **not** do better, and that must not travel into Covenant: it has no
responsive layout (at 390px the 264px sidebar leaves a 126px content column; at 320px the
page scrolls horizontally to 589px), no working dark mode, no focus indicator on `select`
elements, white labels on fills that fail 4.5:1, and 9 to 11px text. Details in
[Accessibility check](#accessibility-check-of-the-proposals).

## Token-by-token diff

| Area                       | Chrono (CC)                                                                               | Locavern (LT, LC)                                                                                                                                                                                                           | Verdict                                                |
| -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Neutral, accent, status    | `CC:19-69`: neutral 0-1000, accent 50-800 (500 `#ea580c`), success, warning, danger, info | `LT:3-43`                                                                                                                                                                                                                   | Identical hex values                                   |
| Surfaces, borders, text    | `CC:72-92`                                                                                | `LT:44-69`                                                                                                                                                                                                                  | Identical except the three rows below                  |
| `--cv-fg-subtle`           | `#71717a` (`CC:86`)                                                                       | `#686871` (`LT:63`)                                                                                                                                                                                                         | Locavern fixed contrast on `surface-2`                 |
| `--cv-border-focus`        | accent-500 (`CC:82`)                                                                      | accent-600 (`LT:54`)                                                                                                                                                                                                        | Locavern darker, stronger ring                         |
| `--cv-shadow-focus-danger` | `rgba(220,38,38,.28)`, not a palette color (`CC:166`)                                     | `rgba(225,29,72,.28)`, matches danger-500 (`LT:87`)                                                                                                                                                                         | Locavern consistent                                    |
| Added by Locavern          | absent                                                                                    | `--cv-border-control` (`LT:53`), `--cv-accent-fill*` (`LT:55-57`), `--cv-fg-on-accent`, `--cv-danger-fill*`, `--cv-fg-info`, status surface and border pairs (`LT:72-79`), `--cv-target-min`, `--cv-icon-size` (`LC:59-60`) | Needed for AA; Chrono has no equivalent                |
| Radii                      | 0, 2, 4, 8, 12, 16, full (`CC:149-156`)                                                   | same (`LT:150-156`)                                                                                                                                                                                                         | Identical                                              |
| Shadows                    | xs to xl, focus (`CC:158-166`)                                                            | same (`LT:80-87`)                                                                                                                                                                                                           | Identical (light)                                      |
| Spacing, row heights       | 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px; rows 28/32/40 (`CC:129-147`)           | same values in rem (`LT:136-159`)                                                                                                                                                                                           | Identical values; Chrono in px, Locavern in rem        |
| Type scale                 | 10, 11, 12, 13, 14, 16, 18, 22, 28, 36, 48 px (`CC:99-109`)                               | 12, 13, 14, 16, 18, 22, 28, 36, 48 in rem; floor is 12px (`LC:16-25`)                                                                                                                                                       | Chrono adds 10 and 11px; Locavern has the floor        |
| Root and body size         | `html, body` at 13px, so `1rem` would be 13px (`CC:228-232`)                              | `html` at 100% (16px), `body` at 13px (`LC:82-95`), scalable by screen size and `data-text-size` (`LC:76-82`)                                                                                                               | Locavern correct and user-scalable                     |
| Families                   | IBM Plex Sans and Mono via Google Fonts `@import` (`CC:12,95-96`)                         | same stack through `--font-sans`, fonts bundled with `@fontsource` (`LT:160-161`, `src/main.js:1-6`)                                                                                                                        | Same fonts; Chrono makes a third-party request         |
| Weights, leading, tracking | 400-700; 1.2/1.35/1.5/1.65; -0.01 to 0.08em (`CC:111-127`)                                | same (`LC:27-40`)                                                                                                                                                                                                           | Identical                                              |
| Focus                      | `:focus-visible` 2px accent-500, offset 2px, forces radius-xs (`CC:271-275`)              | 2px accent-600, offset 2px; inputs offset 0 plus border color (`LC:111-114,200-203`)                                                                                                                                        | Locavern stronger; Chrono overrides radius             |
| Motion                     | 0/120/180/280ms, two easings (`CC:169-174`)                                               | same (`LC:42-47`)                                                                                                                                                                                                           | Tokens identical; Chrono uses literals (`CA:76,86`…)   |
| Z-index                    | base 0, sticky 100, drawer 200, modal 300, toast 400, tooltip 500 (`CC:177-182`)          | same (`LC:49-54`)                                                                                                                                                                                                           | Identical; Chrono's listbox uses literal 50 (`UI:190`) |
| Layout tokens              | sidebar 232, topbar 48, container 1440 (`CC:185-187`)                                     | same (`LC:56-58`)                                                                                                                                                                                                           | Identical; Chrono hard-codes 264 (`App.js:107`)        |
| Breakpoints                | none (the only `@media` is `prefers-reduced-motion`)                                      | 1023 (sidebar becomes a drawer), 767 (grid and search collapse) (`LC:668,681`); 2000 and 2400 text scale (`LC:77-78`)                                                                                                       | Chrono has no responsive layout                        |
| Dark mode                  | base overrides present (`CC:193-222`), no switch, no `prefers-color-scheme`               | same base overrides plus status surfaces, fills, `border-control` (`LT:90-134`), `theme-init.js`, switch (`index.html:165`)                                                                                                 | Base values identical; Locavern complete               |

## Proposed defaults, by dimension

All rows in the last column are **proposed**. "Why" is one line.

### Density

| Aspect          | Chrono                                       | Locavern                                        | Refs                                      | Proposed Covenant default (why)                                                             |
| --------------- | -------------------------------------------- | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Body text       | 13px                                         | 13px                                            | `CC:102`, `LC:95`                         | Keep 13px (same in both; skill's 14px not in use).                                          |
| Control height  | buttons 28/32/36, input 32, nav item 30      | button 28/32, input 32, nav item 32, row 32     | `UI:15`, `CA:71-73`, `LC:139-172,556-574` | Keep Locavern's `--cv-row-*` (28/32/40): same real sizes, on tokens, 24px target minimum.   |
| Page padding    | 24px vertical, 32px horizontal, no max width | 24px, max width 1440 centered                   | `App.js:151`, `LC:655`                    | Keep 24px and the 1440 cap; add 32px horizontal from 1024px up (Chrono's calmer margins).   |
| Section gap     | 20px                                         | 16px                                            | `App.js:149`, `LA:176-181`                | 20px between sections (`--cv-space-6`), 12px inside (why: Chrono's air comes from this).    |
| Card padding    | header 12x16, rows 10x16 (flush rows)        | 20px all round (`--cv-space-6`), sub-cards 12px | `CA:63`, `LC:443-452`, `LA:1659-1665`     | Card with header 12x16 and flush hairline rows; padded body 16px (why: removes box-in-box). |
| Off-grid values | 6, 7, 10, 11, 14px gaps and paddings         | tokens only (no hex in `app.css`)               | `CA:32-36,72`                             | Snap to the scale (8 or 12). The port will change spacing by up to 2px; accept it.          |
| List row        | about 54px (two lines: title, meta)          | table row 53px (two lines because of chips)     | measured at 1440x900                      | Two-line rows with muted meta line, no chips for neutral metadata.                          |

### Typography

| Aspect            | Chrono                                                             | Locavern                                                | Refs                                                           | Proposed Covenant default (why)                                                                             |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Families          | Plex Sans, Plex Mono (CDN)                                         | Plex Sans, Plex Mono (bundled)                          | `CC:12`, `src/main.js:1-6`                                     | Bundled (already required by decision 0003 and the roadmap).                                                |
| Page title        | 20px/600/-0.01em, inside content                                   | 14px/600 in topbar plus an unstyled `h2` (about 19.5px) | `CA:46`, `LC:581`, `today-view.js:89`                          | One `h1` per page at `--cv-text-2xl` (22px), in content (why: Chrono's focal point; 20px is off the scale). |
| Section title     | 13px/600                                                           | 13px/600 (`lc-today-section__title`)                    | `CA:47`                                                        | Keep 13px/600 (same).                                                                                       |
| KPI and durations | Plex Mono 500: 15 (row), 16, 18, 20 (timer), 22 (KPI), 26 (report) | Plex Mono 400 at 12-13px for dates and counts           | `Timeline.js:39,412`, `PointageWidget.js:131`, `Rapport.js:59` | New `.cv-stat`: mono, tabular, 500; 22px for KPIs, 16px for row values (collapses six sizes to two).        |
| Overline          | 11px/500-600, tracking 0.06 to 0.08em, uppercase                   | 12px/600, 0.08em, uppercase                             | `CA:42-44`, `LT:176`                                           | Locavern's 12px/600/0.08em (floor is 12px; see question 10).                                                |
| Smallest sizes    | 9px (`App.js:39`), 10px (`CA:43,54`), 11px                         | none below 12px                                         | `CC:99-100`                                                    | Remove `--cv-text-2xs` and `--cv-text-3xs`; keep the 12px floor.                                            |
| Line height       | 1.5 on body but 1 or 1.3 on most `ch-*` classes                    | 1.5 body, 1.3 to 1.4 in controls                        | `CA:42-54`, `LC:197`                                           | Keep Locavern's (1.5 body, 1.3 controls); 1 only for single-line mono numerals.                             |
| Numerals          | no `font-variant-numeric`; mono provides alignment                 | `.cv-num` mono plus `tabular-nums`                      | `LC:100,647`                                                   | Keep `.cv-num`; `.cv-stat` builds on it.                                                                    |

### Surfaces and elevation

| Aspect             | Chrono                                                    | Locavern                                                   | Refs                                       | Proposed Covenant default (why)                                                                            |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Card               | white, 1px `border`, radius 12, `shadow-sm`               | white, 1px `border`, radius 8, `shadow-sm`                 | `CA:61`, `LC:443-449`                      | Radius 12 (`--cv-radius-lg`) for cards and panels (question 2).                                            |
| Panel              | radius 10 (off the scale)                                 | n/a                                                        | `CA:64`                                    | Use the card (12).                                                                                         |
| Nesting            | rows separated by hairlines inside one card               | card holds `surface-2` sub-cards with borders and chips    | `CA:145-147`, `LA:1659-1665`, `LA:248-257` | Hairline rows inside one card; `surface-2` only for wells (kanban column, table header).                   |
| Page background    | `neutral-50` with white cards                             | same                                                       | `CC:72`, `LT:44`                           | Keep.                                                                                                      |
| Modal              | width 460, radius 12, `shadow-lg`, footer on `neutral-50` | width 30rem, radius 12, `shadow-lg`, footer on `surface-2` | `UI:332,346,369`, `LC:485-500`             | Locavern's (themeable footer token; native `<dialog>`).                                                    |
| Toast              | always-dark (`#09090b`), radius 10, `shadow-xl`, 3.5s     | themed `surface-raised`, border, radius 8, `shadow-xl`     | `UI:405-423`, `LC:385-393`                 | Locavern's (works in dark, configurable duration); Chrono's passes contrast but cannot theme.              |
| Inverse "ink" card | near-black card, white text, accent action                | none                                                       | `PointageWidget.js:100-110`                | Tokens `--cv-surface-inverse` and `--cv-fg-on-inverse` in Covenant; the card stays in Chrono (question 8). |
| Scrollbar          | 10px, rounded thumb                                       | browser default                                            | `CA:19-21`                                 | Add to Covenant base (cosmetic; WebKit/Blink only, which is the stated target).                            |

### Color use

| Aspect                 | Chrono                                                                                   | Locavern                                                             | Refs                                      | Proposed Covenant default (why)                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Accent fill            | `#ea580c` (accent-500)                                                                   | `#c2410c` (accent-600), hover 700, pressed 800                       | `CA:99`, `LT:55-57`                       | Question 1: new `accent-550` `#d0490c` (4.53:1 with white) or keep 600.                                                       |
| Accent as state        | now-line, selected row tint (accent-50 plus accent-500 border), active option            | tab underline, drop target, accent badge                             | `Timeline.js:351-364`, `CA:141`, `LC:612` | Keep both; add a "selected" recipe: accent-50 background, accent border.                                                      |
| Categorical color      | 16-hue project palette, user chosen; used for stripe, dot, block, chart                  | none                                                                 | `Projets.js:7-10`                         | Palette tokens `--cv-cat-1..16` with light and dark variants and an on-color (question 3); never the only carrier of meaning. |
| Semantic chips         | `Badge` with dot, 11px, used sparingly (overdue, today, counts)                          | `cv-badge` plus `cv-tag` on almost every row (3 or 4 per row)        | `UI:295-317`, `LC:331-355`                | Keep both components; guideline: chips for exceptions (overdue, high priority), muted text for neutral metadata.              |
| Status surfaces        | literal `*-50`/`*-100` primitives in JS                                                  | semantic `--cv-*-surface/border` (themed)                            | `UI:297-303`, `LT:72-79`                  | Locavern's (the only version that works in dark).                                                                             |
| Raw colors in app code | 53 hex or `rgba(` literals and about 103 primitive references in `js/*.js` and `app.css` | zero hex in `app.css`; 28 primitive references (12 are `accent-500`) | grep over both trees                      | Semantic tokens only in apps, as the skill's rule says; the port must remove the literals.                                    |
| Urgency vs identity    | left stripe not used for urgency; badge "en retard" and tinted group header              | left stripe 3px means urgency (overdue, today, this week)            | `Todos.js:348`, `LA:1833-1842`            | Stripe = project color (question 3 impact); urgency stays as badge plus a tinted group header.                                |

### Icons

| Aspect       | Chrono                                                | Locavern                                      | Refs                                    | Proposed Covenant default (why)                                                                     |
| ------------ | ----------------------------------------------------- | --------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Library      | Phosphor 2.1.1, vendored (regular, fill, bold)        | Phosphor 2.1.2, npm (regular, bold)           | `index.html:10-13`, `src/main.js:7-8`   | Phosphor (both apps; the skill's Lucide is not used); one npm package, no vendored copy.            |
| Weights      | regular default; fill for play, timer, database, logo | regular default; bold only                    | `PointageWidget.js`, `App.js:35,120`    | Regular default; fill for the active or primary state of one control per view; bold for checkmarks. |
| Size         | explicit 12, 14, 15, 16 px in JS                      | `--cv-icon-size` 1rem (scales with text size) | `UI:29,52`, `LC:60`                     | `--cv-icon-size` (16px); 14px only inside `sm` controls.                                            |
| Row actions  | icon-only ghost buttons 26/30/36 px with `aria-label` | text buttons; icons only on some              | `UI:39-53`, `task-list-view.js:622-654` | Icon-only for three or more repeated actions, with accessible name and tooltip (question 4).        |
| Empty states | centered text only (`.ch-vide`)                       | `cv-empty` with icon, dashed border           | `CA:58`, `LC:428-438`                   | Locavern's.                                                                                         |

### Motion

| Aspect          | Chrono                                                             | Locavern                                               | Refs                                              | Proposed Covenant default (why)                                                                                                                                          |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hover and focus | 120ms on background, border, color for every interactive surface   | none                                                   | `CA:76,86,96,108,121,139,145,152,162`             | Default-on: `transition: background-color, border-color, color var(--cv-duration-fast) var(--cv-ease-standard)` on `.cv-btn`, `.cv-nav-item`, rows, inputs (question 9). |
| Press           | `scale(0.97)` set from JavaScript on mousedown                     | none                                                   | `UI:25-27`                                        | CSS `:active { transform: scale(0.98) }` on buttons only; no inline JS.                                                                                                  |
| Overlays        | fade 180ms, modal rise 8px and 0.98 scale 180ms, toast slide 200ms | modal rise 180ms, drawer slide 280ms, toast rise 180ms | `UI:339,349,407`, `LC:489,506,392`                | Locavern's (same curves, on tokens).                                                                                                                                     |
| Live indicators | `cv-pulse` 1.2s and 2s, infinite                                   | none                                                   | `PointageWidget.js:50,116`, `Timeline.js:342,572` | Allowed for "live" state only; the reduced-motion rule must also set `animation-iteration-count: 1`.                                                                     |
| Reduced motion  | global rule shortens durations to 0.01ms                           | same rule                                              | `CC:280-285`, `LC:116-121`                        | Add `animation-iteration-count: 1 !important` so infinite loops stop (both copies have the same gap).                                                                    |

### Layout and navigation

| Aspect         | Chrono                                                           | Locavern                                                        | Refs                                     | Proposed Covenant default (why)                                                                             |
| -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Shell          | flex: sidebar 264 fixed plus main; no topbar; no breakpoints     | grid: sidebar 232, topbar 48, main; drawer below 1024px         | `App.js:103-157`, `LC:652-687`           | Locavern's shell (reflow requirement, WCAG 1.4.10), with Chrono's proportions inside it.                    |
| Sidebar width  | 264 (holds the presence widget)                                  | 232 (`--cv-sidebar-w`)                                          | `App.js:107`, `LC:56`                    | 232 by token; an app may override (question 6).                                                             |
| Nav item       | 30px, radius 6, gap 10, 13px, active `surface-2` plus weight 500 | 32px, radius 8, gap 8, 13px, active `surface-2` plus weight 500 | `CA:71-79`, `LC:565-574`                 | Locavern's (on tokens); the recipes are otherwise the same.                                                 |
| Nav groups     | one "ESPACE" label                                               | "Données", "Préférences" groups                                 | `App.js:64-69`, `index.html`             | Keep Locavern's overline groups.                                                                            |
| Page header    | title 20px plus subtitle plus metrics or actions, inside content | topbar `h1` plus view `h2` (two headings, same text)            | `Timeline.js:659`, `index.html:149`      | Title in content (question 5); the topbar keeps global tools (search, theme, backup, mobile menu).          |
| Grids          | `auto-fill, minmax(300px, 1fr)`, fixed two-column splits         | `auto-fit/auto-fill minmax(...rem, 1fr)`, 8-column `cv-grid`    | `Projets.js:224`, `LC:665`, `LA:243,355` | Locavern's rem-based grids.                                                                                 |
| Brand          | 28px ink square with white icon, 15px name                       | 24px SVG mark, 14px name                                        | `App.js:113-122`, `LC:561-562`           | Keep Locavern's mark pattern; Chrono's ink square is a cheap, strong brand cue worth offering as an option. |
| Keyboard hints | `Kbd` footer panel, global shortcuts                             | `Ctrl+K` command menu, `cv-kbd`                                 | `App.js:131-145`, `LC:471-475,536-551`   | Locavern's command menu; Chrono's footer is app-specific.                                                   |

### Forms and controls

| Aspect       | Chrono                                                             | Locavern                                                           | Refs                               | Proposed Covenant default (why)                                                                                               |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Input border | `neutral-300` (1.48:1)                                             | `neutral-500` (4.83:1)                                             | `CA:118`, `LT:53`                  | New `--cv-border-control` `#8b8b94` light (3.38:1) and `#6e7584` dark (3.52:1): lighter than Locavern, still AA (question 7). |
| Input focus  | border accent-500 plus 3px glow, set by inline JS; `outline: none` | 2px accent-600 outline, border accent-600, no JS                   | `CA:119`, `UI:73-77`, `LC:200-203` | Locavern's CSS-only focus; add the 3px soft glow (`--cv-shadow-focus`) as a second layer for Chrono's softer look.            |
| Select       | custom caret icon, `select` has no focus style                     | custom CSS caret on `.cv-select`; some selects render native arrow | `UI:134-160`, `LC:216-224`         | `.cv-select` everywhere (the Locavern tasks table and drawer mix native and custom carets).                                   |
| Label        | 12px/500 muted above the field                                     | 12px/500 muted above the field                                     | `CA:49`, `LC:180`                  | Same; keep.                                                                                                                   |
| Checkbox     | custom 18px box, `neutral-300` border (1.48:1), bold tick          | 16px box in 24px target, `border-control`, `accent-fill`           | `Todos.js:257-258`, `LC:234-264`   | Locavern's (target size, contrast).                                                                                           |
| Buttons      | `ch-btn`: 13px/500, radius 8, hover and press feel, 28/32/36       | `cv-btn`: same size, radius 8, `sm` used for most actions          | `CA:92-103`, `LC:139-174`          | Locavern's token layer; default size 32, `sm` only in toolbars (Today's primary action is 28px today).                        |
| Segmented    | pill tabs in the add-timer modal                                   | `cv-segmented` native radios, ink fill when selected               | `QuickAdd.js`, `LC:288-305`        | Locavern's (native radios).                                                                                                   |
| Pickers      | project list with color square and check, accent-50 selected       | native `select`                                                    | `CA:135-142`                       | Offer the list picker as a Covenant `cv-listbox` recipe once project color exists.                                            |
| Dialog       | hand-built `div role="dialog"`, Escape only                        | native `<dialog>` (focus trap, backdrop, Escape)                   | `UI:331-386`, `LC:480-509`         | Native `<dialog>` (skill rule; no focus trap or focus return in Chrono's version).                                            |

### Focus and accessibility

| Aspect               | Chrono                                                                   | Locavern                                                 | Refs                             | Proposed Covenant default (why)                                                       |
| -------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Focus ring           | 2px accent-500, offset 2px                                               | 2px accent-600, offset 2px (0 on inputs)                 | `CC:271-275`, `LC:111-114`       | Locavern's; never `outline: none` without a replacement (Chrono's `select` has none). |
| Selects              | `outline: none`, no replacement: no visible focus (verified by keyboard) | visible 2px ring                                         | `CA:119`, `UI:134-160`           | Fix by adopting the Covenant select.                                                  |
| Target size          | icon buttons 26/30/36; chips 24+                                         | `--cv-target-min` 24px enforced in checkbox, row buttons | `UI:41`, `LC:59`                 | Keep the token; 28px default for icon-only controls.                                  |
| Skip link, landmarks | none                                                                     | skip link, labelled nav, `main`                          | `index.html:20,22`, `LC:657-663` | Locavern's.                                                                           |
| Text scaling         | px; root forced to 13px                                                  | rem, `data-text-size`, large-screen steps                | `CC:228-232`, `LC:76-82`         | Locavern's.                                                                           |
| Reflow               | none (fails at 320 CSS px)                                               | passes at 320 (own e2e test)                             | measured                         | Locavern's shell.                                                                     |

### Dark mode

| Aspect           | Chrono                                                                                                                                                                                           | Locavern                                               | Refs                                                                      | Proposed Covenant default (why)                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Token overrides  | present, identical base values                                                                                                                                                                   | present, plus status surfaces, fills, `border-control` | `CC:193-222`, `LT:90-134`                                                 | Locavern's set.                                                                                                     |
| Switching        | none                                                                                                                                                                                             | OS preference plus switch, stored, `color-scheme` meta | `theme-init.js`, `index.html:165`                                         | Locavern's mechanism in the package.                                                                                |
| What breaks      | live cards turn near-white with unreadable captions; session rows keep `accent-50` and the text becomes invisible; pointage tiles and the shortcut panel stay light; stat text uses `accent-600` | complete                                               | `PointageWidget.js:107,122`, `Timeline.js`, `CA:88,141,146`, `App.js:132` | Port replaces every primitive (`neutral-*`, `accent-*`, `*-50`, `#fff`, `rgba(255,255,255,…)`) by a semantic token. |
| Inverse surfaces | `--cv-fg` used as a background (inverts to white in dark)                                                                                                                                        | none                                                   | `PointageWidget.js:107`                                                   | `--cv-surface-inverse` stays dark in dark mode (question 8).                                                        |
| Shadows          | dark set present                                                                                                                                                                                 | same                                                   | `CC:216-221`                                                              | Keep.                                                                                                               |

## Accessibility check of the proposals

WCAG 2.2 AA: 4.5:1 for normal text (3:1 for 18pt or 14pt bold), 3:1 for UI component
boundaries, focus indicators and graphics needed to understand content (1.4.11). All values
below are computed.

### Proposed pairs

| Pair (foreground on background)                                           | Ratio                      | Needs | Result                            |
| ------------------------------------------------------------------------- | -------------------------- | ----- | --------------------------------- |
| fg `#18181b` on surface `#ffffff` / on bg `#fafafa`                       | 17.72 / 16.97              | 4.5   | pass                              |
| fg-muted `#52525b` on white / bg / surface-2                              | 7.73 / 7.41 / 7.03         | 4.5   | pass                              |
| fg-subtle `#686871` on white / bg / surface-2                             | 5.52 / 5.28 / 5.02         | 4.5   | pass                              |
| fg-subtle `#686871` on surface-3 `#e4e4e7`                                | 4.35                       | 4.5   | **fail**: do not use on surface-3 |
| fg-accent `#c2410c` on white / bg / accent-50                             | 5.18 / 4.96 / 4.88         | 4.5   | pass                              |
| Primary label, option a: white on `#c2410c`                               | 5.18                       | 4.5   | pass                              |
| Primary label, option b: white on proposed `#d0490c`                      | 4.53                       | 4.5   | pass (thin margin)                |
| Primary hover and pressed: white on `#9a3412` / `#7c2d12`                 | 7.31 / 9.37                | 4.5   | pass                              |
| Focus ring accent-600 on white / bg                                       | 5.18 / 4.96                | 3     | pass                              |
| Focus ring accent-500 on white / bg (Chrono's)                            | 3.56 / 3.41                | 3     | pass, thin                        |
| Proposed `--cv-border-control` `#8b8b94` on white / bg / surface-2        | 3.38 / 3.24 / 3.07         | 3     | pass                              |
| Status text on status surface: success / warning / danger / info          | 6.81 / 8.38 / 7.34 / 13.35 | 4.5   | pass                              |
| Ink card: `#fafafa` on `#18181b`; caption `#a1a1aa` on `#18181b`          | 16.97 / 6.91               | 4.5   | pass                              |
| **Dark**: fg `#f5f6f8` on surface / fg-muted on surface / on surface-2    | 15.08 / 9.61 / 8.47        | 4.5   | pass                              |
| Dark fg-subtle `#8a90a0` on bg / surface / surface-2                      | 5.62 / 5.11 / 4.50         | 4.5   | pass (surface-2 has no margin)    |
| Dark fg-subtle on surface-3 `#323742`                                     | 3.74                       | 4.5   | **fail**: do not use on surface-3 |
| Dark fg-accent `#fb923c` on surface / on accent tint                      | 7.20 / 6.30                | 4.5   | pass                              |
| Dark fg-success / warning / danger on surface                             | 8.67 / 9.99 / 6.46         | 4.5   | pass                              |
| Dark status text on dark status surface (success/warning/danger/info)     | 8.58 / 9.64 / 6.89 / 7.88  | 4.5   | pass                              |
| Dark primary label `#0a0b0e` on accent-400 `#fb923c`                      | 8.70                       | 4.5   | pass                              |
| Proposed dark `--cv-border-control` `#6e7584` on surface / surface-2 / bg | 3.52 / 3.11 / 3.88         | 3     | pass                              |

Notes on the proposed borders: Locavern's `#71717a` (4.83:1) and `#7d8494` dark (4.35:1)
pass with large margins, which is why its controls look heavy. The proposed values are the
lightest steps on the same zinc ramp that still reach 3:1 against all three surfaces a
control can sit on.

Option b (`accent-550` `#d0490c`) is the lightest orange between accent-500 and accent-600
that keeps a white label at 4.5:1 or more (4.526:1). A dark label on `#d0490c` would fail
(3.91:1), so a dark-label variant on accent-500 (4.98:1 with `#18181b`) is the only way to keep
Chrono's exact orange.

### Chrono choices that fail

| #   | Choice                                                                                                                                                                                                                            | Where                                              | Computed                      | Criterion                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| 1   | White label on accent-500 `#ea580c`                                                                                                                                                                                               | `CA:99,112,132`, `Timeline.js:361-363` (10px)      | 3.56:1                        | 1.4.3 text contrast                            |
| 2   | White label on success-500 `#16a34a` (variant defined, unused)                                                                                                                                                                    | `CA:103`                                           | 3.30:1                        | 1.4.3                                          |
| 3   | Input, select, checkbox boundary `neutral-300` (light)                                                                                                                                                                            | `CA:118`, `Todos.js:258`                           | 1.48:1                        | 1.4.11 non-text contrast                       |
| 4   | Same boundary in dark mode, `#4a515e` on surface                                                                                                                                                                                  | `CA:118` with `CC:203`                             | 2.04:1                        | 1.4.11                                         |
| 5   | `select` has `outline: none` and no replacement: no visible focus                                                                                                                                                                 | `CA:119`, `UI:134-160`                             | not applicable (no indicator) | 2.4.7 focus visible                            |
| 6   | White text on project colors in timeline blocks (11 to 12px): 8 of 16 palette colors below 4.5:1 (`#ca8a04` 2.94, `#d97706` 3.19, `#65a30d` 3.09, `#16a34a` 3.30, `#ea580c` 3.56, `#0891b2` 3.68, `#0d9488` 3.74, `#0284c7` 4.10) | `Timeline.js:324,337`                              | 2.94 to 4.10                  | 1.4.3                                          |
| 7   | Same blocks, project name at 85% opacity: 13 of 16 colors below 4.5:1                                                                                                                                                             | `Timeline.js:337`                                  | down to 2.53:1                | 1.4.3                                          |
| 8   | Project color as non-text marker: `#ca8a04` on white / bg, `#65a30d` on bg                                                                                                                                                        | `Projets.js:7-10`                                  | 2.94 / 2.81 and 2.96          | 1.4.11 (when the marker carries meaning alone) |
| 9   | In dark mode `#4f46e5`, `#7c3aed`, `#475569` on surface `#1d2027`                                                                                                                                                                 | palette                                            | 2.59, 2.86, 2.15              | 1.4.11 (same condition)                        |
| 10  | `fg-subtle` `#71717a` on `neutral-100` (the "2" workspace counter chip)                                                                                                                                                           | `App.js:54`                                        | 4.40:1 (10px mono)            | 1.4.3                                          |
| 11  | Forced dark render: live-card caption `rgba(255,255,255,.6)` on near-white card                                                                                                                                                   | `PointageWidget.js:122`                            | 1.05:1                        | 1.4.3                                          |
| 12  | Forced dark render: session row text `#f5f6f8` on `accent-50`                                                                                                                                                                     | `CA:146`, `Timeline.js` active row                 | 1.02:1                        | 1.4.3                                          |
| 13  | Forced dark render: stat text `accent-600` `#c2410c` on surface                                                                                                                                                                   | `Timeline.js:40`, `Rapport.js:60`                  | 3.15:1                        | 1.4.3                                          |
| 14  | No reflow: at 320 CSS px the main column is 64px and the page scrolls horizontally to 589px; at 390px the column is 126px                                                                                                         | `App.js:107,151`                                   | measured                      | 1.4.10 reflow                                  |
| 15  | Infinite pulses with only a shortened duration under reduced motion                                                                                                                                                               | `PointageWidget.js:50,116`, `Timeline.js:342,572`  | not applicable                | 2.3.3 (AAA) hygiene; 2.2.2 for live indicators |
| 16  | Hand-built dialog without focus trap or focus return (code reading)                                                                                                                                                               | `UI:331-386`                                       | not applicable                | 2.4.3 focus order                              |
| 17  | Text at 9, 10, 11px                                                                                                                                                                                                               | `App.js:39`, `CA:43,54`, `Timeline.js:337,340,363` | below the Covenant 12px floor | Covenant rule, not a WCAG criterion            |

Failures 11 to 13 only occur in the forced dark render; they become real the moment dark mode
is switched on, which is why they matter for the port.

Pairs Chrono got right (computed, passing): status badges (success, warning, danger, neutral,
accent: 6.38 to 9.50:1), "en retard" header (7.34:1), presence labels (7.13 and 8.67:1),
destructive button (white on `#e11d48`, 4.70:1), the toast (body 7.76:1, title 19.06:1), the
ink card text (16.97:1 and 7.03:1) and accent-600 text on white (5.18:1).

### Locavern watch list

- `fg-subtle` on `surface-3` fails in both themes (4.35:1 light, 3.74:1 dark). Used today only
  where `surface-3` is a pressed state, but the guideline above should be written into the
  component docs.
- `<select>` inside the tasks table shows the native arrow (`.cv-select` wrapper missing).
  Not an AA failure, but inconsistent.
- The class `cv-heading-2` does not exist (`today-view.js:89`), so the Today page title is the
  browser default `h2`, and the `body` margin is not reset (916px page in a 900px viewport).
  Both are defects independent of this decision.

## Impact on Locavern

If every proposal is adopted, this is what changes visibly in Locavern. Nothing here touches
its dark mode, its responsive shell or its accessibility work, which are kept.

1. **Page frame and titles.** The 8px frame and the permanent 16px vertical overflow
   disappear (a fix on its own). The page title moves from the 14px topbar to a 22px `h1` in
   the content; the topbar keeps search, theme switch, backup and the mobile menu button. The
   duplicate heading ("Tâches" twice) goes away.
2. **Cards.** Radius 8 to 12 on cards, panels, kanban columns and project cards. On Today,
   the `surface-2` sub-cards become hairline rows inside the section card; section headers
   get the 12x16 padding.
3. **Chips.** Project tags, type tags ("Tâche", "Note") and neutral status chips become muted
   text with a dot; chips remain for overdue, today and high priority. Task rows drop from
   three or four chips to one or two.
4. **Actions.** Task table: four text buttons per row become icon-only buttons (open, edit,
   archive) with the destructive action in an overflow menu (`cv-menu` already exists).
   Project cards: seven buttons become one primary "open" action plus icon buttons and an
   overflow menu. Touches `task-list-view.js:622-654` and `project-view.js:101-125, 271`.
5. **Numbers.** The Today statistic tiles (a small colored pill with the count) become large
   mono numerals (`.cv-stat`, 22px). Dates in tables keep the mono style.
6. **Color.** Primary buttons, the active tab underline and focus rings change from
   `#c2410c` to the chosen accent fill (option b: `#d0490c`, slightly brighter). If project
   color is adopted, projects get a stripe and dot (needs a project field and a schema
   migration with a test that loads the previous format, per `CLAUDE.md`), and the existing
   urgency stripe on task rows (`LA:1833-1842`) has to move to a badge or a different edge.
7. **Controls.** Borders on inputs, selects, the search box and segmented controls get
   lighter (`#71717a` to `#8b8b94`; dark `#7d8494` to `#6e7584`) and gain a 120ms transition.
   The focus ring is unchanged and gains the soft glow. All selects get the same caret.
8. **Motion.** Hover and focus fade over 120ms on buttons, nav items, rows and inputs.
   Nothing else moves.
9. **Unchanged.** Sidebar width (232), nav item recipe, shell and drawer behavior, native
   `<dialog>`, command menu, theme switch, text-size preference, skip link, toasts, forms
   structure.

Impact on Chrono (for the port, not a decision here): replace every primitive and literal
with semantic tokens, move to rem and the 12px floor, adopt the responsive shell (the live
widget has to leave the fixed sidebar below 1024px), add the theme switch, and fix failures 1
to 17 above.

## Open questions for the maintainer

Each is either/or, with a recommendation. Questions 1 to 3 change what the apps look like;
4 to 11 are mostly mechanical once those are settled.

1. **Accent fill: `accent-550` `#d0490c` or `accent-600` `#c2410c`?** Chrono's `#ea580c` with a
   white label is 3.56:1 and fails. `#d0490c` is the brightest orange that passes with white
   text (4.53:1) and keeps most of Chrono's look; `#c2410c` (what Locavern ships) passes with
   room (5.18:1) but reads browner. Either way `accent-500` stays for non-text uses (now-line,
   dots, progress, underline).
   **Recommendation: `accent-550` for fills**, hover `accent-600`, pressed `accent-700`;
   revert to 600 if you prefer a wide margin over the brighter look.
2. **Card and panel radius: 12px or 8px?** Chrono uses 12 (and an off-scale 10 for panels);
   Locavern 8. Controls are 8 in both.
   **Recommendation: 12 for cards, panels and kanban columns; 8 for controls and nav items**
   (`--cv-radius-lg` and `--cv-radius-md`, both already tokens).
3. **Project color: palette in Covenant now, or leave it in Chrono?** Covenant would ship
   `--cv-cat-1..16` (light and dark variants, a computed on-color per hue, always paired with
   a text label) and a stripe and dot recipe. Locavern would then need its own roadmap item
   (data field, migration, test).
   **Recommendation: ship the palette and recipes in Covenant, adopt in Locavern later.**
   Chrono's current 16 hexes need adjustments to pass: `#ca8a04` to `#c28504` and `#65a30d` to
   `#64a10d` (3.03:1 on bg), and dark variants `#4f46e5` to `#6961e9`, `#7c3aed` to `#8a4fef`,
   `#475569` to `#61748f` (3.0 to 3.07:1 on surface-2). One hue, `#0284c7`, has no passing
   label color (4.10:1 white, 4.33:1 dark) and needs a darker light variant.
4. **Repeated row actions: icon-only or text buttons?** Icon-only is quieter and is a large
   part of Chrono's appeal; text is more discoverable, especially in French with long labels.
   **Recommendation: icon-only for three or more repeated actions, each with an accessible
   name and tooltip; destructive actions in an overflow menu; text for the single primary
   action of a card or toolbar.**
5. **Page title: in the content (Chrono) or in the topbar (Locavern)?**
   **Recommendation: in the content as the page's only `h1` at 22px; the topbar keeps global
   tools only.** It removes Locavern's duplicate heading and gives each view Chrono's focal
   point.
6. **Sidebar width: 232px (token) or 264px (Chrono)?** Chrono needs the width for its presence
   widget; most views do not.
   **Recommendation: 232 by default; apps may override `--cv-sidebar-w`.** Whether the live
   timer widget stays in a wider Chrono sidebar or moves to the page header is a port decision.
7. **Control border: lighter AA value (`#8b8b94`, dark `#6e7584`), Locavern's current
   (`#71717a`, `#7d8494`) or Chrono's (`neutral-300`)?** Chrono's fails 1.4.11 (1.48:1).
   Locavern's passes by a wide margin and looks heavy.
   **Recommendation: the lighter AA value**, 3.07 to 3.88:1 on every surface, which keeps the
   AA guarantee and removes the outlined look.
8. **Inverse ("ink") card: shared component or Chrono-only?** It is the one high-contrast
   focal element on Chrono's screens, but Locavern has no equivalent need today.
   **Recommendation: Covenant ships only the tokens `--cv-surface-inverse` and
   `--cv-fg-on-inverse` (dark in both themes); the card stays in Chrono.**
9. **Hover and focus transitions: default-on in Covenant, or opt-in per app?**
   **Recommendation: default-on at `--cv-duration-fast` (120ms)**, with the reduced-motion rule
   fixed to also stop infinite animations. Drop Chrono's JavaScript press-scale for a CSS
   `:active` on buttons.
10. **Text below 12px: allow 10 and 11px (Chrono) or keep the 12px floor (Locavern)?**
    **Recommendation: keep the floor and delete `--cv-text-2xs` and `--cv-text-3xs`.** Chrono's
    timeline blocks, overlines and counter chips get 12px in the port, which may need layout
    adjustments in the timeline.
11. **Source of truth: the `--cv-*` implementation (both apps) or the skill's `--color-*`
    system?** The skill says blue primary, 14px base, 4/6/8px radii, Lucide icons and a
    `--duration-*` scale; both apps ship orange, 13px, 8px radii, Phosphor and `--cv-duration-*`.
    **Recommendation: the `--cv-*` implementation is canonical.** Update the skill to it when
    it is translated (roadmap step 3), and record Phosphor as the icon set. If you would rather
    move the apps to the skill's system, that is a visible redesign and should be a separate step.

Not a question, already decided by the roadmap and decision 0003: Covenant's fonts are bundled,
not loaded from the Google Fonts CDN.

## What could not be rendered or checked

- Chrono's dark mode is not reachable in the product; it was forced with `data-theme="dark"`.
- Chrono screens not captured: the manual-entry tab of the add-timer modal, session editing,
  workspace management, and the empty states. Locavern views not captured (no Chrono
  counterpart): calendar, notes, whiteboards, archives, preferences, trash and backup.
- Hover, press and animation states were not captured as images; motion findings come from the
  CSS and JavaScript, focus states were checked in the browser.
- Locavern was seeded with a small data set (4 projects, 9 tasks, 1 note); the tasks view was
  left filtered to one project, so the list shows 4 tasks.
- Other `outline: none` uses (`QuickAdd.js:107`, `Workspaces.js:77,180`) were not checked for
  a replacement focus style.
- Screenshots (not committed): 42 images of both apps, plus two focus crops, kept in the
  session scratchpad directory.
