// Where an image or a link of a slide points, and whether the app may show it. The CSP only lets
// the page load images from itself and from `blob:` (the folder's images become object URLs), so
// every other source gets a placeholder that says why.

/**
 * @typedef {'remote' | 'inline' | 'unsupported' | 'missing'} BlockedReason
 * @typedef {{ kind: 'asset', key: string }
 *   | { kind: 'blocked', reason: BlockedReason, shown: string }} ImageSource
 */

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * The path of a file of the folder that a relative reference stands for: `./assets/a%20b.png` is
 * `assets/a b.png`. `null` for anything that is not a reference inside the folder (an address with
 * a scheme, a `//host` one, an absolute path, a path that climbs out with `..`).
 * @param {string} source
 * @returns {string | null}
 */
export function assetKeyOf(source) {
  let path = source.trim();
  if (path === '' || SCHEME.test(path) || path.startsWith('/') || path.startsWith('\\'))
    return null;
  path = path.replace(/[?#].*$/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  const parts = path.split('/').filter((part) => part !== '.' && part !== '');
  if (parts.length === 0 || parts.some((part) => part === '..' || part.includes('\\'))) return null;
  return parts.join('/');
}

/**
 * What an `<img src>` of a slide is.
 * @param {string} source the `src` attribute as written
 * @param {(key: string) => boolean} hasAsset whether the folder holds this image
 * @returns {ImageSource}
 */
export function classifyImage(source, hasAsset) {
  const text = source.trim();
  const scheme = SCHEME.exec(text)?.[1]?.toLowerCase();
  if (text.startsWith('//') || scheme === 'http' || scheme === 'https') {
    return { kind: 'blocked', reason: 'remote', shown: text };
  }
  if (scheme === 'data') return { kind: 'blocked', reason: 'inline', shown: '' };
  if (scheme) return { kind: 'blocked', reason: 'unsupported', shown: text };
  const key = assetKeyOf(text);
  if (key === null) return { kind: 'blocked', reason: 'unsupported', shown: text };
  if (!hasAsset(key)) return { kind: 'blocked', reason: 'missing', shown: key };
  return { kind: 'asset', key };
}

/**
 * The address of a link that may stay clickable: an absolute `http:`, `https:` or `mailto:` one.
 * Anything else (`javascript:`, `data:`, a relative path that would lead nowhere) is `null`.
 * @param {string} href
 * @returns {string | null}
 */
export function safeLinkHref(href) {
  const text = href.trim();
  const scheme = SCHEME.exec(text)?.[1]?.toLowerCase();
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' ? text : null;
}
