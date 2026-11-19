---
name: covenant-design-system
description: Build or review web UI with the Covenant Design System (Vanilla Web backoffice, WCAG 2.2 AA). Use for any HTML, CSS or JS screen, component or prototype that must follow Covenant, and before declaring such UI done.
---

# Covenant Design System

Covenant is a design system for backoffice web applications, written in **Vanilla Web**: plain HTML, CSS and vanilla JavaScript, no framework, no build step. Every component is defined once in this skill. Your job is to assemble those components, not to invent new ones, and to prove each result against the checklist.

## Files

| Path | What it is | When to read it |
| --- | --- | --- |
| `references/foundations.md` | Voice, colour roles, type, spacing, radii, states, motion, layout and reflow rules | Once per task, before writing UI |
| `references/components/<Name>.md` | Anatomy (HTML to copy), classes and states, accessibility and keyboard, usage, component checklist | For every component you use |
| `references/checklist.md` | Covenant conformity + WCAG 2.2 AA checklist, with the test procedure | Before you call anything done |
| `assets/covenant-tokens.css` | Design tokens (`--cv-*`), light and dark | Copy into the project |
| `assets/covenant.css` | All component classes (`.cv-*`), base styles, fonts, layout | Copy into the project |
| `assets/covenant.js` | Behaviours the platform lacks (`window.Covenant`) | Copy into the project |
| `assets/tokens.json` | Token source with a usage note per token | To look up a token's role |
| `assets/logos/` | Logo lockups and mark (SVG) | Copy, never redraw |
| `templates/page.html` | A full page: includes + AppShell (skip link, sidebar, top bar, main) | Start every new page from it |

The references describe the published design system: there `tokens.css` is `assets/covenant-tokens.css` here, `components/bundle.css` is `assets/covenant.css`, `components/bundle.js` is `assets/covenant.js`, and `assets/*.svg` (written `../../assets/…` in the Logo page) is `assets/logos/`.

## In this repository

This section is a local adaptation of the published skill. It overrides the set-up step below.

- No CDN and no third-party request (decision 0003). Do not keep the Google Fonts `@import`
  from `assets/covenant.css` or the unpkg `<script>`: IBM Plex comes from the `@fontsource`
  packages and Phosphor from the `@phosphor-icons/web` npm package, both bundled by Vite.
- Phosphor follows the version pinned in the apps' `package.json`, which Dependabot updates.
- `assets/` is the reference copy; the apps will load Covenant from `packages/covenant`
  (roadmap step 3) instead of copying the files next to each page.
- UI strings go through the app's translation catalog (`@simple-web-tools/i18n`), never inline.

## Workflow

1. **Read** `references/foundations.md`.
2. **Set up** the project once: copy the three files from `assets/` next to the page and load them in this order:
   ```html
   <link rel="stylesheet" href="covenant-tokens.css">
   <link rel="stylesheet" href="covenant.css">
   <script src="https://unpkg.com/@phosphor-icons/web@2.1.1"></script>
   <script src="covenant.js" defer></script>
   ```
   Set `<html lang="…" data-theme="light|dark">`. New pages start from `templates/page.html`.
3. **Pick components** from the index below and open each one's reference. Copy its **Anatomy** markup verbatim; change only text, `id`s (keep them unique and keep every `for`, `aria-controls`, `aria-labelledby` and `aria-describedby` pointing at the right `id`) and data.
4. **Compose** with tokens only. Layout glue may use `display`, `gap` and `grid`, with `var(--cv-space-*)` values. Any colour, radius, shadow or size is a `var(--cv-*)` token.
5. **Behaviour** comes from `covenant.js`: it starts by itself; call `Covenant.init(element)` after inserting markup; `Covenant.toast({ status, title, text })`, `Covenant.openDialog(id)`, `Covenant.closeDialog(id)`. Listen to `cv:change` (combobox) and `cv:command` (command menu).
6. **Verify** with `references/checklist.md` plus the checklist of every component used, in both themes. When you can run a browser, run axe-core (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` tags) in light and dark, tab through every control, open and close every overlay with the keyboard, and check a 320 px wide window. Report what you checked and what you could not.
7. **Stop and ask** when a design needs something no component or token covers. Never invent a token, a colour, a component or a variant; propose a deliberate extension instead.

## Firm rules

- Vanilla Web only. Do not add React, Vue, Tailwind or any UI library. If the host project already uses a framework, render the same Covenant markup and classes in its templates.
- Native HTML first: `<button>`, `<a href>`, `<input>`, `<select>`, `<dialog>`, `popover`, `<fieldset>`/`<legend>`, `<table>`.
- One accent, orange. Text never sits on `--cv-accent-500`; fills behind text use `--cv-accent-fill` with `--cv-fg-on-accent`. Destructive fills use `--cv-danger-fill` with `--cv-fg-on-danger`.
- Status colours mean status only, and status is always carried by a word or an icon too.
- Sentence case, no emoji, no exclamation mark. Buttons are verbs; errors say what failed, why, and what to do next.
- IBM Plex Sans for UI, IBM Plex Mono for numbers, IDs, durations and timestamps. Phosphor 2.1.1 icons only.
- No gradients, no decorative imagery, no `backdrop-filter`, no bounce. Motion only on overlays and toasts.
- WCAG 2.2 AA in both themes is the floor: 4.5:1 text, 3:1 boundaries and focus, 24 px targets, full keyboard support, reflow at 320 px.
- Every size is in rem (text, spacing, rows, icons, panel widths); never set `font-size` on `<html>`, never write a font size in px, never go below `--cv-text-xs` (12 px). Text size is chosen with `data-text-size` on `<html>` (`standard`, `comfortable`, `large`; none = automatic, larger on screens 2000 CSS px wide and more).

## Component index

**Actions**
- `Button` — Buttons trigger an action: primary, secondary (default), ghost and danger, at 32 px (default) or 28 px (`cv-btn--sm`).
- `Link` — Links navigate to another page or place; they read in `cv-fg-accent` and are always underlined.

**Forms**
- `Checkbox` — Native checkboxes in a labelled fieldset; checked boxes fill with `cv-accent-fill`.
- `Combobox` — A combobox filters a long list as you type and lets you pick with the arrow keys; Escape closes the list.
- `DateTimeInput` — Dates and times use the native `date`, `time` and `datetime-local` inputs, set in mono, with the browser picker.
- `FormField` — A form field wraps one control with its label, an optional hint and an error message, all linked for assistive technology.
- `Radio` — Native radio buttons for one choice among a few, grouped in a fieldset.
- `SegmentedControl` — A segmented control picks one of two to five views; it is a radio group drawn as joined buttons.
- `Select` — A native `<select>` styled like the text input, with a drawn chevron; use it for 2 to 15 known options.
- `Switch` — A switch turns a setting on or off immediately; it is a native checkbox with `role="switch"`.
- `TextInput` — A single-line text input at 32 px with a 3:1 boundary, optionally with a leading icon or in mono for codes and amounts.
- `Textarea` — A multi-line text input that grows vertically, with the same boundary, focus and error states as the text input.

**Feedback**
- `Alert` — An inline alert states a fact about the current view: success, warning, danger or info, always with an icon and a bold lead.
- `Badge` — Badges label a status or a category: status pills with a dot and a word, or square tags for versions and metadata.
- `EmptyState` — An empty state explains why a view has no content and offers the next action.
- `Skeleton` — Skeletons hold the place of content while it loads; they are static blocks in `cv-surface-3`, with no shimmer.
- `Toast` — Toasts confirm the result of an action, bottom-right, on a raised surface; errors and warnings stay until dismissed.
- `Tooltip` — A tooltip names an icon-only control or adds a short hint; it shows on hover and focus, stays while hovered and closes with Escape.

**Overlays**
- `CommandMenu` — The command menu opens with ⌘K or Ctrl+K and runs a command by name; it is a modal `<dialog>` holding a combobox with an always-visible list.
- `Drawer` — A drawer slides in from the right to show or edit the details of an item without leaving the list; it is a native modal `<dialog>`.
- `Menu` — A menu lists actions on an item; it opens from a button with the native popover API and is driven with the arrow keys.
- `Modal` — A modal asks for a decision or a short form on top of the page; it is a native `<dialog>` opened with `showModal()`.

**Navigation**
- `Breadcrumbs` — Breadcrumbs show where the page sits in the hierarchy; ancestors are links and the current page is plain text.
- `Pagination` — Pagination moves through pages of a long list; the current page is filled with the accent.
- `SidebarNav` — The sidebar is the main navigation: 14.5rem (232 px at standard scale) wide, the logo, then icon and label links grouped under overline headings.
- `Tabs` — Tabs switch between views of the same object; the selected tab is underlined in the accent.
- `TopBar` — The top bar is 3rem (48 px at standard scale) high and holds the page title, the search that opens the command menu and the account actions.

**Data display**
- `Avatar` — Avatars show a person as a photo or initials in a circle at 24, 32 or 40 px.
- `Card` — Cards group the summary of one object: a title, metadata and an optional footer; a card that opens the object is a link.
- `DataTable` — Data tables list records in 32 px rows with a sentence-case header, mono numbers aligned right, and scroll inside their own region on narrow screens.
- `Kbd` — Keycaps show a keyboard shortcut in mono, with a thicker bottom border.

**Layout**
- `AppShell` — The app shell lays out every page: a fixed 14.5rem sidebar and a 3rem top bar from 1024 px, an off-canvas drawer below, and content that reflows to one column.
- `TextSize` — The text size setting lets each user enlarge the whole interface: automatic (follows the screen), standard, comfortable or large.

**Brand**
- `Icons` — Covenant uses Phosphor Icons 2.1.1, regular weight by default and bold for emphasis, sized at 1em in `currentColor`.
- `Logo` — The Covenant lockup and mark: two arcs that meet around an orange point, beside the wordmark in IBM Plex Sans semibold.
