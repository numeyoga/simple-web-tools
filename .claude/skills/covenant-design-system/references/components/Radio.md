Native radio buttons for one choice among a few, grouped in a fieldset.

## Anatomy

```html
<fieldset class="cv-fieldset">
  <legend class="cv-label">Rounding</legend>
  <label class="cv-check"><input type="radio" name="rounding" checked> Exact</label>
  <label class="cv-check"><input type="radio" name="rounding"> Nearest 15 minutes</label>
  <label class="cv-check"><input type="radio" name="rounding"> Nearest hour</label>
</fieldset>
```

## Classes and states

- Same `cv-check` label and 24 px target as `Checkbox`; checked: `cv-accent-fill` circle with a `cv-fg-on-accent` dot.

## Accessibility and keyboard

- Native radios: Tab enters the group, arrow keys move the choice.

## Use

- Always one option selected by default.
- More than five options: use `Select`.

**The consumer provides** the legend, the options and the selected value.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Same `name` for the group, `<fieldset>` with `<legend>` (1.3.1).
- [ ] Input target 24 × 24 px (2.5.8).
