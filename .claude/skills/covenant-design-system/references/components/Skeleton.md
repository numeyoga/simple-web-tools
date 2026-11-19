Skeletons hold the place of content while it loads; they are static blocks in `cv-surface-3`, with no shimmer.

## Anatomy

```html
<div class="cv-card" aria-busy="true">
  <span class="cv-sr-only">Loading project</span>
  <span class="cv-skeleton cv-skeleton--title"></span>
  <span class="cv-skeleton cv-skeleton--text"></span>
  <span class="cv-skeleton cv-skeleton--text" style="width:70%"></span>
</div>
```

## Classes and states

- `cv-skeleton` (0.75rem), `--text` (0.625rem), `--title` (1rem, 40 %), `--avatar` (2rem circle). No gradient, no animation.

## Accessibility and keyboard

- The loading container carries `aria-busy="true"` and a `cv-sr-only` text naming what loads; remove both when content arrives.

## Use

- Use for loads over 300 ms; match the real layout so nothing jumps.

**The consumer provides** the container and the expected shape.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] No flashing or looping motion (2.3.1, 2.2.2).
- [ ] Loading state exposed with `aria-busy`.
