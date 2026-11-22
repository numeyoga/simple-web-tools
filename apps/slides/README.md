# Slides

Markdown presentations read from a local folder, in vanilla JavaScript (ES modules, Vite): no
runtime framework. Pick the folder that holds `slides.md` and its images, and present: a
**presenter window** with the notes, the next slide and two timers, kept in step with the main
window; an **overview**; a **print view** (one A4 page per slide, with the public notes);
syntax-highlighted code and **Mermaid** diagrams. The interface is available in English and
French (it follows the browser, and can be chosen in the preferences). Everything stays in the
browser; nothing is sent to a server, and the app stores no document.

It is a **port** of [presentation-engine](https://gitlab.com/wallartn/presentation-engine), whose
parser and state were already pure and whose identifiers were already English, onto the
repository's [reference architecture](../../docs/decisions/0004-reference-architecture.md) and the
Covenant design system. Its differences are listed under "Changes from the earlier version".

User documentation (English): [docs/](docs/index.md).

## Features

- **Open a presentation**: choose a folder (`<input webkitdirectory>`), drop a folder on the page, or
  **load the example** (a short talk, in English or French, bundled with the app).
- **Present**: the slide in a 16:9 frame or fitted to the window, a control bar (slider, counter,
  go to a number), full screen, and the keyboard map below. The slide's theme (`light` or `dark`)
  comes from its frontmatter and is independent of the theme of the app.
- **Overview**: every slide as a card (number, title, first sentence); a card goes to its slide.
- **Presenter window** (`?view=presenter`, opened by a button or `S`): current slide, next slide,
  presenter and public notes, a total timer (start, pause, reset) and a slide timer (restarts at
  every slide). It drives the main window too (buttons and keys).
- **Print**: A4, the slide above its public notes, always in the light theme, with the diagrams drawn
  before the print dialog opens (`Ctrl+P` is taken over for that).
- **Preferences**: language, theme, text size and the letter and digit shortcuts.

## The format of `slides.md`

It is the original's format, unchanged, so existing presentations open as they are:

- A line with `---` alone ends a slide (use `***` or `___` for a horizontal rule). A `---` inside a
  fenced code block belongs to the code.
- An optional YAML frontmatter at the very top: `title`, `description`, `author`, `theme`
  (`light` or `dark`, default `dark`) and `ratio` (`fixed`, the 16:9 frame, or `auto`).
- GitHub-flavoured Markdown (marked), highlight.js for `java`, `javascript`, `typescript`, `json`
  and `yaml`.
- `:::notes-presenter` and `:::notes-public` blocks (closed by `:::`) hold the notes: the first is
  shown in the presenter window, the second also in the presenter window and in the print view.
- A fenced block in the `mermaid` language is drawn as a diagram.
- Images are read from the folder (`![](assets/logo.png)`): PNG, JPEG, GIF, WebP and SVG.

## Security

A presentation is often someone else's file, and raw HTML in Markdown is HTML.

- **Sanitizing.** The rendered HTML of every slide and note goes through
  [DOMPurify](https://github.com/cure53/DOMPurify) before it is inserted, in one module
  (`src/adapters/dom/slide-html.js`) that swaps a `DocumentFragment` in with `replaceChildren`: the
  app has no `innerHTML` at all. `<script>`, event handlers, `javascript:` addresses, forms, frames,
  media and `style` attributes are removed (`src/adapters/sanitizer.js` has the configuration).
  `script-src 'self'` stays the second line of defence. The presenter window sanitizes again what it
  receives on the channel, which any page of the origin can write to, and drops malformed messages.
  `tests/e2e/sanitizer.spec.js` loads a hostile fixture folder through the folder picker.
- **Images.** The images of the folder become `blob:` object URLs (no base64, no copy), revoked when
  the presentation is closed or replaced and when the page goes away. Remote images are not loaded:
  the CSP has no image host, and the slide shows a **placeholder** with the reason and the address
  (an image from the web, an embedded `data:` image, a file that is not in the folder, an address
  that is not supported). Links stay clickable for `http:`, `https:` and `mailto:` only, and open
  in a new tab with no opener.
- **Mermaid.** `securityLevel: 'strict'`, and the library is loaded only when a diagram is on
  screen (see below).

## Mermaid, on demand and offline

`mermaid` is a dynamic `import()` in `src/adapters/mermaid.js`, run the first time a slide on
screen (or the print view) holds a diagram. A talk with no diagram never fetches it. Vite splits it
into about ninety chunks (one per diagram type and shared helper, 5.1 MB of script, 1.5 MB
compressed, the layout engine alone being 1.5 MB). They are all in `precache-manifest.json`, so
the service worker caches them at install and a diagram is drawn offline; the cost is a larger first
install, not a larger first load. The main chunk is 305 kB (98 kB compressed).

Mermaid's SVG carries `<style>` elements and `style` attributes, so **`style-src` allows
`'unsafe-inline'` in this app, and in this app only**. The rest of the policy is unchanged and there
is no `'unsafe-eval'`: `tests/e2e/mermaid.spec.js` listens for `securitypolicyviolation` while it
draws. The risk is bounded: slide HTML cannot carry a style (the sanitizer removes them), scripts
stay strict, and `img-src` and `default-src` stop any request a style could make.

## Data and storage

No document is stored: a presentation is read from the folder each time and lives in memory. The only
persisted names are the preferences, all prefixed with the app name (decision 0005), and the offline
cache:

| Name                                         | Holds                                                    |
| -------------------------------------------- | -------------------------------------------------------- |
| `localStorage` `slides-theme`                | `light` or `dark`; absent, the system theme              |
| `localStorage` `slides-text-size`            | `standard`, `comfortable` or `large`; absent, automatic  |
| `localStorage` `slides-single-key-shortcuts` | `1` or `0`; absent, on                                   |
| `localStorage` `slides-locale`               | `en` or `fr`; absent, the browser's language             |
| `BroadcastChannel` `slides-sync`             | main window and presenter window                         |
| window name `slides-presenter`               | the presenter window, so that opening it twice reuses it |
| Cache Storage `slides-shell-<build id>`      | the offline shell (`@simple-web-tools/pwa`)              |

There is no schema and no migration: nothing is stored that could change shape. The earlier app
stored nothing either, so there is nothing to import.

## Architecture

[Decision 0004](../../docs/decisions/0004-reference-architecture.md):

- `src/core/`: pure. `parser.js` (source to presentation), `frontmatter.js`, `slide-splitter.js`,
  `directives.js`, `markdown.js` and `highlight.js`, `store.js` (`reduce(state, command)` returns
  the next state and the effects: publish, sync, release images), `keyboard.js` (a key and the
  digits typed so far in, an intent out), `timers.js` (values; `now` is a parameter), `folder.js`
  and `assets.js` (what a folder holds, what an image or a link may be), `messages.js` (the
  channel protocol and its validation), `preferences.js`, `locale.js`.
- `src/adapters/`: `folder.js` (read a chosen or dropped folder, object URLs), `examples.js`,
  `channel.js`, `windows.js`, `sanitizer.js`, `mermaid.js`, `preferences.js`, `i18n.js`, and `dom/`
  (the views, built with `@simple-web-tools/dom`: `el()` never parses HTML). `App.js` owns the
  state, runs the effects and takes the keyboard.
- `src/i18n/`: English and French catalogs. `src/examples/`: the example presentation, one
  folder per language, loaded as a lazy chunk.
- `src/styles/`: `app.css` (layout glue), `slide.css` (the slides, on Covenant's tokens) and
  `print.css`.

The slide themes are the app's own CSS on Covenant's tokens: the theme of a presentation is
`data-theme` on its stage, which re-applies the whole token set inside it, so a dark talk in a
light app is a dark region. Text scales with the frame (container query units, never below
0.875rem). Syntax colours use the foreground roles of the status colours, the only ones that are
checked against the surfaces in both themes.

## Content Security Policy and PWA

```text
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:;
font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none';
frame-src 'none'; base-uri 'none'; form-action 'none'
```

A meta tag in the build and a header of `vite preview`. There is **no third-party host**. The
reasons for `'unsafe-inline'` (styles) and `blob:` (images) are in `vite.config.js` and above.
The manifest, the service worker (scope `./`, so `/slides/` on Pages), the cache name and the
offline start come from [`@simple-web-tools/pwa`](../../packages/pwa/README.md).

## Changes from the earlier version

- Raw HTML is sanitized, images are `blob:` URLs instead of data URLs, remote images show a
  placeholder, and Mermaid is loaded on demand (it was in the main bundle path).
- A `---` inside a fenced code block no longer cuts the slide; a first slide framed by two
  separators is not taken for a frontmatter; an invalid frontmatter gets a translated message with
  the reason, not the raw YAML error.
- The overview and the "next slide" card show the title and the first sentence as text (`&amp;`
  was shown as is), and the channel messages are validated.
- `Ctrl+P` prints through the app, so the diagrams are drawn; the print document is out of sight on
  screen but has a real layout (the original's was `display: none`), which Mermaid needs to measure
  its labels.
- The frame can be fitted from a button as well as with `R`; the letter and digit shortcuts can be
  turned off (WCAG 2.1.4); the keys no longer fire with Ctrl, Alt or Meta, in a text field, or in
  a dialog.
- Mermaid is **12.3.0**, not 11.15.0: the earlier version pinned 11.15.0 for CVE-2026-41159, and
  every 11.x release still depends on a KaTeX with an advisory (GHSA-238p-pmpm-9mq7) that 12.3.0
  fixes. `npm run audit` is clean.
- The example is translated (English and French) and bundled; the original's example is a folder
  of the repository.

## Known limits

- The presenter window reads the images through the main window's object URLs: if the main window
  is closed, the presenter keeps its text but its images no longer load. Chrome and Firefox share
  `blob:` URLs between same-origin windows; a browser that partitions them would show broken images
  in the presenter window only.
- Dropping a folder uses `webkitGetAsEntry`; the end-to-end suite checks the path that follows a
  drop and the refusal of a drop that is not a folder, but cannot build a drop of a real folder.
- Print layout is checked with `page.emulateMedia({ media: 'print' })` (page count, A4 height,
  slide above notes, light theme) and a screenshot, not with the browser's own print preview.
- Mermaid's own look (fonts, colours) is its default or dark theme, not Covenant's.

## Running locally

```sh
npm install
npm run dev -w slides        # Vite dev server (no service worker)
npm run build -w slides      # production build, in apps/slides/dist
npm run preview -w slides    # serves dist on http://127.0.0.1:4178, with the CSP header
```

## Tests

```sh
npm test -w slides           # Vitest (tests/unit)
npm run typecheck -w slides  # strict tsc on src and tests/unit
npm run test:e2e -w slides   # builds the app, then Playwright (tests/e2e) against `vite preview`
npm run verify               # from the root: typecheck, lint, format, tests, build
```

- **Unit**: the original's 19 tests ported (directives, frontmatter, parser, splitter) with new
  cases (fenced separators, alias bomb, entities), and the reducer, the keyboard map, the timers,
  the folder planner, the image and link rules, the channel messages, the preferences, the names
  (every name starts with `slides`), the catalogs (same keys, no text outside them).
- **End to end**: the home screen and the folders (picked, dropped, no `slides.md`, invalid YAML),
  navigation and the overview, the presenter window in step with the main one in both directions
  (two pages of one browser context), the timers (with a fake clock), print media, Mermaid (lazy
  load, offline, a broken diagram, strict mode), the sanitizer with a hostile fixture folder,
  CSP and offline, preferences, English and French, and axe (WCAG 2.0 A/AA, 2.1 AA, 2.2 AA) on
  every screen in light and dark at 1280 and 390 px. The suites run with the browser in French
  (`playwright.config.js`). `PLAYWRIGHT_WS_ENDPOINT` points them at a shared Playwright server.

## Keyboard shortcuts

| Key                         | Action                                       |
| --------------------------- | -------------------------------------------- |
| `→` `↓` `Space` `Page down` | Next slide                                   |
| `←` `↑` `Page up`           | Previous slide                               |
| `Home`, `End`               | First, last slide                            |
| digits, then `Enter`        | Go to that slide number                      |
| `O`                         | Overview (also closes it); `Esc` closes it   |
| `S`                         | Presenter window                             |
| `R`                         | Fit the slide to the window, or back to 16:9 |
| `F`                         | Full screen                                  |
| `Ctrl+P`, `⌘P`              | Print                                        |

`O`, `S`, `R`, `F` and the digits are single-key shortcuts: they can be turned off, and never fire
while you type, when a dialog is open or with a modifier key (WCAG 2.1.4). The arrows, `Space`,
`Home`, `End` and the page keys always work.

## Runtime dependencies

Covenant, dom, i18n and suite are workspace packages of this repository. Four small libraries do
what would otherwise be hand-written and risky; each is bundled, none makes a request
([decision 0003](../../docs/decisions/0003-no-runtime-framework.md)):

| Library        | Version  | Licence               | Why                                                                                                          |
| -------------- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `marked`       | ^18.2.1  | MIT                   | GitHub-flavoured Markdown to HTML and tokens; a parser is not worth writing.                                 |
| `yaml`         | ^2.9.1   | ISC                   | The frontmatter. It has no custom tags and caps alias expansion, which a hand parser would not.              |
| `highlight.js` | ^11.12.0 | BSD-3-Clause          | Syntax colours. Only `lib/core` and five grammars are imported, so the rest is not bundled.                  |
| `mermaid`      | 12.3.0   | MIT                   | Diagrams, from a lazy chunk (see above). Pinned: the earlier version pinned it for a CVE.                    |
| `dompurify`    | 3.4.17   | MPL-2.0 OR Apache-2.0 | Sanitizing HTML is the one thing not to write by hand. Pinned, and shared with Mermaid, which depends on it. |
