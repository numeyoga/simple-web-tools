Native checkboxes in a labelled fieldset; checked boxes fill with `cv-accent-fill`.

## Anatomy

```html
<fieldset class="cv-fieldset">
  <legend class="cv-label">Export</legend>
  <label class="cv-check"><input type="checkbox" checked> Billable entries</label>
  <label class="cv-check"><input type="checkbox"> Archived projects</label>
  <label class="cv-check"><input type="checkbox" disabled> Team members (admin only)</label>
</fieldset>
```

## Classes and states

- `cv-check` is the label wrapping the input. The input is a 24 px target (2.5.8) drawing a 16 px box with a `cv-border-control` boundary; checked and indeterminate fill with `cv-accent-fill` and a `cv-fg-on-accent` mark. Disabled: opacity 0.5.

## Accessibility and keyboard

- Native `<input type="checkbox">`: Space toggles. A group sits in a `<fieldset>` with a `<legend>`.

## Use

- Label to the right, sentence case, phrased positively.
- One checkbox alone for a yes/no setting that applies on save; use `Switch` for an immediate toggle.

**The consumer provides** the legend, each label and the checked state.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Native input inside its `<label>` (1.3.1, 4.1.2).
- [ ] Group in a `<fieldset>` with `<legend>`.
- [ ] Input target 24 × 24 px (2.5.8).
- [ ] Unchecked boundary 3:1 (1.4.11).
