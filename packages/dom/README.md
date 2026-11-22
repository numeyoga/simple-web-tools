# @simple-web-tools/dom

The DOM helpers of the apps: an element builder that never parses HTML, and the Covenant
component builders (button, fields, menu, modal, confirmation, toast...). Extracted from Chrono and
Transient Notes, which carried two copies of it (`adapters/dom/ui.js` and `lib.js`, with the class
prefixes `ch-` and `tn-`). Private workspace package: it is not published. No runtime dependency.

The rule it enforces ([decision 0004](../../docs/decisions/0004-reference-architecture.md), and the
security stance of the apps): **markup is built with `el()` and `append`, never with `innerHTML`**. A
user's text (a note title, a folder name, a bookmark) is only ever a text node, `el()` throws on
`innerHTML`, `outerHTML` and `srcdoc`, and a style goes through the CSSOM (`node.style.width = ...`),
which a strict CSP allows.

## Entry points

| Import                     | Contents                                                                                                                 | Runs in |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- |
| `@simple-web-tools/dom`    | `el`, `appendChildren`, `mount`, `icon`, `fieldId`, `initCovenant`, `createTNodes`, and the types of every option object | page    |
| `@simple-web-tools/dom/ui` | `createUi`, `UI_KEYS`                                                                                                    | page    |

Both are DOM code for `src/adapters` ([decision 0004](../../docs/decisions/0004-reference-architecture.md)),
never for `src/core`. The builders call `window.Covenant` (from
[`@simple-web-tools/covenant`](../covenant/README.md), which the app imports once) when it exists.

## The builder

```js
import { el, icon, mount } from '@simple-web-tools/dom';

el(
  'div',
  { class: 'cv-card', style: { width: 120 }, onclick: save },
  el('h2', null, title), // a text node, whatever title holds
  items.map((item) => el('li', null, item.label)),
);
```

- Props: `class`, `dataset`, `style`, `ref` (called with the node), `on...` handlers, properties
  (`disabled`, `value`, `type`...) and everything else as attributes. `null`, `undefined` and `false`
  are skipped.
- Children: strings and numbers become text nodes, nodes are moved in, arrays are flattened,
  `null`, `undefined` and booleans are skipped.
- A number in `style` is a length in px at the standard text scale, written in rem (`width: 120`
  gives `7.5rem`), so every size follows the text size of the person. Unitless properties
  (`opacity`, `zIndex`, `fontWeight`, `flex`...) are left alone.
- `icon('gear', { weight, className })` is a Phosphor icon, decorative; `mount(host, node)` replaces
  the content of a node; `fieldId(prefix)` gives a unique id for `for` and `aria-describedby`
  (one counter for everything built with the package); `initCovenant(root)` wires the Covenant
  behaviours of markup inserted below `root`.
- `createTNodes(t)` returns `tNodes(key, { placeholder: node }, params)`: a translated sentence with
  DOM nodes (a `<kbd>`, a figure) in place of some placeholders, so a language can move the node.

## The component builders

`createUi({ prefix, i18n })` returns the builders of one app. Each emits the Anatomy of its
component page in the Covenant skill, with the right classes, roles and ARIA links, and returns an
element.

```js
// src/adapters/dom/ui.js
import { createUi } from '@simple-web-tools/dom/ui';
import { i18n } from '../i18n.js';

export const { Button, IconButton, Input, Modal, Confirm, ToastHost /* … */ } = createUi({
  prefix: 'fv', // the app's class prefix
  i18n, // the translator of @simple-web-tools/i18n: `t` and `locale`
});
```

| Builder                                   | Component                                                                                         | Returns                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `Button`, `IconButton`                    | Button; icon-only button in a Tooltip (`aria-label` and tooltip share the label)                  | button; wrapper with `.button`                                 |
| `Menu`                                    | Menu: button, popover, `aria-haspopup`; the owner calls `initCovenant` once it is in the document | host with `.button`, `.menu`                                   |
| `Input`, `Textarea`, `Select`, `Combobox` | FormField around a TextInput, Textarea (with a counter), Select, Combobox                         | field with `.input` and `.setError(message)`                   |
| `Checkbox`, `Segmented`                   | Checkbox or Switch (`switchRole`); SegmentedControl                                               | label with `.input`; fieldset                                  |
| `Badge`, `Tag`, `Kbd`                     | Badge (status), square tag, keycap                                                                | element                                                        |
| `EmptyState`, `Alert`                     | EmptyState; inline Alert (icon and bold lead)                                                     | element                                                        |
| `Modal`, `Confirm`                        | Modal in a native `<dialog>`; confirmation in a modal, in place of `confirm()`                    | `{ root, close, replaceContent }`; promise of `true` / `false` |
| `ToastHost`                               | `push({ variant, title, body, timeout, action })` on `Covenant.toast`                             | `{ push }`                                                     |

The option objects are typed (`ButtonOptions`, `InputOptions`... exported from the root entry).

### What the app supplies

- **`prefix`** (`ch`, `tn`...). It starts the ids of the fields (`tn-input-3`) and names the few
  layout classes the builders use, which the app defines in its own CSS: `<prefix>-row`,
  `<prefix>-gap-3` and `<prefix>-baseline` (a field with a header, such as a textarea counter),
  `<prefix>-end` (the counter, pushed right), `<prefix>-menu-host` (`display: inline-flex`) and the
  hook `<prefix>-btn-label`. Anything else about layout stays in the app: `className` options add
  its own classes.
- **`i18n`**: the builders write no text. They ask the translator for the messages in `UI_KEYS`
  (`common.close`, `common.cancel`, `common.confirm`, `shell.notifications`,
  `shell.dismissNotification`); the app's catalogs define them and its catalog test checks it:

  ```js
  import { UI_KEYS } from '@simple-web-tools/dom/ui';
  expect(UI_KEYS.filter((key) => !known.has(key))).toEqual([]);
  ```

  A `Combobox` also takes its `emptyText`, and `i18n.locale` sorts its suggestions.

## What stays in the app

Everything that knows the app's model: Chrono's project colours (`setProjectColor`, `projectName`),
its date and duration formatters, the translator itself (`t`, `formatNumber`, `locale`), the views.
An app's `lib.js` re-exports the builder next to them, and its `ui.js` is the `createUi` call
above, so the views keep reading `UI.Button`, `UI.el`... `types.d.ts` re-exports the option types.

Tooltips are not built here: Covenant draws them (`@simple-web-tools/covenant`, the Tooltip page of
the skill). `IconButton` returns the wrapper form, and `Covenant.setTooltip` is the form for a trigger
that cannot take a wrapper.

## Tests

```bash
npm test -w @simple-web-tools/dom
```

The repository has no jsdom or happy-dom, so the unit tests run against a small fake DOM
(`tests/support/fake-dom.js`: elements, attributes, reflected properties, events, a tiny
`querySelector`) that throws on `innerHTML`.

- `builder.test.js`: `el` (the refused properties, text nodes, CSSOM style, props), `icon`,
  `fieldId`, `initCovenant`, `createTNodes`.
- `ui.test.js`: every builder (classes, roles, ARIA links, the prefix, the translated labels,
  `Modal` and `Confirm` with Covenant's dialog calls, the toast region).

The browser is covered by the journeys of the apps that use the package (Chrono, Transient Notes).
