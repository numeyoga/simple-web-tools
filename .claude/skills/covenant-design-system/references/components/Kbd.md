Keycaps show a keyboard shortcut in mono, with a thicker bottom border.

## Anatomy

```html
<p>Press <kbd class="cv-kbd">Space</kbd> to start or stop the timer, <kbd class="cv-kbd">⌘</kbd> <kbd class="cv-kbd">K</kbd> to search.</p>
```

## Classes and states

- `kbd.cv-kbd`: IBM Plex Mono 12 px, `cv-border-strong` with a 2 px bottom, 4 px radius, `cv-fg-muted`.

## Accessibility and keyboard

- Use the `<kbd>` element.

## Use

- Name the key as printed: `Space`, `Esc`, `⌘`.

**The consumer provides** the keys.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Semantic `<kbd>` (1.3.1).
- [ ] Single-key shortcuts can be turned off or only work on focus (2.1.4).
