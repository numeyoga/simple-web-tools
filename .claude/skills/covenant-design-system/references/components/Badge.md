Badges label a status or a category: status pills with a dot and a word, or square tags for versions and metadata.

## Anatomy

```html
<span class="cv-badge cv-badge--success"><span class="cv-badge__dot"></span>Running</span>
<span class="cv-badge cv-badge--warning"><span class="cv-badge__dot"></span>Pending</span>
<span class="cv-badge cv-badge--danger"><span class="cv-badge__dot"></span>Overdue</span>
<span class="cv-badge cv-badge--info"><span class="cv-badge__dot"></span>Synced</span>
<span class="cv-badge cv-badge--accent"><span class="cv-badge__dot"></span>Active</span>
<span class="cv-badge"><span class="cv-badge__dot"></span>Draft</span>
<span class="cv-tag cv-tag--mono">v2.4.1</span>
<span class="cv-tag">Internal</span>
```

## Classes and states

- `cv-badge`: full radius, 12 px (`cv-text-xs`) medium; neutral by default (`cv-surface-2`, `cv-fg-muted`).
- `cv-badge--success|warning|danger|info`: themed `cv-<status>-surface/-border` + `cv-fg-<status>`; `cv-badge--accent`: `cv-bg-accent-subtle` + `cv-fg-accent`.
- `cv-tag`: 4 px radius, outlined; `cv-tag--mono` for versions and IDs.

## Accessibility and keyboard

- A badge is text: the word carries the status, the dot is decoration.

## Use

- Sentence case, one or two words.
- `Active` takes the accent tint; semantic colours stay for status.

**The consumer provides** the label and the status.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Word present: status never shown by the dot colour alone (1.4.1).
- [ ] Text 4.5:1 on its fill in both themes (1.4.3).
