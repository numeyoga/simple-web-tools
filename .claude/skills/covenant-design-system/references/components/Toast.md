Toasts confirm the result of an action, bottom-right, on a raised surface; errors and warnings stay until dismissed.

## Anatomy

```html
<section class="cv-toast-region" aria-label="Notifications">
  <div class="cv-toast cv-toast--success" role="status"><i class="ph ph-check-circle cv-icon" aria-hidden="true"></i><div class="cv-toast__body"><div class="cv-toast__title">Entry saved · 1h 42m</div></div><button type="button" class="cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm" aria-label="Dismiss notification" data-cv-dismiss><i class="ph ph-x cv-icon" aria-hidden="true"></i></button></div>
  <div class="cv-toast cv-toast--warning" role="alert"><i class="ph ph-warning cv-icon" aria-hidden="true"></i><div class="cv-toast__body"><div class="cv-toast__title">Couldn't reach server.</div><div class="cv-toast__text">Retrying in 5 s.</div></div><button type="button" class="cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm" aria-label="Dismiss notification" data-cv-dismiss><i class="ph ph-x cv-icon" aria-hidden="true"></i></button></div>
</section>
<button type="button" class="cv-btn" onclick="Covenant.toast({ status: 'success', title: 'Entry saved · 1h 42m' })">Show a toast</button>
```

## Classes and states

- `cv-toast-region`: fixed bottom-right, 360 px wide, stack with 8 px gap. `cv-toast`: `cv-surface-raised`, `cv-border`, `cv-shadow-xl`, 180 ms entrance.
- Status icon in `cv-fg-<status>`; second line in `cv-fg-muted`.
- `Covenant.toast({ status, title, text, timeout })` creates one; success and info leave after 6 s, paused on hover or focus; warning and danger stay.

## Accessibility and keyboard

- Success and info toasts are `role="status"`; warnings and errors `role="alert"`.
- Dismiss button 28 px with `aria-label`.
- A toast never holds the only way to do something.

## Use

- Short and declarative: `Entry saved · 1h 42m`.
- A toast with an action never auto-dismisses.

**The consumer provides** the status, the title and an optional second line.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Announced by a live role (4.1.3).
- [ ] No time limit on errors; timed toasts pause on hover/focus (2.2.1).
- [ ] Dismiss target 28 px (2.5.8).
- [ ] Status by icon and words (1.4.1).
