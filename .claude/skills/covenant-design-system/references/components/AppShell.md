The app shell lays out every page: a fixed 14.5rem sidebar and a 3rem top bar from 1024 px, an off-canvas drawer below, and content that reflows to one column.

## Anatomy

```html
<div class="cv-shell">
  <a class="cv-skip-link" href="#shell-main">Skip to content</a>
  <nav class="cv-sidebar" id="shell-nav" aria-label="Main">
    <div class="cv-sidebar__brand"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><g transform="translate(2,2)"><path d="M 18 4 A 14 14 0 1 0 18 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M 18 10 A 8 8 0 1 1 18 26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="18" r="2" fill="var(--cv-accent-500)"/></g></svg>Covenant</div>
    <ul>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-timer cv-icon" aria-hidden="true"></i>Timer</a></li>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-list-checks cv-icon" aria-hidden="true"></i>Today</a></li>
    <li><a class="cv-nav-item" href="#" aria-current="page"><i class="ph ph-folder-open cv-icon" aria-hidden="true"></i>Projects</a></li>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-chart-bar cv-icon" aria-hidden="true"></i>Reports</a></li>
    </ul>
  </nav>
  <div class="cv-shell__scrim"></div>
  <div class="cv-shell__main">
    <header class="cv-topbar">
      <button type="button" class="cv-btn cv-btn--ghost cv-btn--icon cv-shell__menu" data-cv-nav-toggle aria-controls="shell-nav" aria-expanded="false" aria-label="Menu"><i class="ph ph-list cv-icon" aria-hidden="true"></i></button>
      <h1 class="cv-topbar__title">Projects</h1>
      <span class="cv-topbar__spacer"></span>
      <button type="button" class="cv-search" aria-label="Search"><i class="ph ph-magnifying-glass cv-icon" aria-hidden="true"></i><span class="cv-search__label">Search</span><kbd class="cv-kbd">⌘K</kbd></button>
    </header>
    <main class="cv-shell__content" id="shell-main" tabindex="-1">
      <div class="cv-grid">
        <section class="cv-card cv-span-4"><h2 class="cv-card__title">This week</h2><span class="cv-num">22h 45m</span></section>
        <section class="cv-card cv-span-4"><h2 class="cv-card__title">Billable</h2><span class="cv-num">18h 10m</span></section>
      </div>
    </main>
  </div>
</div>
```

## Classes and states

- `cv-shell`: grid of sidebar and `cv-shell__main`. `cv-shell__content`: 90rem max, centred, `cv-space-7` padding (`cv-space-5` below 1024 px).
- Below 1024 px the sidebar slides in from the left over `cv-overlay` when `[data-cv-nav-toggle]` is pressed; `cv-shell__menu` appears in the top bar.
- `cv-grid`: 8 columns, 16 px gutter, `cv-span-2|4|8`; one column below 768 px.

## Accessibility and keyboard

- At 320 px CSS width nothing scrolls horizontally except data tables in their own region (1.4.10).
- The menu button has `aria-controls` and `aria-expanded`; Escape and a scrim click close the drawer and focus returns to the button.
- Landmarks: `<nav>`, `<header>`, `<main>`; a `cv-skip-link` to `<main>` appears on the first Tab (2.4.1).

## Use

- Wider screens get gutter space, not wider tables.
- Keep the sidebar order identical on every page.

**The consumer provides** the navigation items, the page title and the content.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] No horizontal scroll at 320 px, 400 % zoom (1.4.10).
- [ ] Skip link first in the tab order (2.4.1).
- [ ] Landmarks present once each (1.3.1).
- [ ] Drawer closes with Escape; focus returns (2.1.2).
- [ ] Consistent navigation order (3.2.3).
