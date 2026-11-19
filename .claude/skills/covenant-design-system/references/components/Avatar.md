Avatars show a person as a photo or initials in a circle at 24, 32 or 40 px.

## Anatomy

```html
<span class="cv-avatar cv-avatar--sm" role="img" aria-label="Marie Dubois">MD</span>
<span class="cv-avatar" role="img" aria-label="Léo Martin">LM</span>
<span class="cv-avatar cv-avatar--lg" role="img" aria-label="Ana Costa">AC</span>
```

## Classes and states

- `cv-avatar` 32 px; `--sm` 24 px, `--lg` 40 px. Initials in `cv-fg` on `cv-surface-3` (14.0:1 light, 11.0:1 dark); a photo fills the circle.

## Accessibility and keyboard

- Initials: `role="img"` with the full name as `aria-label`. Photo: `<img alt="Full name">`; empty `alt` when the name is written beside it.

## Use

- Full radius only on avatars and status badges.

**The consumer provides** the name and an optional photo.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Text alternative with the full name (1.1.1).
- [ ] Initials 4.5:1 on their fill (1.4.3).
