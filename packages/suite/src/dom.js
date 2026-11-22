import { APPS, appHref, findApp } from './apps.js';

/**
 * DOM builders for the sidebar of every app. Adapter code: it belongs in an app's
 * `src/adapters`. Elements are made with `createElement` and `textContent` only, never
 * from a markup string.
 */

const HEADING_ID = 'swt-switcher-heading';

/**
 * @param {Document} doc
 * @param {string} tag
 * @param {Record<string, string>} attributes
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function element(doc, tag, attributes, text) {
  const el = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * The logo (a Phosphor icon) and the name of an app, to be the first child of the
 * `<nav class="cv-sidebar">`.
 * @param {string} currentId Id of the app that shows it.
 * @param {{ doc?: Document }} [options]
 * @returns {HTMLElement}
 */
export function createAppBrand(currentId, { doc = document } = {}) {
  const app = findApp(currentId);
  const brand = element(doc, 'div', { class: 'cv-sidebar__brand' });
  brand.append(
    element(doc, 'i', {
      class: `ph-bold ph-${app.icon} cv-icon swt-brand__icon`,
      'aria-hidden': 'true',
    }),
    element(doc, 'span', {}, app.name),
  );
  return brand;
}

/**
 * A group of links to every app, to be the last child of the `<nav class="cv-sidebar">`
 * (it is already a navigation landmark, so this is not a `<nav>`). The current app links to
 * `./` and carries `aria-current="page"`. The links only resolve on the assembled site.
 * @param {string} currentId Id of the app that shows it.
 * @param {{ label: string, doc?: Document }} options `label` is the translated heading.
 * @returns {HTMLElement}
 */
export function createAppSwitcher(currentId, { label, doc = document }) {
  findApp(currentId);
  const switcher = element(doc, 'div', { class: 'swt-switcher' });
  const heading = element(
    doc,
    'div',
    { class: 'cv-overline cv-sidebar__group', id: HEADING_ID },
    label,
  );
  const list = element(doc, 'ul', { 'aria-labelledby': HEADING_ID });
  for (const app of APPS) {
    const current = app.id === currentId;
    const link = element(doc, 'a', {
      class: 'cv-nav-item swt-switcher__link',
      href: current ? './' : appHref(app.id),
    });
    if (current) link.setAttribute('aria-current', 'page');
    link.append(
      element(doc, 'i', { class: `ph ph-${app.icon} cv-icon`, 'aria-hidden': 'true' }),
      element(doc, 'span', {}, app.name),
    );
    const item = element(doc, 'li', {});
    item.append(link);
    list.append(item);
  }
  switcher.append(heading, list);
  return switcher;
}
