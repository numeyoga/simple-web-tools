// Locale negotiation. Pure: the caller passes `navigator.languages`, this module never reads it.

/**
 * Normalize a BCP 47 tag for comparison: lowercase, `_` read as `-`. Returns `null` for values
 * that are not a plausible tag (empty, `*`, spaces, ...).
 * @param {unknown} tag
 * @returns {string | null}
 */
function normalize(tag) {
  if (typeof tag !== 'string') return null;
  const value = tag.trim().replace(/_/g, '-').toLowerCase();
  return /^[a-z]{2,3}(-[a-z0-9]{1,8})*$/.test(value) ? value : null;
}

/**
 * Pick the supported locale that best matches the user's preferences.
 *
 * For each requested tag, in order: an exact match (case-insensitive), then the same tag with
 * trailing subtags dropped (`fr-CA` matches `fr`; `zh-Hant-TW` tries `zh-Hant`, then `zh`),
 * then any supported tag of the same language (`fr` matches `fr-FR`). The first request that
 * matches wins, so `['fr-CA', 'en']` picks `fr` before `en`. Nothing matching returns `fallback`.
 * The result always uses the spelling of `supported`.
 *
 * @param {object} input
 * @param {readonly string[]} input.requested preferences, most wanted first (`navigator.languages`)
 * @param {readonly string[]} input.supported locales the app has catalogs for
 * @param {string} input.fallback returned when nothing matches
 * @returns {string}
 */
export function negotiateLocale({ requested, supported, fallback }) {
  /** @type {Map<string, string>} */
  const byTag = new Map();
  for (const locale of supported) {
    const tag = normalize(locale);
    if (tag && !byTag.has(tag)) byTag.set(tag, locale);
  }
  for (const request of requested ?? []) {
    const tag = normalize(request);
    if (!tag) continue;
    const parts = tag.split('-');
    for (let length = parts.length; length > 0; length -= 1) {
      const match = byTag.get(parts.slice(0, length).join('-'));
      if (match) return match;
    }
    for (const [candidate, locale] of byTag) {
      if (candidate.split('-')[0] === parts[0]) return locale;
    }
  }
  return fallback;
}
