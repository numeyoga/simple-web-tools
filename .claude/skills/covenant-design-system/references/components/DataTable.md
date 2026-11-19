Data tables list records in 32 px rows with a sentence-case header, mono numbers aligned right, and scroll inside their own region on narrow screens.

## Anatomy

```html
<div class="cv-table-wrap" role="region" aria-labelledby="dt-cap" tabindex="0">
  <table class="cv-table">
    <caption id="dt-cap">Time by project · this week</caption>
    <thead><tr><th scope="col">Project</th><th scope="col">Status</th><th scope="col" class="cv-num">Time</th></tr></thead>
    <tbody>
      <tr><td>Covenant · Q2 launch</td><td><span class="cv-badge cv-badge--success"><span class="cv-badge__dot"></span>Running</span></td><td class="cv-num">14h 22m</td></tr>
      <tr><td>Internal tools</td><td><span class="cv-badge cv-badge--accent"><span class="cv-badge__dot"></span>Active</span></td><td class="cv-num">6h 05m</td></tr>
      <tr><td>Invoicing portal</td><td><span class="cv-badge cv-badge--warning"><span class="cv-badge__dot"></span>Pending</span></td><td class="cv-num">2h 18m</td></tr>
    </tbody>
  </table>
</div>
```

## Classes and states

- `cv-table-wrap`: border, radius and horizontal scroll. `cv-table`: 32 px rows, `cv-border` hairlines, header on `cv-surface-2` in `cv-fg-muted`; row hover `cv-surface-2`.
- `cv-num`: right-aligned IBM Plex Mono with tabular figures.

## Accessibility and keyboard

- Real `<table>` with `<caption>` and `<th scope>`.
- The scroll region is focusable (`tabindex="0"`) and labelled, so keyboard users can scroll it (2.1.1).

## Use

- Counts never rounded (`1,247`), durations in a fixed format, timestamps relative in lists.
- Never a border and a shadow on the same edge.

**The consumer provides** the caption, the columns and the rows.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Header cells with `scope`, caption present (1.3.1).
- [ ] Scrollable region focusable and named (2.1.1).
- [ ] Only the table scrolls horizontally at 320 px (1.4.10 exception for data tables).
