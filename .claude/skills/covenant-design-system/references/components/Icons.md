Covenant uses Phosphor Icons 2.1.x, regular weight by default and bold for emphasis, sized at 1em in `currentColor`.

## Anatomy

```html
<!-- Self-hosted, from your copy of @phosphor-icons/web 2.1.x -->
<link rel="stylesheet" href="phosphor/regular/style.css">
<link rel="stylesheet" href="phosphor/bold/style.css">
<i class="ph ph-timer cv-icon" aria-hidden="true"></i>
<i class="ph-bold ph-check cv-icon" aria-hidden="true"></i>
```

## Classes and states

- `cv-icon`: 1em, `vertical-align: -0.15em`, inherits `currentColor`; 16 px in text, 16 px in buttons.

## Accessibility and keyboard

- Decorative icons take `aria-hidden="true"`; an icon-only control has an `aria-label`.
- Status icons always come with a word.
- Self-host Phosphor: copy `src/regular` and `src/bold` from the `@phosphor-icons/web` npm package (any 2.1.x) and link their `style.css`; no CDN request.

## Use

- Regular by default; bold only for one level of emphasis.
- No emoji, no unicode glyphs as icons.
- Skip icons next to self-explanatory labels and in dense tables.

**The consumer provides** the icon name.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Meaningful icons have a text alternative (1.1.1).
- [ ] Icons that carry meaning reach 3:1 (1.4.11).
