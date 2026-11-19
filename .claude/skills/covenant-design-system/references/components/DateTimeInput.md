Dates and times use the native `date`, `time` and `datetime-local` inputs, set in mono, with the browser picker.

## Anatomy

```html
<div class="cv-field">
  <label class="cv-label" for="dt-1">Day</label>
  <input class="cv-input" id="dt-1" type="date" value="2026-04-18">
</div>
<div class="cv-field">
  <label class="cv-label" for="dt-2">Start</label>
  <input class="cv-input" id="dt-2" type="time" value="14:32">
</div>
```

## Classes and states

- `input.cv-input[type=date|time|datetime-local]`: IBM Plex Mono; `color-scheme` follows the theme so the native picker is dark in dark mode.

## Accessibility and keyboard

- The native picker is keyboard and screen-reader accessible; the field also accepts typed input.

## Use

- Store ISO values; show absolute dates as `Apr 18, 2026 · 14:32` outside inputs.

**The consumer provides** the label and the ISO value.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Native input with a visible label (1.3.1, 3.3.2).
- [ ] Typed entry possible: no drag or pointer-only picker (2.5.7).
