// Catalog shape, flattening and message rendering. Pure: no DOM, no storage, no clock.

/**
 * A catalog: nested objects whose leaves are strings or plural objects. Dotted keys work too
 * (`{ 'tasks.title': 'Tasks' }`), so a catalog can be nested, flat or a mix of both.
 * @typedef {{ [key: string]: string | PluralMessage | Catalog }} Catalog
 */

/**
 * A plural message: an object keyed by plural category (`zero`, `one`, `two`, `few`, `many`,
 * `other`) and/or exact counts (`=0`, `=1`). `other` is required.
 * @typedef {{ [category: string]: string }} PluralMessage
 */

/** @typedef {Record<string, string | PluralMessage>} FlatCatalog */

export const PLURAL_CATEGORIES = Object.freeze(['zero', 'one', 'two', 'few', 'many', 'other']);

const EXACT = /^=\d+$/;
const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * Whether an object is a plural message rather than a namespace: it has an `other` string and
 * every key is a plural category or an exact count. (A namespace whose keys are all category
 * names, including `other`, would be read as a plural message: avoid such key names.)
 * @param {unknown} value
 * @returns {value is PluralMessage}
 */
export function isPluralMessage(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const record = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof record.other === 'string' &&
    keys.every(
      (key) =>
        (PLURAL_CATEGORIES.includes(key) || EXACT.test(key)) && typeof record[key] === 'string',
    )
  );
}

/**
 * Flatten a nested catalog into dotted keys. Leaves are strings and plural messages.
 * Values of any other type are ignored.
 * @param {Catalog} catalog
 * @returns {FlatCatalog}
 */
export function flattenCatalog(catalog) {
  /** @type {FlatCatalog} */
  const flat = {};
  /** @param {Catalog} node @param {string} prefix */
  const walk = (node, prefix) => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string' || isPluralMessage(value)) flat[path] = value;
      else if (typeof value === 'object' && value !== null && !Array.isArray(value))
        walk(/** @type {Catalog} */ (value), path);
    }
  };
  walk(catalog, '');
  return flat;
}

/**
 * Placeholder names used by a message (all variants of a plural message).
 * @param {string | PluralMessage} message
 * @returns {string[]} sorted, unique
 */
export function extractPlaceholders(message) {
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  const names = new Set();
  for (const text of texts) {
    for (const match of text.matchAll(PLACEHOLDER)) names.add(match[1]);
  }
  return [...names].sort();
}

/**
 * Fill `{name}` placeholders. A missing parameter leaves the placeholder visible in the output
 * (`{name}`), never `undefined`.
 * @param {string} template
 * @param {Record<string, unknown>} params
 * @param {(name: string) => void} [onMissingParam]
 * @returns {string}
 */
export function interpolate(template, params, onMissingParam) {
  return template.replace(PLACEHOLDER, (placeholder, name) => {
    const value = Object.hasOwn(params, name) ? params[name] : undefined;
    if (value === undefined || value === null) {
      onMissingParam?.(name);
      return placeholder;
    }
    return String(value);
  });
}

/**
 * Pick the variant of a plural message for a count: exact `=N` first, then the plural category
 * of the catalog's locale, then `other`.
 * @param {PluralMessage} message
 * @param {number} count
 * @param {Intl.PluralRules} rules rules of the language the message is written in
 * @returns {string}
 */
export function selectPlural(message, count, rules) {
  const exact = message[`=${count}`];
  if (exact !== undefined) return exact;
  return message[rules.select(count)] ?? message.other ?? '';
}
