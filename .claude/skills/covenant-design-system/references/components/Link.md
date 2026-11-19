Links navigate to another page or place; they read in `cv-fg-accent` and are always underlined.

## Anatomy

```html
<p>Time is logged to <a class="cv-link" href="#">Covenant · Q2 launch</a>. <a class="cv-link" href="#">View all entries</a></p>
```

## Classes and states

- `cv-link`: `cv-fg-accent` (5.18:1 on `cv-surface` light, 7.2:1 dark), underline with a 2 px offset; hover thickens the underline.

## Accessibility and keyboard

- Use `<a href>`; a link that runs an action is a button.
- The underline keeps links distinguishable without colour (1.4.1).

## Use

- Link text says where it goes: `View all entries`, never `here` or `more`.
- Open in a new tab only when asked, and say so in the text.

**The consumer provides** the destination and the text.

## Checklist

Run the shared checklist (`checklist.md`) and these points:

- [ ] Underlined, so it does not rely on colour alone (1.4.1).
- [ ] Text names the destination out of context (2.4.4).
- [ ] Focus ring visible in both themes.
