// The addresses of the links. Only `http:` and `https:` are accepted, from the form, from an
// import and from the migration of the old app: a `javascript:`, `data:` or `file:` address would
// run or read something the moment it is opened. Pure.

/** The longest address kept. */
export const MAX_URL_LENGTH = 2048;

/**
 * @typedef {{ ok: true, url: string } | { ok: false, reason: 'empty' | 'unsupported' | 'invalid' }} UrlResult
 */

/** A scheme written out: `https://`, `javascript:`, `mailto:`. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
/** After a colon, a port (`localhost:3000`) and not a scheme (`mailto:someone`). */
const PORT_AFTER_HOST = /^[a-z0-9.-]+:\d/i;

/**
 * What a typed or stored address stands for. A bare host (`example.com`) gets `https://`. An
 * address with another scheme (`javascript:`, `data:`, `mailto:`, `ftp://`...) is refused, so is
 * one that does not parse or has no host. The address is kept as typed (trimmed), not rewritten.
 * @param {unknown} raw
 * @returns {UrlResult}
 */
export function parseUrl(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const text = raw.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (text.length > MAX_URL_LENGTH) return { ok: false, reason: 'invalid' };

  let candidate = text;
  const scheme = SCHEME.exec(text);
  if (scheme) {
    const name = /** @type {string} */ (scheme[1]).toLowerCase();
    const written = text.slice(scheme[0].length).startsWith('//');
    if (name === 'http' || name === 'https') {
      // `http:example.com` is not an address the apps want: it needs its two slashes.
      if (!written) return { ok: false, reason: 'invalid' };
    } else if (written || !PORT_AFTER_HOST.test(text)) {
      return { ok: false, reason: 'unsupported' };
    } else {
      candidate = `https://${text}`; // `localhost:3000`
    }
  } else if (text.startsWith('//')) {
    candidate = `https:${text}`;
  } else {
    candidate = `https://${text}`;
  }

  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported' };
  }
  if (parsed.hostname === '') return { ok: false, reason: 'invalid' };
  return { ok: true, url: candidate };
}

/**
 * The address to store, or `null` when it is not an `http:` or `https:` one.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeUrl(raw) {
  const result = parseUrl(raw);
  return result.ok ? result.url : null;
}

/**
 * The address a link may be given to the browser with (`<a href>`, `window.open`), or `null`.
 * Defence in depth: stored addresses were checked, this is the last gate before the DOM.
 * @param {string} url
 * @returns {string | null}
 */
export function safeHref(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * The host of an address, without a leading `www.`, or `''`.
 * @param {string} url
 * @returns {string}
 */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/** The address of Google's favicon service. The only third-party host (decision 0008). */
export const FAVICON_SERVICE = 'https://www.google.com/s2/favicons';

/**
 * The address of the site icon of a link on Google's service, `''` when the link has no host.
 * Used only while the person turned "Load site icons from Google" on. The query holds the host
 * of the link, nothing else.
 * @param {string} url
 * @returns {string}
 */
export function faviconUrl(url) {
  if (safeHref(url) === null) return '';
  /** @type {string} */
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return '';
  }
  if (host === '') return '';
  const query = new URLSearchParams({ sz: '32', domain: host });
  return `${FAVICON_SERVICE}?${query.toString()}`;
}

/**
 * The letter that stands for a site while its icon is not loaded, or is not asked for: the first
 * letter of its host, else of its name, in capitals.
 * @param {{ url: string, name: string }} link
 * @returns {string}
 */
export function siteInitial({ url, name }) {
  const text = hostOf(url) || name.trim();
  const first = Array.from(text)[0];
  return first ? first.toLocaleUpperCase() : '?';
}
