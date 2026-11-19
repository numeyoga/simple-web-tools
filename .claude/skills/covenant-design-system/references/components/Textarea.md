A multi-line text input that grows vertically, with the same boundary, focus and error states as the text input.

## Anatomy

```html
<div class="cv-field">
  <label class="cv-label" for="ta-1">Notes</label>
  <textarea class="cv-input" id="ta-1" rows="3" aria-describedby="ta-1-hint">Token audit, colors.</textarea>
  <span class="cv-hint" id="ta-1-hint">Visible to your team only.</span>
</div>
```

## Classes and states

- `textarea.cv-input`: three rows minimum, resizable vertically only.

## Accessibility and keyboard

- Label and hint linked as in `FormField`.

## Use

- Use for free text longer than one line; prefer a text input otherwise.

**The consumer provides** the label, the value and an optional hint.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Visible label (3.3.2).
- [ ] Boundary 3:1 (1.4.11).
- [ ] Resizing never hides the label or hint.
