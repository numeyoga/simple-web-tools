An empty state explains why a view has no content and offers the next action.

## Anatomy

```html
<div class="cv-empty">
  <span class="cv-empty__icon"><i class="ph ph-clock-countdown cv-icon" aria-hidden="true"></i></span>
  <p class="cv-empty__title">No entries yet</p>
  <p>Start the timer or add time by hand.</p>
  <button type="button" class="cv-btn cv-btn--primary"><i class="ph ph-plus cv-icon" aria-hidden="true"></i> New entry</button>
</div>
```

## Classes and states

- `cv-empty`: dashed `cv-border-strong`, centred. Its sentences (`p`) keep a `1em` vertical margin on top of the flex gap, the browser's own margin that the reset removed; set `margin: 0` on one to close the gap. `cv-empty__icon`: 44 px tile in `cv-surface-2`, 8 px radius.

## Accessibility and keyboard

- The title is text, not only an icon.

## Use

- Say what is missing and what to do: `No tasks. Press N to create one.`
- One primary action at most.

**The consumer provides** the icon, the title, the sentence and the action.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Text explains the state without the icon (1.1.1).
- [ ] Action reachable by keyboard.
