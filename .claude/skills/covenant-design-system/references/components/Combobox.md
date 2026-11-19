A combobox filters a long list as you type and lets you pick with the arrow keys; Escape closes the list.

## Anatomy

```html
<div class="cv-field">
  <label class="cv-label" for="cb-1">Project</label>
  <div class="cv-combobox">
    <input class="cv-input" id="cb-1" type="text" role="combobox" aria-expanded="false" aria-controls="cb-1-list" autocomplete="off">
    <ul class="cv-listbox" id="cb-1-list" role="listbox" aria-label="Projects" hidden>
      <li class="cv-option" role="option" data-value="p1">Covenant · Q2 launch</li>
      <li class="cv-option" role="option" data-value="p2">Orion invoicing</li>
      <li class="cv-option" role="option" data-value="p3">Helios ops console</li>
      <li class="cv-option" role="option" data-value="p4">Internal tools</li>
      <li class="cv-listbox__empty" hidden>No matches.</li>
    </ul>
  </div>
</div>
```

## Classes and states

- `cv-combobox` holds an input (`role="combobox"`) and a `cv-listbox`; the active option takes `cv-bg-accent-subtle`, the selected one a check mark.
- bundle.js filters options, manages `aria-expanded`, `aria-activedescendant`, `aria-selected` and fires `cv:change` with `{ value }`.

## Accessibility and keyboard

- Keyboard: type to filter, ↓/↑ to move, Enter to pick, Escape to close the list.
- The list closes when focus leaves.

## Use

- Use for more than 15 options or a searchable list; otherwise `Select`.

**The consumer provides** the label, the options (with `data-value`) and a `cv:change` listener.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] `role="combobox"`, `aria-controls`, `aria-expanded` and `aria-activedescendant` kept in sync (4.1.2).
- [ ] Fully operable with the keyboard; Escape closes (2.1.1, 2.1.2).
- [ ] Options at least 24 px high (2.5.8).
