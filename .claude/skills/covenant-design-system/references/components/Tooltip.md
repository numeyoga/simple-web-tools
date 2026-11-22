A tooltip names an icon-only control or adds a short hint; it shows on hover and focus, stays while hovered and closes with Escape.

## Anatomy

Two forms, with the same behaviour. The wrapper form:

```html
<span class="cv-tooltip-wrap">
  <button type="button" class="cv-btn cv-btn--icon" aria-label="Export"><i class="ph ph-download-simple cv-icon" aria-hidden="true"></i></button>
  <span class="cv-tooltip" role="tooltip">Export as CSV</span>
</span>
```

The attribute form, for a trigger that cannot take a wrapper (a topbar, a toolbar, a grid cell):

```html
<button type="button" class="cv-btn cv-btn--icon" aria-label="Export" data-cv-tooltip="Export as CSV"><i class="ph ph-download-simple cv-icon" aria-hidden="true"></i></button>
```

`Covenant.init` creates the `cv-tooltip` right after the trigger (after its menu when it has a `popovertarget`, after the button around it when the trigger is an icon inside a button). From script, `Covenant.setTooltip(trigger, text)` sets or changes the text (an empty text removes the tooltip) and wires the trigger at once when it is in the document, otherwise `Covenant.init(container)` does it once the container is mounted. `Covenant.hideTooltips()` hides the tooltip being shown, for a view that changes or a menu that opens.

## Classes and states

- `cv-tooltip-wrap` holds the trigger and a `cv-tooltip` (`role="tooltip"`); `cv-tooltip--bottom` (or `data-cv-tooltip-side="bottom"` on the trigger of the attribute form) asks for the tooltip below, where it is tried first. Fill `cv-surface-inverse`, text `cv-fg-inverse`: a dark bubble in light, a light bubble in dark, so it always stands out from the page (17.7:1 and 18.2:1).
- covenant.js places the tooltip with `position: fixed` from the rect of its trigger (`data-cv-placed`): centred, above the trigger or below it, on the side that has room, and kept inside the window. Where the browser has the Popover API it is a `popover="manual"` element, so it sits in the top layer and no scrolling or clipping ancestor (a sidebar, a transformed drawer) cuts it off. Text longer than 18rem wraps.
- One tooltip is shown at a time. It opens on keyboard focus and on hover (at once in the wrapper form, after 300 ms in the attribute form, so that moving across a toolbar does not flash), stays while the pointer is over the trigger or the tooltip, and hides on Escape, on a click or a press on the trigger, when the trigger is scrolled out of view, and does not open while the trigger's menu is open (`aria-expanded="true"`). It is not shown for a touch.
- Linking: the wrapper form adds `aria-describedby`. The attribute form adds nothing when the text is the trigger's own accessible name (no duplicate announcement), `aria-labelledby` when the trigger has no name, `aria-describedby` otherwise.
- `Covenant.placeTooltip(anchor, size, viewport, prefer, gap)` is the pure placement (rects in, `{ left, top, side }` out), for tests.

## Accessibility and keyboard

- Content on hover or focus is dismissable, hoverable and persistent (1.4.13). Escape closes the tooltip first: a dialog or menu around the trigger stays open until the next Escape.
- Never put interactive content or essential information only in a tooltip.

## Use

- One short phrase, no punctuation.
- An icon-only button still needs its `aria-label`; the tooltip adds a visible name.

**The consumer provides** the trigger and the text.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Escape hides it without moving focus; hovering the tooltip keeps it (1.4.13).
- [ ] Linked to its trigger (`aria-describedby`, or `aria-labelledby` when the trigger has no name).
- [ ] Not cut off by a scrolling or clipping ancestor, and on the side that has room, at 320 px and in a sidebar.
