A menu lists actions on an item; it opens from a button with the native popover API and is driven with the arrow keys.

## Anatomy

```html
<button type="button" class="cv-btn cv-btn--icon" popovertarget="mn-entry" aria-haspopup="menu" aria-expanded="false" aria-label="Entry actions"><i class="ph ph-dots-three cv-icon" aria-hidden="true"></i></button>
<div class="cv-menu" id="mn-entry" popover role="menu" aria-label="Entry actions">
  <button type="button" class="cv-menu__item" role="menuitem"><i class="ph ph-pencil-simple cv-icon" aria-hidden="true"></i>Edit</button>
  <button type="button" class="cv-menu__item" role="menuitem"><i class="ph ph-copy cv-icon" aria-hidden="true"></i>Duplicate</button>
  <hr class="cv-menu__sep">
  <button type="button" class="cv-menu__item cv-menu__item--danger" role="menuitem"><i class="ph ph-trash cv-icon" aria-hidden="true"></i>Delete</button>
</div>
```

## Classes and states

- `.cv-menu[popover]`: `cv-surface-raised`, `cv-shadow-md`, 8 px radius. `cv-menu__item` 32 px; `--danger` in `cv-fg-danger`; `cv-menu__sep` divider.
- bundle.js positions it under the button, syncs `aria-expanded`, focuses the first item and handles ↑/↓/Home/End.

## Accessibility and keyboard

- Popover API: Escape and outside click close it (light dismiss); focus returns to the button.
- Items are `role="menuitem"` buttons.
- Opens with a 120 ms fade (`cv-duration-fast`, `cv-ease-emphasize`), removed by `prefers-reduced-motion`.

## Use

- Verbs in sentence case. Destructive item last, after a separator.

**The consumer provides** the button label, the items and their handlers.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Operable with keyboard: arrows, Escape (2.1.1).
- [ ] `aria-haspopup` and `aria-expanded` on the button (4.1.2).
- [ ] Items at least 24 px high (2.5.8).
