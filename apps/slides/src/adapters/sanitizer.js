// DOMPurify, configured for the HTML of a slide. The only caller is adapters/dom/slide-html.js,
// the one place where slide HTML enters the page (see its header).
import DOMPurify from 'dompurify';

/** What a slide may contain: HTML, no forms, no embedded content, no inline style. */
const SANITIZER_CONFIG = Object.freeze({
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    'style',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'applet',
    'link',
    'meta',
    'base',
    'video',
    'audio',
    'source',
    'track',
    'picture',
  ],
  FORBID_ATTR: ['style', 'id', 'name', 'srcset', 'sizes', 'action', 'formaction', 'ping'],
  ALLOW_DATA_ATTR: false,
  RETURN_DOM_FRAGMENT: true,
});

/** The attributes an image keeps once its source is resolved. */
export const KEPT_IMAGE_ATTRIBUTES = Object.freeze(['alt', 'title', 'width', 'height']);
/** The attributes a link keeps. */
export const KEPT_LINK_ATTRIBUTES = Object.freeze(['title']);

/**
 * The sanitized DOM of a piece of slide HTML: `<script>`, event handlers, `javascript:` addresses,
 * forms, frames and inline styles are gone.
 * @param {string} html
 * @returns {DocumentFragment}
 */
export function sanitizeToFragment(html) {
  return /** @type {DocumentFragment} */ (DOMPurify.sanitize(html, SANITIZER_CONFIG));
}

/**
 * Removes every attribute of an element that is not in the list.
 * @param {Element} element
 * @param {readonly string[]} kept
 */
export function keepOnly(element, kept) {
  for (const { name } of [...element.attributes]) {
    if (!kept.includes(name)) element.removeAttribute(name);
  }
}

/**
 * Makes a link open in a new tab with no opener, so a click never replaces the presentation.
 * @param {Element} link
 * @param {string} href
 */
export function openInNewTab(link, href) {
  link.setAttribute('href', href);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer');
}
