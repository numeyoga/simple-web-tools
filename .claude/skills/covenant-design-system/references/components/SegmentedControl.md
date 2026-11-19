A segmented control picks one of two to five views; it is a radio group drawn as joined buttons.

## Anatomy

```html
<fieldset class="cv-segmented">
  <legend>Range</legend>
  <label><input type="radio" name="range" checked><span>Day</span></label>
  <label><input type="radio" name="range"><span>Week</span></label>
  <label><input type="radio" name="range"><span>Month</span></label>
</fieldset>
```

## Classes and states

- `cv-segmented`: 1 px `cv-border-control` frame; the selected segment is `cv-fg-inverse` on `cv-surface-inverse`.
- Focus draws a 2 px ring inset by 4 px inside the segment: `cv-border-focus` on an unselected segment, `cv-fg-inverse` on the selected one (where keyboard focus lands), 17:1 or more in both themes.

## Accessibility and keyboard

- Native radios: arrow keys move the choice. The legend is visually hidden but announced.

## Use

- Switches a view or a range; never submits a form.
- Keep labels to one or two words.

**The consumer provides** the legend, the options and the selected value.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Built on native radios with a legend (1.3.1, 4.1.2).
- [ ] Selected state visible without colour alone: inverse fill (1.4.1).
