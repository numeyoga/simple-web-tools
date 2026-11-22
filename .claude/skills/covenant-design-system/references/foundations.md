# Covenant Design System

> A covenant is explicit. Once signed, both parties know what to expect.

Covenant is a **design system for backoffice web applications**. It is built to be read and applied by an **AI coding assistant** as easily as by a human engineer — every component, token, and pattern is defined once, in plain HTML, CSS and vanilla JavaScript, with no framework dependencies.

## Who Covenant is for

**For developers:**
Covenant defines each component, token and pattern once. Follow it, and you gain consistency and velocity. Vanilla stack, zero dependencies. A checklist (the **Checklist** section) tells you before review whether it's ready, against Covenant and WCAG 2.2 AA. Covenant is explicit — an AI can read it — but you are still the one writing the code, so you are the one who verifies.

**For users of Covenant-built apps:**
If the app follows Covenant, you know what to expect. Actions behave the same everywhere. The interface makes sense. Errors are clear. It is designed for work tools — not for pretty interfaces.

## The brief, in one paragraph

Covenant is for **backoffice**, **web-based** applications. The visual language should help the user **find important information and actions quickly**. It must not distract, and it must not make them wait on unnecessary animations. All feedback from the app must be easy to understand. The system is explicitly designed to be consumed by an AI coding assistant during implementation.

---

## Sources & context for this version

This design system was defined **from scratch** — no existing codebase, Figma, or brand assets were attached to the project. The choices below were confirmed with the owner at kickoff:

| Decision | Value |
| --- | --- |
| Visual direction | Neutral modern Swiss — geometric sans, strong grid, black/white/single accent |
| Stack | Vanilla Web: HTML, CSS and vanilla JavaScript; no framework, no build step |
| Language | English only |
| Color palette | Neutral + single orange accent + semantic (success/warning/danger/info) |
| Mode support | Light + Dark (token overrides, same component CSS) |
| Typography | IBM Plex Sans (UI) + IBM Plex Mono (data) — "engineering" feel; every size in rem, scaled up on large screens |
| UI density | 32 px default row height at standard scale (2rem: rows grow with the text) |
| Corner radius | 8 px default |
| Icons | Phosphor 2.1.x (multi-weight), self-hosted from the npm package |
| Motion | Restrained — short functional transitions only, no bounce |
| Accessibility | WCAG 2.2 AA, keyboard-first, both themes |
| Sample product | Professional time tracker + todos backoffice |

If you connect a codebase, Figma, or brand files later, re-run the design-system skill — the agent will reconcile against real sources and revise this README.

---

## CONTENT FUNDAMENTALS

Covenant copy is **flat, declarative, and free of hedging**. The user is a professional doing work — treat them like one.

### Voice
- **Second person.** "You" — direct, not distant. Avoid "we" in UI copy; reserve it for onboarding and legal surfaces.
- **Imperative for actions.** Button and menu labels are verbs: `Save`, `Delete project`, `Export CSV`. Never `Click here`, never `Please save`.
- **Declarative for status.** State facts in the present tense: `3 tasks overdue`, `Sync paused`, `Invoice sent`. Never `Oops!`, `Yay!`, `Success!`.
- **Sentence case everywhere.** Titles, buttons, labels, menu items. Never Title Case, never ALL CAPS (except the `overline` micro-label style, which is a typographic role, not copy).
- **No emoji.** Emoji are not part of Covenant. They carry tone we don't want in backoffice tools and they fail silently across locales and accessibility contexts.
- **No exclamation marks.** A period is sufficient. If a statement needs an exclamation, the statement is probably wrong.

### Examples

| Do | Don't |
| --- | --- |
| `Delete 3 entries?` | `Are you sure you want to delete these entries?` |
| `Saved` | `Your changes have been saved successfully! 🎉` |
| `Timer running · 01:42:15` | `Don't forget — your timer is still going!` |
| `Cannot parse duration. Use `1h 30m` or `1:30`.` | `Oops! Something went wrong.` |
| `Archive project` | `Archive This Project` |
| `No tasks. Press N to create one.` | `It looks like you haven't added any tasks yet!` |

### Error copy — three parts
1. **What failed**, in plain terms: `Couldn't save entry.`
2. **Why**, if known: `Server returned 403.`
3. **What to do next**: `Retry, or check your session.`

Combine into one line if it fits: `Couldn't save entry — session expired. Sign in again.`

### Numbers & time
- **Durations** use mono and a fixed format: `01:42:15` (HH:MM:SS) or `1h 42m`. Never `~1.7 hours`.
- **Timestamps** are relative in lists (`3m ago`, `yesterday`), absolute in detail views (`Apr 18, 2026 · 14:32`).
- **Counts** are never rounded in tables; `1,247` not `~1.2k`.

---

## VISUAL FOUNDATIONS

### Color

A disciplined three-tier system:

1. **Neutrals (zinc scale, 12 steps).** The frame, the text, the dividers. 90% of surface area.
2. **Single accent — orange (`#ea580c` in light, `#fb923c` in dark).** Primary actions, focus, selected states, links. **One accent, no exceptions.** If you think you need a second accent, use the neutral scale plus weight / size.
   - Components reach the brand orange through semantic roles only: `--cv-brand-accent` for the logo point and brand artwork (graphic only, never behind text), `--cv-border-selected` for selection indicators such as the selected tab (4.7:1 or more in both themes).
   - A fill behind text uses `--cv-accent-fill` with `--cv-fg-on-accent`: `#cb4a00` with white text in both themes, 4.65:1, the most vivid orange that keeps white text at AA. Hover `--cv-accent-fill-hover` (`#c2410c`, 5.18:1), pressed `--cv-accent-fill-pressed` (`#9a3412`, 7.31:1).
   - **Text on coloured fills is white**, in both themes and on every fill (accent and danger). A fill never mixes dark text on one button and white text on another.
   - Accent text uses `--cv-fg-accent`.
3. **Semantic colors — success (green), warning (yellow), danger (crimson), info (steel).** Reserved for status only. Never decorative. The accent stays warm orange; warning is pure yellow so it never overlaps the accent; danger is crimson `#e11d48`, cooler and pinker than orange, so it reads clearly as "bad" next to warm UI; info is steel `#475569`, a neutral hint that never competes with the accent. Destructive fills use `--cv-danger-fill` with `--cv-fg-on-danger`: deep crimson `#9f1239` with white text (8.02:1), hover `#881337`, pressed `#6b0f2a`. It stays clearly apart from the accent fill: darker (luminance ratio 1.72) and on the other side of red (hue 343° against 22°), so a primary and a destructive button never look alike. Alerts, badges and toasts use the themed `--cv-<status>-surface`, `--cv-<status>-border` and `--cv-fg-<status>`, so they turn dark in the dark theme.

**Everything follows the theme.** Components use **semantic tokens only**. The primitive scales (`--cv-neutral-*`, `--cv-accent-*`, `--cv-success-*`, `--cv-warning-*`, `--cv-danger-*`, `--cv-info-*`) exist only to define semantic tokens in `tokens.json`; they never appear in component CSS or markup, because a primitive does not change with the theme. When no role fits, add a semantic token with a light and a dark value; never reach for a primitive. The roles:

| Need | Token |
| --- | --- |
| Page, panels, wells, pressed | `--cv-bg`, `--cv-surface`, `--cv-surface-2`, `--cv-surface-3`, `--cv-surface-raised` |
| Inverse fill (tooltip, selected segment, running-timer card) and its ink | `--cv-surface-inverse`, `--cv-fg-inverse`, `--cv-fg-inverse-muted` |
| Text | `--cv-fg`, `--cv-fg-muted`, `--cv-fg-subtle`, `--cv-fg-accent`, `--cv-fg-<status>` |
| Borders | `--cv-border`, `--cv-border-strong`, `--cv-border-control`, `--cv-border-focus`, `--cv-border-selected`, `--cv-border-danger` |
| Fills behind text | `--cv-accent-fill` (+ `-hover`, `-pressed`) with `--cv-fg-on-accent`; `--cv-danger-fill` (+ `-hover`, `-pressed`) with `--cv-fg-on-danger` |
| Status tints | `--cv-<status>-surface`, `--cv-<status>-border`, `--cv-bg-accent-subtle` |
| Brand artwork | `--cv-brand-accent`, `--cv-brand-tint`, `--cv-brand-deep` |
| Categories (projects) | `--cv-cat-1` … `--cv-cat-16` (markers), `--cv-cat-1-fill` … `--cv-cat-16-fill` with `--cv-fg-on-cat` (labelled fills), through `data-cat` |
| Scrim, shadows | `--cv-overlay`, `--cv-shadow-*` |

All pairings are verified at **WCAG 2.2 AA (4.5:1 for body, 3:1 for large text and UI)** in both light and dark:
- `--cv-fg`, `--cv-fg-muted`, `--cv-fg-subtle` and the `--cv-fg-<status>` colors (success, warning, danger, info) pass 4.5:1 on `--cv-bg`, `--cv-surface` and `--cv-surface-2` in both themes, with a margin (`--cv-fg-subtle` is 4.86:1 on `--cv-surface-2` in dark). `--cv-fg-disabled` is exempt.
- On `--cv-surface-3` (pressed and selected states, avatars) only `--cv-fg` and `--cv-fg-muted` are allowed (6.1:1 or more). `--cv-fg-subtle` is never placed on it.
- Status text, icons and badge dots use `--cv-fg-<status>` on `--cv-<status>-surface` (6.8:1 or more in both themes); a badge dot takes the badge's text colour. Status is never shown by color alone: it always comes with a word or an icon.
- Boundaries of inputs, selects, segmented controls and checkboxes use `--cv-border-control` (3:1 or more, WCAG 1.4.11).
- **Text on the inverse surface** (`--cv-surface-inverse`): `--cv-fg-inverse` for main text (17.7:1 light, 18.2:1 dark) and `--cv-fg-inverse-muted` for captions such as a project name or a start time (6.91:1 light, 5.16:1 dark). `--cv-fg-muted` (2.29:1 light, 1.57:1 dark) and `--cv-fg-subtle` (3.21:1, 2.74:1) never go on it.

#### Category colours (a deliberate extension)
Projects, clients or other user-defined groups get one of 16 **category colours**. A category is **not a status** and never replaces a status badge, and it **never carries meaning alone**: the name is always next to the colour or inside it, and charts have a legend or direct labels.

- Each hue has two roles. `--cv-cat-N` is the **marker** (stripe, dot, chart segment, border of a selected swatch): a light and a dark value, 3:1 or more against `--cv-bg`, `--cv-surface`, `--cv-surface-2` and `--cv-surface-raised` (3.20:1 at worst). Markers never sit on `--cv-surface-3`. `--cv-cat-N-fill` is the **fill behind a white label** (`--cv-fg-on-cat`), the same in both themes, 4.5:1 or more (4.60:1 at worst). A labelled block needs no 3:1 against its surface: its label identifies it.
- The hues follow the colour wheel (1 orange, 2 amber, 3 yellow, 4 lime, 5 green, 6 teal, 7 cyan, 8 sky, 9 blue, 10 indigo, 11 violet, 12 purple, 13 fuchsia, 14 pink, 15 rose, 16 slate) and alternate a **bright** tier (odd numbers, at the contrast minimum) and a **deep** tier (even numbers: darker in light and in fills, lighter as dark markers). Neighbours therefore differ in lightness as well as hue, which keeps them apart for colour-vision deficiencies too.
- Applications store the **number**, set it with `data-cat`, and assign new projects in the default order 9, 4, 14, 10, 7, 6, 16, 13, 8, 11, 12, 5, 3, 2, 15, 1, which keeps the first six apart for everyone and puts the status look-alikes (green, yellow, amber, rose) and the accent look-alike (orange) last. After 16, the order starts again.
- Custom colours: restrict users to the palette. If an application must accept any colour, `Covenant.setCategory(element, "#rrggbb")` derives the three values by changing the lightness only.
- See the **CategoryColor** component for the recipes, the accessibility rules and the decisions.

### Typography
- **IBM Plex Sans** for everything UI.
- **IBM Plex Mono** for numeric data, IDs, durations, timestamps in tables. Mono is a semantic role, not decoration.
- Default UI text is **13 px / 1.5** at standard scale (`0.8125rem`). Table rows and inputs at 13 px. Page bodies may go up to 14 px.
- **Every size is in rem** — text, spacing, row heights, icons, panels — so the whole interface follows the browser's font-size setting and scales as one block. Only borders, focus outlines, shadows and radii stay in px. Covenant itself sets the root size (`html { font-size: … }` in `covenant.css`) to apply the text scale; consuming applications never set `font-size` on `<html>`.
- **Large screens scale up automatically**: ×1.125 from 2000 CSS px wide (QHD at 125 %, 4K at 175 %) and ×1.25 from 2400 CSS px (QHD 27" at 100 %, 4K at 150 %). On a 27" 2560 × 1440 screen at 100 %, body text is 16.25 px and rows are 40 px.
- **Users can choose**: `data-text-size` on `<html>` set from the user's preference — `standard` (×1), `comfortable` (×1.125), `large` (×1.25); no attribute means automatic. See the TextSize component.
- **Minimum text size is 12 px** (`--cv-text-xs`, `0.75rem`) at standard scale: overlines, badges, tags, tooltips, counters, `code` and `kbd` included.
- Headings are **semibold (600)**, never 700. Tracking is slightly tight (-0.01em) at display sizes, normal below 22 px.

### Spacing
A 4 px base scale (0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px at standard scale; `0.25rem` steps in the tokens). Default component padding is **8 px vertical / 12 px horizontal**. Default stack gap is **8 px** inside components, **16 px** between components, **24–32 px** between sections.

### Backgrounds
- **Flat.** No gradients anywhere in the product chrome.
- **No hand-drawn illustrations, no textures, no patterns.** Backoffice has no decorative surfaces.
- Page background: `--cv-bg` (off-white in light, near-black in dark).
- Card / panel background: `--cv-surface` (pure white / `#1d2027`).
- Subtle wells and hover states: `--cv-surface-2`.
- Full-bleed images appear only in user-uploaded content (e.g. attachments). The chrome itself never carries imagery.

### Borders
- **1 px, always.** `--cv-border` for default, `--cv-border-strong` for emphasis, `--cv-border-control` for form-control boundaries, `--cv-border-danger` for invalid controls, `--cv-border-selected` for selection (2 px for the selected tab), `--cv-border-focus` for focus.
- Hairlines separate data rows; never use borders + shadows on the same edge.

### Shadows & elevation
- **xs / sm / md / lg / xl**, each scoped to a role:
  - `xs` — sticky headers, table row hover
  - `sm` — cards, surfaces above the page
  - `md` — dropdowns, popovers, menus
  - `lg` — modals, drawers
  - `xl` — toasts, command bar
- Shadows are **neutral grey**, never coloured. Dark mode shadows are blacker and stronger.

### Corner radii
- **0 / 2 / 4 / 8 / 12 / 16 / full**.
- Default `--cv-radius-md: 8px` on cards, inputs, buttons.
- `--cv-radius-lg: 12px` on modals, drawers and the command menu; `--cv-radius-sm: 4px` on tags, keycaps and menu items. No other values.
- `full` (pill) only on status badges, tab counters, avatars, switches and category dots.
- Never mix radii on adjacent surfaces — a card at 8 px contains inputs at 8 px, not 4 px.

### Hover, press, focus
- **Hover** — background shifts **one step** on the neutral scale (e.g. `--cv-surface` → `--cv-surface-2`; accent fills: `--cv-accent-fill` → `--cv-accent-fill-hover`). Never opacity. Never "glow".
- **Press** — background shifts **two steps** (e.g. `--cv-surface` → `--cv-surface-3`; accent fills: `--cv-accent-fill-pressed`; danger fills: `--cv-danger-fill-hover` → `--cv-danger-fill-pressed`). No transform/shrink — users perceive layout movement as latency.
- **Focus** — 2 px outline in `--cv-border-focus` (4:1 or more on every surface in both themes), visible **on keyboard only** (`:focus-visible`). The focus ring is sacred — never remove it. Where the ring sits:

| Component | Offset | Ring colour |
| --- | --- | --- |
| Default (buttons, links, tabs, cards, pagination, nav items) | 2 px outside | `--cv-border-focus` on the surrounding surface |
| Text input, textarea, select | 0, on the border | `--cv-border-focus`; `--cv-border-danger` when invalid |
| Menu items | 2 px inside | `--cv-border-focus` on `--cv-surface-2` |
| Segmented control | 4 px inside | `--cv-border-focus` on an unselected segment; `--cv-fg-inverse` on the selected one (where keyboard focus lands), 17:1 or more on `--cv-surface-inverse` |
| Checkbox, radio, switch | 2 px outside the 24 px target | `--cv-border-focus` |
- **Disabled** — `opacity: 0.5`, `cursor: not-allowed`, and `aria-disabled="true"`. Never swap the color.

### Transparency & blur
- Avoid both. The modal scrim `--cv-overlay` is the only sanctioned use of transparency.
- Never `backdrop-filter: blur()`. It is expensive and not supported everywhere.

### Motion
- **Restrained.** Only overlays and toasts move. Table rows, inputs, buttons change instantly.
- **120 ms** (`--cv-duration-fast`, `--cv-ease-emphasize`): menus and list boxes (combobox, command menu) fade in.
- **180 ms** (`--cv-duration-base`, `--cv-ease-standard`): modals and toasts enter.
- **280 ms** (`--cv-duration-slow`): drawers and the small-screen sidebar slide.
- Easing `--cv-ease-standard` is `cubic-bezier(0.2, 0, 0, 1)` — Material's "standard." Never spring, never bounce.
- `@media (prefers-reduced-motion: reduce)` sets every duration token to `--cv-duration-instant` (0 ms) and stops all animation.

### Layout rules
- **Fixed sidebar (14.5rem, 232 px at standard scale)**, sticky top bar (3rem, 48 px: `position: sticky`, and `scroll-padding-top` so it never hides the focused element, WCAG 2.4.11), fluid content area from 1024 px up (the AppShell component). Both grow with the text scale.
- **Below 1024 px** the sidebar becomes an off-canvas drawer opened from a menu button in the top bar. At 320 px CSS width (400 % zoom) nothing scrolls sideways except a data table inside its own focusable region (WCAG 1.4.10 Reflow).
- Maximum content width `90rem` (1440 px at standard scale), centered. Wider screens get larger text first, then gutter space, never wider tables.
- 8-column content grid inside the main area, 16 px gutter; one column below 768 px.
- Controls use `min-height`, never a fixed height, so 200 % zoom (1.4.4) and text-spacing overrides (1.4.12) never clip text.
- Every page starts with a skip link to `<main>` and keeps the sidebar order identical.

### Reset and prose
- **Reset.** `covenant.css` starts with a minimal modern reset in its own cascade layer, `@layer cv-reset`: `body` margin 0; margin 0 on `h1`–`h6`, `p`, `ul`, `ol`, `figure`, `blockquote`, `dl`, `dd`; `img`, `picture`, `video` and `canvas` as `display: block; max-width: 100%`; `overflow-wrap: break-word` on paragraphs and headings; `text-wrap: balance` on headings. Inline `svg` is left alone (icons, logos) and lists keep their markers. The layer beats the browser's styles but loses to every unlayered rule, so a component or an application rule never needs `!important` against it. An application does not reset on its own (`html, body { margin: 0 }`, a `margin: 0` on a heading or a paragraph): the browser's margins are already gone. Space blocks with `gap` or an explicit token margin.
- **`.cv-prose`.** User content (notes, a rich-text surface, a Markdown preview, slides) needs the vertical rhythm the reset removed. Put `class="cv-prose"` on the element that holds the blocks: `1em` around `p`, `ul`, `ol`, `blockquote`, `pre`, `figure` and `dl`; nested lists tight; `2.5rem` of list indent (`--cv-space-9`); heading steps of the browser (`0.67em` for `h1` to `2.33em` for `h6`) above and `--cv-space-2` below; `--cv-space-3` between siblings (`> * + *`). Every selector is wrapped in `:where()`, so the specificity is zero: a component or an application rule that sets a margin or a padding on a block of the content still wins (the task list of the rich-text editor does).
- A Covenant component that used to rely on the browser's margin states its own (`.cv-empty > p`, `1em`).

### Imagery
The chrome carries no imagery. When user-uploaded images appear (attachments, avatars):
- Avatars are circles at 24 / 32 / 40 px. Fallback is initials in `--cv-fg` on `--cv-surface-3`.
- Attached images display at their natural ratio inside an 8 px-radius container with a 1 px border.
- No filters, no grain, no warm/cool treatment.

### Cards
- **1 px border** (`--cv-border`) **+ 8 px radius** + `--cv-shadow-sm`.
- Never both a strong shadow and a strong border — pick one.
- Internal padding: 16 px (compact) or 20 px (default) or 24 px (prominent).

---

## ICONOGRAPHY

Covenant uses **[Phosphor Icons](https://phosphoricons.com/)** 2.1.x (any patch version), **self-hosted**: install `@phosphor-icons/web` from npm (or your Nexus mirror), copy `src/regular` and `src/bold` into your app, and link their stylesheets. No CDN request.

```html
<link rel="stylesheet" href="phosphor/regular/style.css">
<link rel="stylesheet" href="phosphor/bold/style.css">
<i class="ph ph-clock" aria-hidden="true"></i>
<i class="ph-bold ph-check" aria-hidden="true"></i>
```

A CDN (`https://unpkg.com/@phosphor-icons/web@2.1.2`) works for prototypes only.

### Why Phosphor
- **Multi-weight** (thin / light / regular / bold / fill / duotone) — lets us match the "calm but engineered" feel without swapping libraries.
- **1:1 glyph set** across weights so we can change emphasis without redrawing.
- Broad coverage: status, time, data, file, user, system glyphs.

### Usage rules
- **Default weight: `regular`.** Use `bold` only for filled primary-button icons or for a 1-level-up emphasis inside a dense row.
- **Size: `1em`** relative to the surrounding text, inheriting `currentColor`. Default rendered size is 16 px (inside body text) or 20 px (inside buttons).
- **Line up icons by optical center**, not bounding box — apply a negative `vertical-align: -0.15em` on inline icons next to text.
- **Every icon-only button has an `aria-label`.** No exceptions. Decorative icons take `aria-hidden="true"`.
- **No emoji. No unicode glyphs as icons** (e.g. ✓, ★, →). Use `ph-check`, `ph-star`, `ph-arrow-right`.

### When to skip an icon
In a backoffice, icons compete with data for attention. Skip them:
- Next to self-explanatory text buttons (`Save`, `Cancel`).
- Inside dense tables where a text column is already narrow.
- As purely decorative accents.

Use them:
- In sidebar navigation (users scan by shape).
- In command bars and menus (pattern recognition).
- For status indicators where color alone would fail WCAG (`ph-check-circle` + green, `ph-warning` + yellow).

### Logo
A simple mark + wordmark lockup, defined in SVG at `assets/covenant-logo.svg`. The mark is a capital C formed by two arcs that meet — a visual pun on "covenant" as an agreement between two parties. The centre point is `--cv-brand-accent`. The `cv-logo` component shows the lockup that matches the theme. See the Logo component (`components/Logo/`).

---

## Index of this design system

```
project/
├── README.md                ← you are here: content and visual foundations
├── checklist.md             ← Covenant + WCAG 2.2 AA checklist, run before every review
├── tokens.json              ← all tokens: color (light + dark), type, spacing, radius, shadow, row density
├── tokens.css               ← tokens.json compiled to CSS custom properties + .cv-* type classes
├── components/
│   ├── bundle.css           ← every component as .cv-* classes, base styles, fonts, motion, layout
│   ├── bundle.js            ← behaviours the platform lacks (window.Covenant), no dependency
│   └── <Component>/         ← README.md (anatomy, states, accessibility, checklist) + preview.html
├── fonts/                   ← IBM Plex, self-hosted: covenant-fonts.css + 7 .woff2 files + OFL.txt (optional)
└── assets/                  ← logo lockups and mark (SVG)
```

Components: **Actions** Button, Link · **Forms** FormField, TextInput, Textarea, Select, Checkbox, Radio, Switch, SegmentedControl, Combobox, DateTimeInput · **Feedback** Alert, Badge, Toast, Tooltip, Skeleton, EmptyState · **Overlays** Modal, Drawer, Menu, CommandMenu · **Navigation** SidebarNav, TopBar, Breadcrumbs, Tabs, Pagination · **Data display** DataTable, Card, Avatar, Kbd · **Layout** AppShell, TextSize · **Brand** Logo, Icons.

### How to consume Covenant

Covenant is Vanilla Web: no framework, no build step. It works the same in a static page, a server-rendered app (Phoenix, Spring, Rails…) or inside any framework's templates.

1. Copy `tokens.css`, `components/bundle.css` and `components/bundle.js` into your project (rename them `covenant-tokens.css`, `covenant.css`, `covenant.js` if you like). Copy the `fonts/` folder for IBM Plex and Phosphor's `src/regular` and `src/bold` from the `@phosphor-icons/web` npm package (2.1.x).
2. Load them once, in this order. None of these files makes a third-party request:

```html
<link rel="stylesheet" href="fonts/covenant-fonts.css">
<link rel="stylesheet" href="covenant-tokens.css">
<link rel="stylesheet" href="covenant.css">
<link rel="stylesheet" href="phosphor/regular/style.css">
<link rel="stylesheet" href="phosphor/bold/style.css">
<script src="covenant.js" defer></script>
```

`fonts/covenant-fonts.css` is optional: without it, Covenant falls back to the system UI fonts. You can also install `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` and import their weights 400, 500, 600 (and 700 for Sans) instead.

3. Set the theme on the root: `<html lang="en" data-theme="light">` or `data-theme="dark"`. Add `data-text-size="standard|comfortable|large"` from the user's stored preference, or leave it out for automatic scaling. Never set a `font-size` on `<html>` in your application: `covenant.css` sets it to apply the text scale.
4. Copy the **Anatomy** markup from each component page and keep its classes, roles and ARIA attributes. Never restyle a component locally: extend `bundle.css` deliberately.
5. Use semantic tokens (`var(--cv-fg)`, `var(--cv-surface)`, `var(--cv-shadow-sm)`, …) for anything you build around the components; never a hard-coded value and never a primitive scale token, so everything follows the theme.
6. Behaviours start by themselves. For markup added later, call `Covenant.init(element)`. `Covenant.setTextSize(size)` changes the text size and fires `cv:textsize` so the app can save the choice. `Covenant.toast({ status, title, text })` shows a toast; `Covenant.openDialog(id)` and `Covenant.closeDialog(id)` drive dialogs. `Covenant.setCategory(element, n | '#rrggbb')` sets a category colour; `Covenant.categoryColors(hex)` returns the derived light marker, dark marker and fill.
7. Run the **Checklist** before review.

**In an existing app:** align **tokens** first (load `tokens.css` and remap your theme variables onto `--cv-*`), then move components one surface at a time: buttons, forms, navigation, tables.

**When an AI agent implements against Covenant:** it uses the `covenant-design-system` skill, which carries these files, every component page and the checklist. It reads this README, then the component pages it needs, copies their anatomy, uses semantic tokens only, never introduces a second accent, and runs the checklist before calling a component done. If a design calls for something not covered here, it stops and asks.
