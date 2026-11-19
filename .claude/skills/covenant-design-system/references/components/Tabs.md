Tabs switch between views of the same object; the selected tab is underlined in the accent.

## Anatomy

```html
<div class="cv-tabs">
  <div role="tablist" aria-label="Project views">
    <button type="button" class="cv-tab" role="tab" id="tb-1" aria-controls="tb-1-panel" aria-selected="true">Entries <span class="cv-tab__count">24</span></button>
    <button type="button" class="cv-tab" role="tab" id="tb-2" aria-controls="tb-2-panel" aria-selected="false">Tasks <span class="cv-tab__count">7</span></button>
    <button type="button" class="cv-tab" role="tab" id="tb-3" aria-controls="tb-3-panel" aria-selected="false">Settings</button>
  </div>
  <div class="cv-tabpanel" role="tabpanel" id="tb-1-panel" aria-labelledby="tb-1" tabindex="0">24 entries this week.</div>
  <div class="cv-tabpanel" role="tabpanel" id="tb-2-panel" aria-labelledby="tb-2" tabindex="0" hidden>7 open tasks.</div>
  <div class="cv-tabpanel" role="tabpanel" id="tb-3-panel" aria-labelledby="tb-3" tabindex="0" hidden>Project settings.</div>
</div>
```

## Classes and states

- `cv-tab`: 40 px, `cv-fg-muted`; selected: `cv-fg` with a 2 px `cv-border-selected` underline (4.7:1 or more in both themes). `cv-tab__count`: pill on `cv-surface-2`, accent tint when selected.
- bundle.js keeps one tab in the tab order and activates on ←/→/Home/End.

## Accessibility and keyboard

- WAI-ARIA tabs pattern: `tablist`, `tab` with `aria-selected` and `aria-controls`, `tabpanel` labelled by its tab.

## Use

- Two to six tabs, one or two words each.
- Tabs switch content in place; to change page, use links.

**The consumer provides** the tab labels, optional counts and the panels.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Arrow keys move between tabs, Tab enters the panel (2.1.1).
- [ ] Selected state by underline and colour, plus `aria-selected` (1.4.1, 4.1.2).
- [ ] Underline 3:1 (1.4.11).
