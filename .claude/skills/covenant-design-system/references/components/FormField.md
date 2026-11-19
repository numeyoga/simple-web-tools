A form field wraps one control with its label, an optional hint and an error message, all linked for assistive technology.

## Anatomy

```html
<div class="cv-field">
  <label class="cv-label" for="ff-name">Project name<span class="cv-required" aria-hidden="true">*</span></label>
  <input class="cv-input" id="ff-name" type="text" required aria-describedby="ff-name-hint">
  <span class="cv-hint" id="ff-name-hint">Shown on invoices and reports.</span>
</div>
<div class="cv-field">
  <label class="cv-label" for="ff-rate">Hourly rate</label>
  <input class="cv-input cv-input--mono" id="ff-rate" type="text" value="12O" aria-invalid="true" aria-describedby="ff-rate-error">
  <span class="cv-error" id="ff-rate-error"><i class="ph ph-warning-circle cv-icon" aria-hidden="true"></i>Couldn't read the rate. Use digits only, for example 120.</span>
</div>
```

## Classes and states

- `cv-field`: column, 4 px gap. `cv-label`: 12 px medium, `cv-fg-muted`. `cv-required`: `cv-fg-danger` asterisk.
- `cv-hint`: 12 px `cv-fg-subtle`. `cv-error`: 12 px `cv-fg-danger` with a warning icon.
- Invalid control: `aria-invalid="true"` turns the border to `cv-border-danger` (8.0:1 light, 6.5:1 dark on `cv-surface`).

## Accessibility and keyboard

- Every control has a visible `<label for>`; placeholders never replace labels (3.3.2).
- Hint and error are linked with `aria-describedby`; the error says what failed and how to fix it (3.3.1, 3.3.3).
- Required fields carry `required` (announced) plus the visual asterisk, hidden from assistive technology.

## Use

- Label above the field, sentence case, no colon.
- Error copy in three parts: what failed, why if known, what to do next.
- Validate on submit or on blur, never on every keystroke.

**The consumer provides** the label, the control, the hint and the error text.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Visible label tied to the control by `for`/`id` (1.3.1, 3.3.2).
- [ ] Error shown in text and with an icon, not by colour alone (1.4.1, 3.3.1).
- [ ] `aria-invalid` and `aria-describedby` set when an error shows.
- [ ] Required state exposed with `required`.
