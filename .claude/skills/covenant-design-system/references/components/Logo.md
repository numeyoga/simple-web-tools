The Covenant lockup and mark: two arcs that meet around an orange point, beside the wordmark in IBM Plex Sans semibold.

## Anatomy

```html
<img src="../../assets/covenant-logo.svg" alt="Covenant" height="34">
<img src="../../assets/covenant-logo-dark.svg" alt="Covenant" height="34">
<img src="../../assets/covenant-mark.svg" alt="Covenant" height="34">
```

## Classes and states

- `covenant-logo.svg` on light surfaces, `covenant-logo-dark.svg` on dark ones, `covenant-mark.svg` alone where space is tight.
- Centre point `cv-accent-500` (`#ea580c`) in light, `cv-accent-400` (`#fb923c`) on dark. The mark's arcs are `currentColor`, black inside an `<img>`: inline the SVG to colour them.

## Accessibility and keyboard

- `alt="Covenant"`; empty `alt` when the name is written next to it.

## Use

- Never recolour, redraw or stretch the mark.

**The consumer provides** the surface and the height.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Text alternative (1.1.1).
- [ ] Logo on a surface it contrasts with: 3:1 or more for the arcs (1.4.11).
