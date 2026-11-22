// Group colours. A group stores a Covenant category number (1 to 16, `data-cat`), never a hex
// value, so that the palette can be retuned without a migration. The old app stored one of 12
// hex colours: `categoryFromHex` maps them. Pure.

/** The number of Covenant category colours. */
export const CATEGORY_COUNT = 16;

/** The colour of a group that has none, and of the groups the migration makes up: slate. */
export const DEFAULT_CATEGORY = 16;

/**
 * The order the Covenant skill advises for new categories: the first six stay apart for every
 * kind of colour vision.
 */
export const CATEGORY_ORDER = Object.freeze([
  9, 4, 14, 10, 7, 6, 16, 13, 8, 11, 12, 5, 3, 2, 15, 1,
]);

/** Every category number, in the order of the palette. */
export const CATEGORIES = Object.freeze(Array.from({ length: CATEGORY_COUNT }, (_, i) => i + 1));

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isCategory(value) {
  return (
    Number.isInteger(value) &&
    /** @type {number} */ (value) >= 1 &&
    /** @type {number} */ (value) <= CATEGORY_COUNT
  );
}

/**
 * The palette of the old app, with the Covenant category each colour stands for. The hue is the
 * same: blue, teal, violet, amber, green, pink, indigo, slate, rose, cyan, lime, purple.
 * @type {readonly (readonly [string, number])[]}
 */
export const LEGACY_PALETTE = Object.freeze([
  ['#2563eb', 9],
  ['#0d9488', 6],
  ['#8b5cf6', 11],
  ['#d97706', 2],
  ['#16a34a', 5],
  ['#db2777', 14],
  ['#6366f1', 10],
  ['#64748b', 16],
  ['#f43f5e', 15],
  ['#0891b2', 7],
  ['#84cc16', 4],
  ['#a855f7', 12],
]);

/**
 * @param {string} hex `#rgb` or `#rrggbb`
 * @returns {[number, number, number] | null}
 */
function parseHex(hex) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const digits = /** @type {string} */ (match[1]);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * The category of a colour of the old app: the same hue for the 12 colours it offered, the
 * nearest of those 12 (in RGB) for any other valid hex colour, slate for anything else.
 * @param {unknown} hex
 * @returns {number}
 */
export function categoryFromHex(hex) {
  if (typeof hex !== 'string') return DEFAULT_CATEGORY;
  const rgb = parseHex(hex);
  if (!rgb) return DEFAULT_CATEGORY;
  let best = DEFAULT_CATEGORY;
  let bestDistance = Infinity;
  for (const [known, category] of LEGACY_PALETTE) {
    const other = /** @type {[number, number, number]} */ (parseHex(known));
    const distance = (rgb[0] - other[0]) ** 2 + (rgb[1] - other[1]) ** 2 + (rgb[2] - other[2]) ** 2;
    if (distance < bestDistance) {
      best = category;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The colour a new group gets: the first of the advised order that no group uses; when all 16 are
 * used, the order starts again (the name tells two groups apart).
 * @param {readonly { category: number }[]} groups
 * @returns {number}
 */
export function nextCategory(groups) {
  const used = new Set(groups.map((group) => group.category));
  const free = CATEGORY_ORDER.find((category) => !used.has(category));
  return free ?? /** @type {number} */ (CATEGORY_ORDER[groups.length % CATEGORY_ORDER.length]);
}
