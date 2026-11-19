A tooltip names an icon-only control or adds a short hint; it shows on hover and focus, stays while hovered and closes with Escape.

## Anatomy

```html
<span class="cv-tooltip-wrap">
  <button type="button" class="cv-btn cv-btn--icon" aria-label="Export"><i class="ph ph-download-simple cv-icon" aria-hidden="true"></i></button>
  <span class="cv-tooltip" role="tooltip">Export as CSV</span>
</span>
```

## Classes and states

- `cv-tooltip-wrap` holds the trigger and a `cv-tooltip` (`role="tooltip"`); `cv-tooltip--bottom` places it below. Fill `cv-neutral-900`, text `cv-neutral-0` (17.7:1) in both themes.
- bundle.js links it with `aria-describedby`, shows it on hover or focus, keeps it while the pointer is over it, hides it on Escape.

## Accessibility and keyboard

- Content on hover or focus is dismissable, hoverable and persistent (1.4.13).
- Never put interactive content or essential information only in a tooltip.

## Use

- One short phrase, no punctuation.
- An icon-only button still needs its `aria-label`; the tooltip adds a visible name.

**The consumer provides** the trigger and the text.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Escape hides it without moving focus; hovering the tooltip keeps it (1.4.13).
- [ ] Linked by `aria-describedby`.
