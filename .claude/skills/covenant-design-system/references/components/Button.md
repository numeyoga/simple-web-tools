Buttons trigger an action: primary, secondary (default), ghost and danger, at 32 px (default) or 28 px (`cv-btn--sm`).

## Anatomy

```html
<button type="button" class="cv-btn cv-btn--primary">Save</button>
<button type="button" class="cv-btn">Cancel</button>
<button type="button" class="cv-btn cv-btn--ghost">Skip</button>
<button type="button" class="cv-btn cv-btn--danger">Delete project</button>
<button type="button" class="cv-btn cv-btn--primary"><i class="ph ph-plus cv-icon" aria-hidden="true"></i> New entry</button>
<button type="button" class="cv-btn cv-btn--icon" aria-label="More actions"><i class="ph ph-dots-three cv-icon" aria-hidden="true"></i></button>
<button type="button" class="cv-btn cv-btn--primary" aria-disabled="true">Export</button>
```

## Classes and states

- `cv-btn` alone is the secondary button: `cv-surface` with a `cv-border-strong` border.
- `cv-btn--primary`: `cv-accent-fill` + `cv-fg-on-accent`, vivid orange with white text in both themes (4.65:1); hover `cv-accent-fill-hover` (5.18:1), pressed `cv-accent-fill-pressed` (7.31:1).
- `cv-btn--ghost`: no fill; hover `cv-surface-2`, pressed `cv-surface-3`.
- `cv-btn--danger`: `cv-danger-fill` + `cv-fg-on-danger`, deep crimson with white text (8.02:1), darker and cooler than primary so the two never look alike; hover `cv-danger-fill-hover` (9.57:1), pressed `cv-danger-fill-pressed` (12.16:1).
- `cv-btn--icon`: square, for an icon alone. `cv-btn--sm`: 28 px.
- Hover moves one step, pressed two steps. No transform, no opacity, no glow, no transition.
- Disabled: `aria-disabled="true"` (stays focusable and announced) or `disabled`; opacity 0.5, `cursor: not-allowed`; the colour never changes.

## Accessibility and keyboard

- Use `<button type="button">` for actions and `<a class="cv-btn">` only to navigate.
- An icon-only button has an `aria-label` that names the action; decorative icons take `aria-hidden="true"`.
- Focus: 2 px `cv-border-focus` outline, 2 px offset, on `:focus-visible`.
- Height is a minimum (`min-height`), so 200 % zoom and text-spacing overrides never clip the label.

## Use

- Label with a verb in sentence case: `Save`, `Export CSV`, `Delete project`. Never `Click here`, never Title Case.
- One primary button per view or dialog.
- Skip the icon next to self-explanatory labels (`Save`, `Cancel`).
- Never put text on `cv-brand-accent`, and never style a button with a primitive token (`cv-accent-*`, `cv-neutral-*`…).

**The consumer provides** the label, the variant, an optional Phosphor icon and the handler.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Uses `<button>` (or `<a>` for navigation) with a visible or `aria-label` name containing the visible text (2.5.3).
- [ ] Primary and danger use the fill tokens, never a primitive token or a literal colour.
- [ ] Target at least 24 × 24 px (2.5.8): the 28 px small size is the floor.
- [ ] Disabled buttons use `aria-disabled="true"` or `disabled`, keep their colour, and do nothing when activated.
- [ ] Focus ring visible in both themes.
