An inline alert states a fact about the current view: success, warning, danger or info, always with an icon and a bold lead.

## Anatomy

```html
<div class="cv-alert cv-alert--success" role="status"><i class="ph ph-check-circle cv-icon" aria-hidden="true"></i><div class="cv-alert__body"><span class="cv-alert__title">Entry saved.</span> 1h 42m logged to Covenant · Q2 launch.</div></div>
<div class="cv-alert cv-alert--warning" role="status"><i class="ph ph-warning cv-icon" aria-hidden="true"></i><div class="cv-alert__body"><span class="cv-alert__title">Sync paused.</span> Reconnect to resume. <a href="#">Reconnect</a></div></div>
<div class="cv-alert cv-alert--danger" role="status"><i class="ph ph-x-circle cv-icon" aria-hidden="true"></i><div class="cv-alert__body"><span class="cv-alert__title">Couldn't save entry.</span> Session expired. Sign in again.</div></div>
<div class="cv-alert cv-alert--info" role="status"><i class="ph ph-info cv-icon" aria-hidden="true"></i><div class="cv-alert__body"><span class="cv-alert__title">Session syncs on stop.</span> Running timers persist across reloads.</div><button type="button" class="cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm" aria-label="Dismiss"><i class="ph ph-x cv-icon" aria-hidden="true"></i></button></div>
```

## Classes and states

- `cv-alert--{success|warning|danger}` (default info): `cv-<status>-surface`, `cv-<status>-border`, text and icon in `cv-fg-<status>`. All themed: dark alerts in dark mode.

## Accessibility and keyboard

- `role="status"` for information, `role="alert"` only for errors that appear after an action.
- A dismiss button is a `cv-btn--icon cv-btn--sm` (28 px) with `aria-label="Dismiss"`.

## Use

- Declarative, present tense. Never `Oops!`, never an exclamation mark, never emoji.
- Error copy: what failed, why, what to do next.
- Status colours are for status only.

**The consumer provides** the status, the lead sentence, the detail and an optional link or dismiss button.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Status carried by icon and words, not colour alone (1.4.1).
- [ ] Text 4.5:1 on its surface in both themes (1.4.3).
- [ ] Live role matches urgency (4.1.3).
- [ ] Dismiss target 28 px (2.5.8).
