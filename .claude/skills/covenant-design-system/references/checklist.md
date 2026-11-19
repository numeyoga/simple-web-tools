# Checklist

Run this list on every component and every screen before review. A component is done only when every box is ticked in **both themes** (`data-theme="light"` and `data-theme="dark"`). Each component page adds its own points under **Checklist**.

How to test, in order:

1. **Automated**: axe-core with the `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa` tags, in light and in dark, with every overlay open (modal, drawer, menu, command menu, combobox list, tooltip, toast). Zero violations. axe does not measure the contrast of control borders or focus rings: step 3 does.
2. **Keyboard only**: unplug the mouse. Tab through everything, operate every control, open and close every overlay. Hover a timed toast, leave it, and check that it disappears after the time that was left.
3. **Theme and non-text contrast**: switch `data-theme` to dark and back. Every colour changes with the theme. Measure the borders of inputs, selects and checkboxes, the invalid border, the selected-tab underline and every focus ring against what touches them: 3:1 or more in both themes (1.4.11). Search the component CSS and markup for primitive tokens: `grep -nE "var\(--cv-(neutral|accent|success|warning|danger|info)-[0-9]+\)"` returns nothing.
4. **Zoom and reflow**: 200 % browser zoom, then a 320 px wide window. Nothing is cut off; nothing scrolls sideways except a data table inside its own region.
5. **Large screen and text size**: a 2560 × 1440 window at 100 % (body text 16.25 px, rows 40 px), then `data-text-size="large"` on a 1280 px window, then the browser's default font size at 20 px. Everything grows together; nothing overlaps, clips or scrolls sideways.
6. **Text spacing**: apply line height 1.5, paragraph spacing 2, letter spacing 0.12, word spacing 0.16 (a bookmarklet does this). No text is clipped or overlaps.
7. **Screen reader**: NVDA or VoiceOver on the component. Every control announces its name, role and state.

## 1. Covenant conformity

### Tokens and values
- [ ] Every color, space, radius and shadow is a **semantic** `var(--cv-*)` token that follows the theme. No primitive scale token (`--cv-neutral-*`, `--cv-accent-*`, `--cv-<status>-<number>`), no hex, `rgb()`, named color or raw length in component CSS or markup. A missing role becomes a new semantic token with a light and a dark value.
- [ ] Only the components stylesheet (`components/bundle.css`) and `tokens.css` style it; no inline style except layout in a demo.
- [ ] Radii come from the scale: `cv-radius-md` (8 px) on cards, inputs and buttons; `cv-radius-lg` (12 px) on modals, drawers and the command menu; `cv-radius-sm` (4 px) on tags, keycaps and menu items; `cv-radius-full` only on status badges, tab counters, avatars and switches.
- [ ] Spacing comes from the 4 px scale (`cv-space-*`).
- [ ] Controls use `min-height`, never a fixed `height`.
- [ ] Every size is in `rem` (text, spacing, row heights, icons, widths of panels). Only borders, outlines, shadows and radii are in px. The application never sets `font-size` on `<html>` (`covenant.css` sets it for the text scale).

### Color roles
- [ ] One accent only. Text never sits on `cv-brand-accent`: a fill behind text is `cv-accent-fill` with `cv-fg-on-accent`.
- [ ] Accent text is `cv-fg-accent`; links are underlined.
- [ ] Status colors (success, warning, danger, info) mean status only, through `cv-<status>-surface`, `cv-<status>-border` and `cv-fg-<status>`.
- [ ] Destructive actions use `cv-danger-fill` with `cv-fg-on-danger`.
- [ ] Text and icons on a coloured fill (accent or danger) are white, in both themes; a primary and a danger button side by side are told apart at a glance.
- [ ] Form-control boundaries use `cv-border-control`, invalid controls `cv-border-danger`, selection `cv-border-selected`; focus uses `cv-border-focus` (or `cv-fg-inverse` on `cv-surface-inverse`).
- [ ] On `cv-surface-3` only `cv-fg` and `cv-fg-muted`; `cv-fg-subtle` never sits on it.
- [ ] No gradient, no texture, no `backdrop-filter`. The only transparency is the `cv-overlay` scrim.

### States
- [ ] Hover moves the background one step (`cv-surface` → `cv-surface-2`, or `cv-accent-fill` → `cv-accent-fill-hover`); pressed two steps. No transform, no opacity, no glow.
- [ ] Focus is visible on keyboard (`:focus-visible`), 2 px, never removed.
- [ ] Disabled: `opacity: 0.5`, `cursor: not-allowed`, `aria-disabled="true"` or `disabled`; the color never changes.

### Type and copy
- [ ] IBM Plex Sans for UI, IBM Plex Mono for numbers, IDs, durations and timestamps (`cv-num`, `cv-input--mono`, `cv-kbd`).
- [ ] Default UI text `--cv-text-sm` (13 px at standard scale); headings semibold (600), never 700.
- [ ] No visible text below `--cv-text-xs` (0.75rem, 12 px at standard scale).
- [ ] Sentence case everywhere; `cv-overline` is the only uppercase.
- [ ] No emoji, no exclamation mark. Buttons are verbs; status is declarative, present tense.
- [ ] Errors say what failed, why if known, and what to do next.
- [ ] Durations in a fixed format (`01:42:15` or `1h 42m`); counts never rounded in tables.

### Icons and motion
- [ ] Phosphor 2.1.x only (self-hosted from `@phosphor-icons/web`), regular by default, `cv-icon` sizing; decorative icons `aria-hidden="true"`.
- [ ] Motion only on overlays and toasts: 120 ms fade for menus and list boxes (`--cv-duration-fast`), 180 ms for modals and toasts, 280 ms for drawers, via the duration tokens. Buttons, inputs and rows change instantly. No loop, no shimmer.
- [ ] `prefers-reduced-motion: reduce` removes motion (handled by `bundle.css`).

### Markup
- [ ] Native elements first: `<button>`, `<a href>`, `<input>`, `<select>`, `<dialog>`, `popover`, `<fieldset>`/`<legend>`, `<table>`.
- [ ] The component's anatomy matches its page in `components/`; behaviour comes from `components/bundle.js`, not from a copy.

## 2. WCAG 2.2 AA, component criteria

| Criterion | Check |
| --- | --- |
| 1.1.1 Non-text content | Meaningful images and icon-only controls have a text alternative; decorative icons are hidden. |
| 1.3.1 Info and relationships | Labels tied to controls, groups in `<fieldset>`, tables with `<th scope>` and `<caption>`, landmarks, headings in order. |
| 1.3.5 Identify input purpose | Personal-data fields carry `autocomplete`. |
| 1.4.1 Use of color | Status, selection and links never rely on color alone (word, icon, underline, weight). |
| 1.4.3 Contrast (minimum) | Text 4.5:1 (3:1 at 24 px or bold 19 px) on its ground, in both themes. |
| 1.4.4 Resize text | Usable at 200 % zoom. |
| 1.4.10 Reflow | No two-dimensional scrolling at 320 px wide, except data tables in their own region. |
| 1.4.11 Non-text contrast | Control boundaries, focus indicators, selected states and meaningful icons 3:1 against adjacent colors. |
| 1.4.12 Text spacing | No loss of content with increased line, paragraph, letter and word spacing. |
| 1.4.13 Content on hover or focus | Tooltips and popovers are dismissable (Escape), hoverable and persistent. |
| 2.1.1 Keyboard | Everything works with the keyboard; scrollable regions are focusable. |
| 2.1.2 No keyboard trap | Focus can always leave; overlays close with Escape. |
| 2.1.4 Character key shortcuts | Single-key shortcuts can be turned off or work only on focus; global shortcuts use a modifier. |
| 2.2.1 Timing adjustable | Errors and warnings never auto-dismiss; timed toasts pause on hover and focus. |
| 2.3.1 Three flashes | Nothing flashes. |
| 2.4.3 Focus order | Tab order follows the reading order; focus returns to the opener when an overlay closes. |
| 2.4.6 Headings and labels | Headings and labels describe their content. |
| 2.4.7 Focus visible | A focus indicator is always visible. |
| 2.4.11 Focus not obscured (minimum) | The focused element is never fully hidden by the sticky top bar, a toast or an overlay. |
| 2.5.3 Label in name | The accessible name contains the visible label. |
| 2.5.7 Dragging movements | Anything done by dragging also works with a single click or tap. |
| 2.5.8 Target size (minimum) | Targets at least 24 × 24 px, or spaced so a 24 px circle around each touches no other. |
| 3.2.1 / 3.2.2 On focus, on input | Focusing or changing a control never changes context by itself. |
| 3.3.1 Error identification | Errors are described in text next to the field. |
| 3.3.2 Labels or instructions | Every field has a visible label; formats are stated in a hint. |
| 3.3.3 Error suggestion | The error says how to fix it. |
| 4.1.2 Name, role, value | Custom widgets expose role, name and state (`aria-expanded`, `aria-selected`, `aria-current`, `aria-invalid`). |
| 4.1.3 Status messages | Alerts and toasts are announced through `role="status"` or `role="alert"` without moving focus. |

### Criteria that belong to the application

Covenant components make these possible; each screen must still meet them.

| Criterion | Check |
| --- | --- |
| 2.4.1 Bypass blocks | A skip link to `<main>` on every page. |
| 2.4.2 Page titled | Each page has a unique `<title>`. |
| 3.1.1 Language of page | `<html lang>` set. |
| 3.2.3 / 3.2.4 Consistent navigation and identification | Sidebar order and component names are the same on every page. |
| 3.2.6 Consistent help | Help links sit in the same place on every page. |
| 3.3.4 Error prevention | Deleting or submitting important data can be reviewed, confirmed or undone. |
| 3.3.7 Redundant entry | Data entered earlier in a flow is not asked for again. |
| 3.3.8 Accessible authentication | Sign-in allows paste and password managers; no cognitive test. |
