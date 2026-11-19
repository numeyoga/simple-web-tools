Cards group the summary of one object: a title, metadata and an optional footer; a card that opens the object is a link.

## Anatomy

```html
<a class="cv-card" href="#">
  <h3 class="cv-card__title">Covenant · Q2 launch</h3>
  <span class="cv-card__meta">Internal · 12 tasks</span>
  <div class="cv-card__footer"><span class="cv-badge cv-badge--success"><span class="cv-badge__dot"></span>Active</span><span class="cv-num">14h 22m</span></div>
</a>
```

## Classes and states

- `cv-card`: `cv-surface`, 1 px `cv-border`, 8 px radius, `cv-shadow-sm`, 20 px padding (`--compact` 16, `--prominent` 24). A link card hovers to `cv-surface-2` with `cv-border-strong`.

## Accessibility and keyboard

- A clickable card is one `<a>` (or contains one link), never a `<div>` with a click handler.
- The title is a heading at the right level.

## Use

- Never both a strong shadow and a strong border.
- Cards sit on `cv-bg`; never nest cards.

**The consumer provides** the title, the metadata and the destination.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Whole card reachable as one link with a meaningful name (2.4.4).
- [ ] Text colour set explicitly (`cv-fg`), legible in both themes (1.4.3).
