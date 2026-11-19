A modal asks for a decision or a short form on top of the page; it is a native `<dialog>` opened with `showModal()`.

## Anatomy

```html
<button type="button" class="cv-btn cv-btn--danger" data-cv-open="md-delete">Delete entries</button>
<dialog class="cv-modal" id="md-delete" aria-labelledby="md-delete-title">
  <header class="cv-modal__header"><h2 class="cv-modal__title" id="md-delete-title">Delete 3 entries?</h2><button type="button" class="cv-btn cv-btn--ghost cv-btn--icon" aria-label="Close" data-cv-close><i class="ph ph-x cv-icon" aria-hidden="true"></i></button></header>
  <div class="cv-modal__body"><p>This removes 4h 12m from Covenant · Q2 launch. You can't undo it.</p></div>
  <footer class="cv-modal__footer"><button type="button" class="cv-btn" data-cv-close>Cancel</button><button type="button" class="cv-btn cv-btn--danger" data-cv-close value="delete">Delete entries</button></footer>
</dialog>
```

## Classes and states

- `dialog.cv-modal`: 480 px max, `cv-radius-lg` (12 px), `cv-shadow-lg`, scrim `cv-overlay`; footer on `cv-surface-2`; 180 ms entrance.
- `data-cv-open="<id>"` opens it, `data-cv-close` closes it (its `value` becomes `dialog.returnValue`); a backdrop click closes it.

## Accessibility and keyboard

- Native `<dialog>`: focus moves inside, the page is inert, Escape closes, focus returns to the opener.
- Title in an `<h2>` referenced by `aria-labelledby`.

## Use

- Title as a question or an action: `Delete 3 entries?`
- Buttons: secondary `Cancel` first, the action last and named by its verb.
- Never stack modals.

**The consumer provides** the title, the body, the actions and the opener.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Opened with `showModal()`; Escape closes; focus returns to the opener (2.1.2, 2.4.3).
- [ ] Labelled by its title (4.1.2).
- [ ] Close button has an `aria-label`.
