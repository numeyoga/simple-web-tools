The top bar is 3rem (48 px at standard scale) high and holds the page title, the search that opens the command menu and the account actions.

## Anatomy

```html
<header class="cv-topbar">
  <h1 class="cv-topbar__title">Projects</h1>
  <span class="cv-topbar__spacer"></span>
  <button type="button" class="cv-search" aria-label="Search"><i class="ph ph-magnifying-glass cv-icon" aria-hidden="true"></i><span class="cv-search__label">Search</span><kbd class="cv-kbd">⌘K</kbd></button>
  <button type="button" class="cv-btn cv-btn--ghost cv-btn--icon" aria-label="Notifications"><i class="ph ph-bell cv-icon" aria-hidden="true"></i></button>
  <span class="cv-avatar" role="img" aria-label="Signed in as Marie Dubois">MD</span>
</header>
```

## Classes and states

- `cv-topbar`: `cv-surface`, `cv-border` bottom, `min-height` `--cv-topbar-h` (3rem). `cv-search`: `cv-border-control` boundary on `cv-surface-2`; below 768 px it shrinks to its icon, so it carries `aria-label="Search"`.

## Accessibility and keyboard

- The page title is the `<h1>`.
- Icon buttons have an `aria-label`; the avatar has a text alternative.

## Use

- One title, no breadcrumb duplication: use `Breadcrumbs` in the content.

**The consumer provides** the title, the search handler and the account menu.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Page has one `<h1>` (1.3.1, 2.4.6).
- [ ] Icon-only controls named (4.1.2).
- [ ] Sticky bar never hides the focused element (2.4.11): content uses `scroll-padding-top: 48px`.
