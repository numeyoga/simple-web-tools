// The text of index.html. The page holds no text of its own: an element with `data-i18n="key"`
// gets that message as its text, and `data-i18n-attrs="attribute:key;attribute:key"` sets
// attributes (`aria-label`, `placeholder`, `data-lc-tooltip`). The keys are checked against the
// catalogs by tests/unit/i18n-catalogs.test.js, and the absence of any other text by
// tests/unit/static-markup.test.js.

import { t as translate } from '../i18n.js';

/**
 * Writes the messages of the page's language into the elements that ask for them.
 * @param {ParentNode} [root]
 */
export function translateStaticMarkup(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = translate(node.getAttribute('data-i18n') ?? '');
  }
  for (const node of root.querySelectorAll('[data-i18n-attrs]')) {
    for (const pair of (node.getAttribute('data-i18n-attrs') ?? '').split(';')) {
      const [attribute, key] = pair.split(':');
      if (attribute && key) node.setAttribute(attribute, translate(key));
    }
  }
}
