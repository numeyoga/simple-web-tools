The Covenant lockup and mark: two arcs that meet around an orange point, beside the wordmark in IBM Plex Sans semibold.

## Anatomy

```html
<span class="cv-logo">
  <img class="cv-logo__light" src="../../assets/covenant-logo.svg" alt="Covenant">
  <img class="cv-logo__dark" src="../../assets/covenant-logo-dark.svg" alt="Covenant">
</span>
```

## Classes and states

- `cv-logo` holds both lockups and shows the one that matches `data-theme`: `covenant-logo.svg` in light, `covenant-logo-dark.svg` in dark. `covenant-mark.svg` (or the inline mark of `SidebarNav`) alone where space is tight.
- Centre point `cv-brand-accent` (`#ea580c` in light, `#fb923c` in dark). Inline, the mark's arcs are `currentColor` and its point uses `var(--cv-brand-accent)`, so it follows the theme.

## Accessibility and keyboard

- `alt="Covenant"`; empty `alt` when the name is written next to it.

## Use

- Never recolour, redraw or stretch the mark.

**The consumer provides** the surface and the height.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Text alternative (1.1.1).
- [ ] Logo on a surface it contrasts with: 3:1 or more for the arcs (1.4.11).
