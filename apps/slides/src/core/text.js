// Small text helpers.

/**
 * Escapes the characters that matter in element content and in a quoted attribute value.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Keeps a number inside `[min, max]`.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * A duration in milliseconds as `MM:SS`, or `H:MM:SS` from one hour.
 * @param {number} milliseconds
 */
export function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

const NAMED_ENTITIES = /** @type {Record<string, string>} */ ({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
});

/**
 * Turns the character references of a text into the characters (`&amp;` into `&`, `&#39;` into
 * `'`): Markdown's inline tokens keep the text as HTML would carry it.
 * @param {string} text
 * @returns {string}
 */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name) => {
    const key = String(name);
    if (key.startsWith('#')) {
      const code =
        key[1] === 'x' || key[1] === 'X' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED_ENTITIES[key.toLowerCase()] ?? whole;
  });
}
