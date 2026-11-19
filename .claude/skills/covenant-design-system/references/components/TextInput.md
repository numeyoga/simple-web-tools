A single-line text input at 32 px with a 3:1 boundary, optionally with a leading icon or in mono for codes and amounts.

## Anatomy

```html
<div class="cv-field">
  <label class="cv-label" for="ti-1">Project name</label>
  <input class="cv-input" id="ti-1" type="text" value="Covenant · Q2 launch">
</div>
<div class="cv-field">
  <label class="cv-label" for="ti-2">Search entries</label>
  <span class="cv-input-group"><i class="ph ph-magnifying-glass cv-icon" aria-hidden="true"></i><input class="cv-input" id="ti-2" type="search" placeholder="Description or project"></span>
</div>
<div class="cv-field">
  <label class="cv-label" for="ti-3">Duration</label>
  <input class="cv-input cv-input--mono" id="ti-3" type="text" value="01:42:15" inputmode="numeric">
</div>
```

## Classes and states

- `cv-input`: `cv-surface`, 1 px `cv-border-control` (3:1 or more, 1.4.11), 8 px radius, `min-height` 32 px.
- Focus: border and 2 px outline in `cv-border-focus`. Invalid: `cv-border-danger` border. Disabled: opacity 0.5.
- `cv-input-group` adds a leading icon; `cv-input--mono` sets IBM Plex Mono for codes, durations and amounts.

## Accessibility and keyboard

- Use the right `type` and `autocomplete` for personal data (1.3.5).
- Placeholder text is a sample in `cv-fg-subtle`, never the label.

## Use

- Wrap in `FormField` for label, hint and error.
- Durations in a fixed format: `01:42:15` or `1h 42m`.

**The consumer provides** the label, the value, the type and an optional icon.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Boundary 3:1 against its surface in both themes (1.4.11).
- [ ] Has a programmatic label (4.1.2).
- [ ] `autocomplete` set for user data (1.3.5).
