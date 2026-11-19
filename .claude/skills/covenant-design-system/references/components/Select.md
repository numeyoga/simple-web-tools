A native `<select>` styled like the text input, with a drawn chevron; use it for 2 to 15 known options.

## Anatomy

```html
<div class="cv-field">
  <label class="cv-label" for="se-1">Period</label>
  <span class="cv-select"><select class="cv-input" id="se-1">
    <option>Today</option><option selected>This week</option><option>This month</option>
  </select></span>
</div>
```

## Classes and states

- `cv-select` wraps a `select.cv-input` and draws the chevron in `cv-fg-muted`; the native list keeps keyboard and screen-reader support.

## Accessibility and keyboard

- Native `<select>`: arrow keys, type-ahead and Escape come from the browser.

## Use

- More than 15 options or free text: use `Combobox`.
- Two or three always-visible choices: use `SegmentedControl` or `Radio`.

**The consumer provides** the label, the options and the selected value.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Native `<select>` with a visible label (1.3.1, 4.1.2).
- [ ] Boundary 3:1 (1.4.11).
