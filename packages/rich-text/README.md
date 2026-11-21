# @simple-web-tools/rich-text

The rich-text editor of Locavern, extracted so that every app that edits rich text uses one
copy ([decision 0004](../../docs/decisions/0004-reference-architecture.md)): a Tiptap editor
with a Covenant toolbar, the sanitizing of its JSON documents, and their conversion to plain
text and Markdown. Private workspace package: it is not published.

## Runtime dependency: Tiptap

The editor is built on [Tiptap](https://tiptap.dev) (`@tiptap/core`, the ProseMirror bindings
in `@tiptap/pm` and a dozen small extensions, MIT). It is the "Tiptap core" that
[decision 0003](../../docs/decisions/0003-no-runtime-framework.md) allows: it is headless (no
UI framework, no CSS, no network), and it replaces what would otherwise be a hand-written
`contenteditable` editor, whose selection, undo history, IME and clipboard handling are the
hard part to get right. Only the extensions the editor uses are installed, not the starter kit.
Tiptap is the only dependency of the package, and the only code of it that is not pure.

## Entry points

| Import                                    | Contents                                       | DOM | Tiptap    |
| ----------------------------------------- | ---------------------------------------------- | --- | --------- |
| `@simple-web-tools/rich-text`             | Document model, plain text, Markdown           | no  | no        |
| `@simple-web-tools/rich-text/editor`      | `mountRichTextEditor` (the editor)             | yes | yes       |
| `@simple-web-tools/rich-text/editor-lazy` | `mountRichTextEditor` behind a lazy `import()` | yes | on demand |
| `@simple-web-tools/rich-text/editor.css`  | Styles of the editor                           | -   | -         |

The root entry is pure (no DOM, no clock, no Tiptap) and safe in an app's `src/core`. The two
editor entries belong in `src/adapters`.

### Pure API

- `EMPTY_RICH_DOC`: the frozen empty document (one empty paragraph).
- `sanitizeRichTextDoc(raw)`: any value in, a clean `RichTextDoc` out. Only the node and mark
  types the editor can produce survive; links are limited to `https:` and `mailto:`; remote
  images are dropped; heading levels, alt texts and asset ids are normalized. Documents are
  sanitized on the way in (storage, import) and on the way out of the editor.
- `sanitizeLinkHref(href)`: the normalized URL, or `null` when it is not allowed.
- `collectDocAssetIds(doc)`: the ids of the local images a document references, once each.
- `ALLOWED_IMAGE_MIMES`: the raster image types an app should accept as local assets.
- `extractRichTextPlainText(doc)`: readable text for search and previews (text and image alt).
- `richTextDocToMarkdown(doc, { imageAlt })`: CommonMark/GFM. Local images become
  `![alt](local-asset://<assetId>)`; `imageAlt` is the translated text of an image without alt.
- Types: `RichTextDoc`, `RichTextNode`, `RichTextMark`, `AllowedImageMimeType`.

### The editor

```js
import '@simple-web-tools/rich-text/editor.css';
import { mountRichTextEditor } from '@simple-web-tools/rich-text/editor-lazy';

const handle = mountRichTextEditor({
  container, // replaced by the editor
  initialDoc,
  editable: true,
  ariaLabel: t('notes.body'),
  labels, // every text, translated by the app (below)
  resolveAssetUrl: async (assetId) => objectUrlOf(assetId), // or null
  onUploadImage: async (file) => ({ assetId: await saveAsset(file), alt: file.name }), // or null
  onChange: (doc) => save(doc),
  onBlockedRemoteImage: () => toast(t('editor.remoteImageBlocked')), // optional
  onRejectedLink: () => toast(t('editor.linkRejected')), // optional
  setTooltip, // optional: the app's tooltip, called on each toolbar button
  initTooltips, // optional: called once on the toolbar
});
handle.getDoc(); // sanitized document
handle.setDoc(doc); // replace the content, no `onChange`
handle.setEditable(false); // read-only: the toolbar is hidden
handle.destroy();
```

`labels` has no defaults: the package has no catalog. Its keys are `toolbar`, `bold`, `italic`,
`strike`, `code`, `heading1`, `heading2`, `heading3`, `bulletList`, `orderedList`, `taskList`,
`link`, `insertImage`, `linkLabel`, `linkPlaceholder`, `apply`, `cancel` and `localImage` (the
alt text of an image that has none). The lazy entry also needs `loading`, `loadFailed`,
`loadFailedText` and `retry`, and accepts `showLoading(container, label)` and
`showError(container, { title, text }, onRetry)` to replace its small default placeholder and
alert. Compute `labels` when you mount, so that they follow the language of the interface.

Images are never stored in the document: the editor inserts a `localImage` node with an
`assetId`, and asks the app for the picture (`resolveAssetUrl`) and for saving a pasted,
dropped or picked file (`onUploadImage`). Remote images (a URL, pasted HTML) are blocked.

### Lazy loading

The lazy entry does the `import()` of the editor module, so Tiptap becomes its own chunk in
the app's Vite build, fetched when the first editor is shown. Importing it adds a few hundred
bytes to the main bundle, not Tiptap. Never import `/editor` from code that is part of the
first screen. Until the chunk arrives, `mountRichTextEditor` returns a stand-in handle
(`getDoc()` gives the document it was given, `destroy()` cancels the mount). An app that
precaches its build output opens the editor offline after a first visit.

### Styles

`editor.css` styles the editor with Covenant semantic tokens only (a test rejects primitive
tokens), so an app must load `@simple-web-tools/covenant` as well. It is shared rather than
copied so that every app's editor looks the same. Tiptap normally injects its own base rules in a `<style>` element, which a strict Content
Security Policy (`style-src 'self'`) blocks. The editor sets `injectCSS: false` and `editor.css`
carries those rules (the top of the file, taken from `@tiptap/core`'s `style.ts`: compare them
when Tiptap is updated), so the file is required, not cosmetic. The class names keep the `lc-` prefix they
had in Locavern (`lc-editor`, `lc-editor__toolbar`, `lc-editor__surface`): an app's CSS and
tests may target them. The file also defines `.lc-file-input-hidden`, the hidden file input of
the image button.

## Rules

- **No app import.** The package never imports from an app: text, tooltips and loading states
  come in through options.
- **No storage, no clock.** Assets are the app's business (`resolveAssetUrl`, `onUploadImage`).
- **No network.** No remote image is ever parsed or rendered.

## Tests

`npm test -w @simple-web-tools/rich-text` runs the Vitest suites of the pure part and of the
CSS. The editor itself needs a browser: it is covered by the Playwright specs of the apps that
use it (Locavern's `notes-tiptap`, `notes-tasklist` and `lazy-chunks`).
