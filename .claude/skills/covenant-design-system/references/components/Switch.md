A switch turns a setting on or off immediately; it is a native checkbox with `role="switch"`.

## Anatomy

```html
<label class="cv-check cv-switch"><input type="checkbox" role="switch" checked> Round durations</label>
<label class="cv-check cv-switch"><input type="checkbox" role="switch"> Email weekly report</label>
```

## Classes and states

- 36 × 24 px target drawing a 32 × 18 px track with a `cv-border-control` boundary on `cv-surface-2`; on: `cv-accent-fill` with a `cv-fg-on-accent` thumb.

## Accessibility and keyboard

- Native checkbox with `role="switch"`: Space toggles and the state is announced as on/off.

## Use

- The change applies at once; for settings saved with a form, use `Checkbox`.
- The label names the setting, not the state.

**The consumer provides** the label and the state.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] `role="switch"` on a native checkbox (4.1.2).
- [ ] Off state boundary 3:1, on state fill 3:1 against the surface (1.4.11).
