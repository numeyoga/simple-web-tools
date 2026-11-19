A drawer slides in from the right to show or edit the details of an item without leaving the list; it is a native modal `<dialog>`.

## Anatomy

```html
<button type="button" class="cv-btn" data-cv-open="dr-entry">Open entry</button>
<dialog class="cv-drawer" id="dr-entry" aria-labelledby="dr-entry-title">
  <header class="cv-drawer__header"><h2 class="cv-drawer__title" id="dr-entry-title">Entry details</h2><button type="button" class="cv-btn cv-btn--ghost cv-btn--icon" aria-label="Close" data-cv-close><i class="ph ph-x cv-icon" aria-hidden="true"></i></button></header>
  <div class="cv-drawer__body">
    <div class="cv-field"><label class="cv-label" for="dr-entry-desc">Description</label><input class="cv-input" id="dr-entry-desc" type="text" value="Token audit · colors"></div>
    <div class="cv-field"><label class="cv-label" for="dr-entry-dur">Duration</label><input class="cv-input cv-input--mono" id="dr-entry-dur" type="text" value="01:48:00"></div>
  </div>
  <footer class="cv-drawer__footer"><button type="button" class="cv-btn" data-cv-close>Cancel</button><button type="button" class="cv-btn cv-btn--primary" data-cv-close value="save">Save</button></footer>
</dialog>
```

## Classes and states

- `dialog.cv-drawer`: right edge, 420 px max, full height, 280 ms slide; same header, body and footer parts as `Modal`.

## Accessibility and keyboard

- Same as `Modal`: focus inside, Escape closes, focus returns to the opener.

## Use

- Use for details and edits; use `Modal` for decisions.

**The consumer provides** the title, the content, the actions and the opener.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Escape closes and focus returns (2.1.2, 2.4.3).
- [ ] Labelled by its title (4.1.2).
- [ ] Usable at 320 px: full width below 420 px (1.4.10).
