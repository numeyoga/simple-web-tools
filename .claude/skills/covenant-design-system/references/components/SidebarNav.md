The sidebar is the main navigation: 14.5rem (232 px at standard scale) wide, the logo, then icon and label links grouped under overline headings.

## Anatomy

```html
<nav class="cv-sidebar" aria-label="Main">
  <div class="cv-sidebar__brand"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><g transform="translate(2,2)"><path d="M 18 4 A 14 14 0 1 0 18 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M 18 10 A 8 8 0 1 1 18 26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="18" r="2" fill="var(--cv-brand-accent)"/></g></svg>Covenant</div>
  <ul>
    <li><a class="cv-nav-item" href="#" aria-current="page"><i class="ph ph-timer cv-icon" aria-hidden="true"></i>Timer</a></li>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-list-checks cv-icon" aria-hidden="true"></i>Today</a></li>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-folder-open cv-icon" aria-hidden="true"></i>Projects</a></li>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-clock-countdown cv-icon" aria-hidden="true"></i>Entries</a></li>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-chart-bar cv-icon" aria-hidden="true"></i>Reports</a></li>
  </ul>
  <div class="cv-overline cv-sidebar__group">Account</div>
  <ul>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-users-three cv-icon" aria-hidden="true"></i>Team</a></li>
    <li><a class="cv-nav-item" href="#"><i class="ph ph-gear cv-icon" aria-hidden="true"></i>Settings</a></li>
  </ul>
</nav>
```

## Classes and states

- `cv-sidebar` on `cv-surface` with a `cv-border` right edge. `cv-nav-item`: 32 px, `cv-fg-muted`; hover and current page on `cv-surface-2` in `cv-fg`.
- Inside `AppShell` it is fixed from 1024 px and becomes an off-canvas drawer below.

## Accessibility and keyboard

- `<nav aria-label="Main">` with lists; the current page has `aria-current="page"`.
- Icons are decorative (`aria-hidden`); the label is the name.

## Use

- Users scan by shape: every item has an icon.
- Group headings use `cv-overline`.

**The consumer provides** the items (icon, label, href) and the current page.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] `aria-current="page"` on the current link (1.3.1).
- [ ] Current page shown by fill and weight, not colour alone (1.4.1).
- [ ] Same order on every page (3.2.3).
