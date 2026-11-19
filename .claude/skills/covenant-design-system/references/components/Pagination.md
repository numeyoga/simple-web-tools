Pagination moves through pages of a long list; the current page is filled with the accent.

## Anatomy

```html
<nav class="cv-pagination" aria-label="Pagination">
  <ul>
    <li><span class="cv-page" aria-disabled="true"><i class="ph ph-caret-left cv-icon" aria-hidden="true"></i><span class="cv-sr-only">Previous page</span></span></li>
    <li><a class="cv-page" href="#" aria-current="page" aria-label="Page 1">1</a></li>
    <li><a class="cv-page" href="#" aria-label="Page 2">2</a></li>
    <li><a class="cv-page" href="#" aria-label="Page 3">3</a></li>
    <li><span class="cv-pagination__gap" aria-hidden="true">…</span></li>
    <li><a class="cv-page" href="#" aria-label="Page 12">12</a></li>
    <li><a class="cv-page" href="#" aria-label="Next page"><i class="ph ph-caret-right cv-icon" aria-hidden="true"></i></a></li>
  </ul>
</nav>
```

## Classes and states

- `cv-page`: 28 px, `cv-border`; current: `cv-accent-fill` + `cv-fg-on-accent`; a disabled arrow is a `<span aria-disabled="true">` with a `cv-sr-only` name, opacity 0.5.

## Accessibility and keyboard

- `<nav aria-label="Pagination">`; current page has `aria-current="page"`; previous and next links have `aria-label`.

## Use

- Show first, last, current and its neighbours; collapse the rest to an ellipsis.

**The consumer provides** the page count, the current page and the links.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Every link named, including arrows (2.4.4, 4.1.2).
- [ ] Targets 28 px (2.5.8).
- [ ] Current page marked with `aria-current` (1.3.1).
