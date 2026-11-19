Category colours tell projects apart: 16 hues, each with a marker (stripe, dot, chart segment) and a fill behind a white label. A deliberate extension: a category is never a status and never carries meaning alone.

## Anatomy

```html
<!-- 1. Card and table row: stripe on the left edge, dot next to the name -->
<a class="cv-card cv-cat-stripe" data-cat="9" href="#">
  <h3 class="cv-card__title"><span class="cv-cat-name"><span class="cv-cat-dot" aria-hidden="true"></span>Covenant · Q2 launch</span></h3>
  <span class="cv-card__meta">Internal · 14h 22m this week</span>
</a>
<div class="cv-table-wrap" role="region" aria-label="Projects" tabindex="0">
  <table class="cv-table">
    <thead><tr><th scope="col">Project</th><th scope="col" class="cv-num">Time</th></tr></thead>
    <tbody>
      <tr data-cat="9"><td class="cv-cat-stripe"><span class="cv-cat-name"><span class="cv-cat-dot" aria-hidden="true"></span>Covenant · Q2 launch</span></td><td class="cv-num">14h 22m</td></tr>
      <tr data-cat="4"><td class="cv-cat-stripe"><span class="cv-cat-name"><span class="cv-cat-dot" aria-hidden="true"></span>Internal tools</span></td><td class="cv-num">6h 05m</td></tr>
      <tr data-cat="14"><td class="cv-cat-stripe"><span class="cv-cat-name"><span class="cv-cat-dot" aria-hidden="true"></span>Invoicing portal</span></td><td class="cv-num">2h 18m</td></tr>
    </tbody>
  </table>
</div>

<!-- 2. Day timeline: filled blocks with the project name in white -->
<ol class="cv-cat-timeline" aria-label="Monday 17 November, 08:00 to 18:00">
  <li class="cv-cat-block" data-cat="9" style="--cv-start:0%;--cv-span:30%">Covenant · Q2 launch <span class="cv-sr-only">08:00 to 11:00</span></li>
  <li class="cv-cat-block" data-cat="4" style="--cv-start:30%;--cv-span:20%">Internal tools <span class="cv-sr-only">11:00 to 13:00</span></li>
  <li class="cv-cat-block" data-cat="14" style="--cv-start:60%;--cv-span:25%">Invoicing portal <span class="cv-sr-only">14:00 to 16:30</span></li>
</ol>

<!-- 3. Stacked bar chart with a legend -->
<figure class="cv-cat-chart">
  <figcaption>Time by project · this week</figcaption>
  <ul class="cv-cat-chart__rows">
    <li class="cv-cat-chart__row"><span>Mon</span>
      <span class="cv-cat-chart__bar"><span class="cv-cat-segment" data-cat="9" style="--cv-share:40%"><span class="cv-sr-only">Covenant · Q2 launch 3h 30m,</span></span><span class="cv-cat-segment" data-cat="4" style="--cv-share:25%"><span class="cv-sr-only">Internal tools 2h,</span></span><span class="cv-cat-segment" data-cat="14" style="--cv-share:30%"><span class="cv-sr-only">Invoicing portal 2h 30m</span></span></span>
      <span class="cv-num">8h 00m</span></li>
    <li class="cv-cat-chart__row"><span>Tue</span>
      <span class="cv-cat-chart__bar"><span class="cv-cat-segment" data-cat="9" style="--cv-share:70%"><span class="cv-sr-only">Covenant · Q2 launch 5h 45m,</span></span><span class="cv-cat-segment" data-cat="4" style="--cv-share:20%"><span class="cv-sr-only">Internal tools 1h 45m</span></span></span>
      <span class="cv-num">7h 30m</span></li>
  </ul>
  <ul class="cv-cat-legend" aria-label="Legend">
    <li data-cat="9"><span class="cv-cat-dot" aria-hidden="true"></span>Covenant · Q2 launch</li>
    <li data-cat="4"><span class="cv-cat-dot" aria-hidden="true"></span>Internal tools</li>
    <li data-cat="14"><span class="cv-cat-dot" aria-hidden="true"></span>Invoicing portal</li>
  </ul>
</figure>
```

## Classes and states

- `data-cat="1"`…`"16"` on an element sets two local properties for it and its children: `--cv-cat` (the marker, `--cv-cat-N`) and `--cv-cat-fill` (`--cv-cat-N-fill`). Without `data-cat`, category 16 (slate) applies. `data-cat="custom"` reads `--cv-cat-custom-light`, `--cv-cat-custom-dark` and `--cv-cat-custom-fill`, set by `Covenant.setCategory()`.
- `cv-cat-stripe`: a 4 px stripe drawn inside the left edge (inset shadow, no layout shift), on a card, a row cell or a list item.
- `cv-cat-dot`: a 10 px dot (`cv-radius-full`), always followed by the name; `cv-cat-name` lines up the dot and the name.
- `cv-cat-block`: the fill (`--cv-cat-fill`) with the name in `cv-fg-on-cat` (white), 12 px medium, ellipsis when narrow.
- `cv-cat-timeline`: an ordered list on `cv-surface-2`; each `cv-cat-block` is placed with `--cv-start` and `--cv-span` (percentages of the day shown).
- `cv-cat-chart`, `cv-cat-chart__rows`, `cv-cat-chart__row`, `cv-cat-chart__bar`: a stacked bar chart; each `cv-cat-segment` is sized with `--cv-share`, with a 2 px gap between neighbours. `cv-cat-legend`: dots and names.
- Palette, in hue order, alternating a bright and a deep tier so neighbours differ in lightness too: 1 orange, 2 amber, 3 yellow, 4 lime, 5 green, 6 teal, 7 cyan, 8 sky, 9 blue, 10 indigo, 11 violet, 12 purple, 13 fuchsia, 14 pink, 15 rose, 16 slate. Values and ratios are in `tokens.json`.

## Accessibility and keyboard

- The colour never carries meaning alone (1.4.1): the name is next to the dot, on the row, inside the block, and in the legend of every chart. The dot is `aria-hidden`.
- Markers reach 3:1 against `cv-bg`, `cv-surface`, `cv-surface-2` and `cv-surface-raised` in both themes (1.4.11). They are never placed on `cv-surface-3` (2.66:1 at worst). On a highlighted option (`cv-bg-accent-subtle`) a dark marker can drop to 2.82:1: allowed only because the name sits next to the dot, which is then decorative.
- White labels on fills reach 4.5:1 in both themes (1.4.3). A filled block needs no 3:1 against the surface: its label identifies it.
- The timeline is an `<ol>` named by the day and range; each block carries its time range for screen readers. Chart segments carry their name and value in `cv-sr-only` text, and the figure has a caption.
- Truncated labels (ellipsis in a narrow block) must be available in full elsewhere on the screen: the entries list, or the block's detail on focus or activation.

## Use

- A category is **not a status**. It never replaces a status badge; a project that is late shows a warning badge, whatever its colour. Green, yellow, amber, rose and orange are kept as category hues because the name is always shown; they are assigned last by default.
- **Default order** when projects are created: 9 blue, 4 lime, 14 pink, 10 indigo, 7 cyan, 6 teal, 16 slate, 13 fuchsia, 8 sky, 11 violet, 12 purple, 5 green, 3 yellow, 2 amber, 15 rose, 1 orange. The first six stay clearly apart, also for protanopia, deuteranopia and tritanopia. After 16 projects, the order starts again: two projects can share a colour, and the name tells them apart.
- **Many projects in one view**: up to 6 colours are told apart by everyone; up to 8 for most. Beyond 8, group the rest as "Other" (category 16) in charts, or rely on direct labels; never ask users to match a colour alone.
- **Custom colours**: restrict users to the 16 palette entries (recommended). If an application must accept any colour, call `Covenant.setCategory(element, "#rrggbb")`: it keeps the hue and saturation and adjusts the lightness to the lightest light marker and darkest dark marker at 3:1 on every ground, and the lightest fill under a white label at 4.5:1 (`Covenant.categoryColors(hex)` returns the three values). Store the picked colour, never the derived ones.
- Store the category number (1–16) with the project, not a hex value, so the palette can be retuned without a migration.

**The consumer provides** the category number of each project, the names, and the times or values.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Every marker and block shows the project name, or the chart has a legend or direct labels (1.4.1).
- [ ] No category colour stands in for a status; status badges are still shown (1.4.1, 3.3.1).
- [ ] Markers only on `cv-bg`, `cv-surface`, `cv-surface-2` or `cv-surface-raised`, never on `cv-surface-3` (1.4.11).
- [ ] Labels on fills are white (`cv-fg-on-cat`), 4.5:1 in both themes (1.4.3).
- [ ] Category values come from `data-cat` or `Covenant.setCategory()`, never from a hex value written in CSS or markup.
- [ ] Checked in light and dark, and with a colour-vision simulator (protanopia, deuteranopia, tritanopia) when a view shows more than six projects.
