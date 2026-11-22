// The icon in front of a link: a coloured initial (the colour of the group), and, only while the
// person turned "Load site icons from Google" on, the site's own icon on top of it (decision
// 0008). With the preference off no element here has an address to load, so no request leaves
// the page.
import { faviconUrl, siteInitial } from '../../core/url.js';
import * as UI from './ui.js';

const { el } = UI;

/**
 * @param {{ url: string, name: string }} link
 * @param {{ remote: boolean }} options `remote`: the site icons preference
 * @returns {HTMLElement}
 */
export function createSiteIcon(link, { remote }) {
  const icon = el('span', { class: 'fv-site-icon', 'aria-hidden': 'true' }, siteInitial(link));
  const source = remote ? faviconUrl(link.url) : '';
  if (source) {
    const image = el('img', {
      class: 'fv-site-icon__image',
      src: source,
      alt: '',
      width: 16,
      height: 16,
      loading: 'lazy',
      decoding: 'async',
      referrerpolicy: 'no-referrer',
    });
    // The initial stays while the icon loads and when it cannot: Google answers a site it does
    // not know with a generic globe, and a failed request must not leave a broken picture.
    image.addEventListener('load', () => icon.classList.add('fv-site-icon--loaded'));
    image.addEventListener('error', () => image.remove());
    icon.append(image);
  }
  return icon;
}
