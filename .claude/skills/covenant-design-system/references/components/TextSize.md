The text size setting lets each user enlarge the whole interface: automatic (follows the screen), standard, comfortable or large.

## Anatomy

```html
<fieldset class="cv-segmented" data-cv-text-size-control>
  <legend>Text size</legend>
  <label><input type="radio" name="text-size" value="auto" checked><span>Automatic</span></label>
  <label><input type="radio" name="text-size" value="standard"><span>Standard</span></label>
  <label><input type="radio" name="text-size" value="comfortable"><span>Comfortable</span></label>
  <label><input type="radio" name="text-size" value="large"><span>Large</span></label>
</fieldset>
```

## Classes and states

- A `cv-segmented` radio group marked `data-cv-text-size-control`; bundle.js checks the current size and applies the choice.
- The choice is the `data-text-size` attribute on `<html>`: none (automatic: x1, x1.125 from 2000 CSS px wide, x1.25 from 2400), `standard` (x1), `comfortable` (x1.125), `large` (x1.25). Every size in Covenant is in rem, so text, rows, controls and panels scale together.
- `Covenant.setTextSize(size)` and `Covenant.getTextSize()` drive it from code; a `cv:textsize` event reports each change.

## Accessibility and keyboard

- Native radios with a legend: arrow keys move the choice, the legend names the group.
- The browser's own font-size setting and zoom keep working on top of this choice (1.4.4).

## Use

- Put it in the user's preferences or account menu.
- Store the choice in the user's profile and render `data-text-size` on `<html>` from the server, so the page never jumps on load.

**The consumer provides** the stored preference and a `cv:textsize` listener that saves it.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Every size in the screen is in rem: the whole interface grows with the setting, nothing overlaps or gets clipped (1.4.4, 1.4.12).
- [ ] At `large` on a 1280 px wide window, nothing scrolls sideways except data tables (1.4.10).
