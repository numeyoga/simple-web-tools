// DOM helpers and the text of the interface. The element builder (el, mount, icon, fieldId) is
// `@simple-web-tools/dom`, re-exported here so that the views get it with the rest from `UI`:
// markup is built with `el()` and `append`, never with `innerHTML`, so a user's text (a note
// title, a folder name) is only ever a text node.

import {
  appendChildren,
  createTNodes,
  el,
  fieldId,
  icon,
  initCovenant,
  mount,
} from '@simple-web-tools/dom';
import { i18n } from '../i18n.js';

export { appendChildren, el, fieldId, icon, initCovenant, mount };

/* ------------------------------------------------------------------ */
/* Text and formatting, in the language of the interface (adapters/i18n.js)  */

export const t = i18n.t;
export const formatNumber = i18n.formatNumber;

/**
 * A message with DOM nodes in place of some of its placeholders (`{key}` holds a `<kbd>`, a
 * styled figure...). The translator writes the sentence, so a language can move the node.
 */
export const tNodes = createTNodes(t);

/** Dates and times in the language and region of the page. */
export const formatDateTime = i18n.formatDateTime;
export const formatDate = i18n.formatDate;

/** The language of the interface, for `localeCompare`, `Intl.Collator` and the like. */
export const locale = i18n.locale;
