Breadcrumbs show where the page sits in the hierarchy; ancestors are links and the current page is plain text.

## Anatomy

```html
<nav class="cv-breadcrumbs" aria-label="Breadcrumb">
  <ol>
    <li><a href="#">Projects</a></li>
    <li><a href="#">Covenant · Q2 launch</a></li>
    <li><span aria-current="page">Design system tokens</span></li>
  </ol>
</nav>
```

## Classes and states

- `cv-breadcrumbs`: ordered list; the separator is drawn in CSS in `cv-fg-subtle`; links `cv-fg-muted`, current page `cv-fg` medium.

## Accessibility and keyboard

- `<nav aria-label="Breadcrumb">`, `<ol>`, `aria-current="page"` on the last item.

## Use

- Sentence case. Shorten middle levels before the current page.

**The consumer provides** the ordered crumbs and their links.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Landmark labelled; current page marked (1.3.1).
- [ ] Wraps at 320 px without horizontal scroll (1.4.10).
