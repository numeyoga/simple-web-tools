The command menu opens with ⌘K or Ctrl+K and runs a command by name; it is a modal `<dialog>` holding a combobox with an always-visible list.

## Anatomy

```html
<button type="button" class="cv-search" data-cv-open="cmd" aria-label="Search"><i class="ph ph-magnifying-glass cv-icon" aria-hidden="true"></i><span class="cv-search__label">Search</span><kbd class="cv-kbd">⌘K</kbd></button>
<dialog class="cv-cmd" id="cmd" data-cv-shortcut="mod+k" aria-label="Command menu">
  <div class="cv-combobox" data-cv-inline>
    <div class="cv-cmd__search"><i class="ph ph-magnifying-glass cv-icon" aria-hidden="true"></i><input class="cv-cmd__input" type="text" role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-label="Command" placeholder="Type a command or search" autocomplete="off"><kbd class="cv-kbd">esc</kbd></div>
    <ul class="cv-listbox" id="cmd-list" role="listbox" aria-label="Commands">
      <li class="cv-option" role="option" data-value="timer"><i class="ph ph-timer cv-icon" aria-hidden="true"></i>Go to Timer</li>
      <li class="cv-option" role="option" data-value="entries"><i class="ph ph-clock-countdown cv-icon" aria-hidden="true"></i>Go to Entries</li>
      <li class="cv-option" role="option" data-value="new-entry"><i class="ph ph-plus cv-icon" aria-hidden="true"></i>New time entry</li>
      <li class="cv-listbox__empty" hidden>No matches.</li>
    </ul>
  </div>
</dialog>
```

## Classes and states

- `dialog.cv-cmd`: 520 px, 12 vh from the top, `cv-radius-lg`, `cv-shadow-xl`. The list is a `cv-combobox[data-cv-inline]`.
- `data-cv-shortcut="mod+k"` binds ⌘K/Ctrl+K. Choosing an option fires `cv:command` with `{ value }` and closes the dialog.

## Accessibility and keyboard

- Escape closes it (native dialog) and focus returns to the opener.
- Type to filter, ↓/↑ to move, Enter to run.

## Use

- Commands start with a verb: `Go to Entries`, `New time entry`.

**The consumer provides** the commands (with `data-value`) and a `cv:command` listener.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Escape closes; focus returns (2.1.2).
- [ ] Input labelled; list exposed with `aria-activedescendant` (4.1.2).
- [ ] Shortcut uses a modifier key (2.1.4).
