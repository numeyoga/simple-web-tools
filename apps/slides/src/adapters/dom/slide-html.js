// The one place where the HTML of a slide enters the page.
//
// `slides.md` is the person's own file, but a presentation is often someone else's: the Markdown
// renderer lets raw HTML through (`<img src=x onerror=...>`, `<script>`, `javascript:` links), so
// everything goes through DOMPurify first, and this module is the only caller of `setSlideHtml`
// for slide content (slides, notes, overview, print). It builds a DocumentFragment and swaps it
// in with `replaceChildren`: no `innerHTML` anywhere in the app. The presenter window sanitizes
// what it receives on the channel again, since the channel is open to every page of the origin.
//
// After sanitizing, images and links are resolved against what the CSP allows:
// - an image of the folder becomes its `blob:` URL, any other image is replaced by a placeholder
//   that says why it is not shown (remote, inline, unsupported, missing);
// - only `http:`, `https:` and `mailto:` links stay clickable, and they open in a new tab with no
//   opener, so a click never replaces the presentation.
//
// `script-src 'self'` and `img-src 'self' blob:` stay the second line of defence.
import { classifyImage, safeLinkHref } from '../../core/assets.js';
import {
  KEPT_IMAGE_ATTRIBUTES,
  KEPT_LINK_ATTRIBUTES,
  keepOnly,
  openInNewTab,
  sanitizeToFragment,
} from '../sanitizer.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/**
 * The two lines of a placeholder: what is missing and why.
 * @param {import('../../core/assets.js').BlockedReason} reason
 * @returns {{ title: string, reason: string }}
 */
function blockedText(reason) {
  switch (reason) {
    case 'remote':
      return { title: t('slide.image.remote.title'), reason: t('slide.image.remote.reason') };
    case 'inline':
      return { title: t('slide.image.inline.title'), reason: t('slide.image.inline.reason') };
    case 'missing':
      return { title: t('slide.image.missing.title'), reason: t('slide.image.missing.reason') };
    default:
      return {
        title: t('slide.image.unsupported.title'),
        reason: t('slide.image.unsupported.reason'),
      };
  }
}

/**
 * @param {import('../../core/assets.js').BlockedReason} reason
 * @param {string} shown the address or path, shown as written
 * @param {string} alt
 */
function placeholder(reason, shown, alt) {
  const text = blockedText(reason);
  return el(
    'span',
    { class: 'sl-blocked', 'data-reason': reason },
    icon('image-broken', { className: 'sl-blocked__icon' }),
    el(
      'span',
      { class: 'sl-blocked__text' },
      el('strong', null, text.title),
      el('span', null, text.reason),
      alt ? el('span', null, t('slide.image.alt', { alt })) : null,
      shown ? el('code', { class: 'sl-blocked__address' }, shown) : null,
    ),
  );
}

/**
 * @param {ParentNode} fragment
 * @param {Readonly<Record<string, string>>} assets image path to object URL
 */
function resolveResources(fragment, assets) {
  for (const image of fragment.querySelectorAll('img')) {
    const source = image.getAttribute('src') ?? '';
    const found = classifyImage(source, (key) => Object.hasOwn(assets, key));
    if (found.kind === 'asset') {
      keepOnly(image, KEPT_IMAGE_ATTRIBUTES);
      image.setAttribute('src', /** @type {string} */ (assets[found.key]));
    } else {
      image.replaceWith(placeholder(found.reason, found.shown, image.getAttribute('alt') ?? ''));
    }
  }

  for (const link of fragment.querySelectorAll('a')) {
    const href = safeLinkHref(link.getAttribute('href') ?? '');
    keepOnly(link, KEPT_LINK_ATTRIBUTES);
    if (href !== null) openInNewTab(link, href);
  }
}

/**
 * Replaces the content of an element with the sanitized HTML of a slide (or of its notes).
 * @param {Element} target
 * @param {string} html the rendered Markdown, not trusted
 * @param {Readonly<Record<string, string>>} assets image path to object URL
 */
export function setSlideHtml(target, html, assets) {
  const fragment = sanitizeToFragment(html);
  resolveResources(fragment, assets);
  target.replaceChildren(fragment);
}
