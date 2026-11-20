// Project colours: the 16 categories of the Covenant palette (`data-cat` 1 to 16), and the
// free colour that a project may keep instead (`#rrggbb`). Pure: the views draw both through
// `Covenant.setCategory`, the migration (core/migrations.js) maps the old hex values onto the
// numbers.

/** @typedef {import('../types.js').Project} Project */

export const CATEGORY_COUNT = 16;

/**
 * The order in which new projects take a category: blue, lime, pink, indigo, cyan, teal, slate,
 * fuchsia, sky, violet, purple, green, yellow, amber, rose, orange. The first six stay apart
 * for every kind of colour vision; the hues that are easily taken for a status come last.
 * @type {readonly number[]}
 */
export const DEFAULT_CATEGORY_ORDER = Object.freeze([
  9, 4, 14, 10, 7, 6, 16, 13, 8, 11, 12, 5, 3, 2, 15, 1,
]);

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isCategory(value) {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= CATEGORY_COUNT
  );
}

/**
 * `#rgb` or `#rrggbb` (any case) as lowercase `#rrggbb`; null for anything else.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(hex);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : null;
}

/**
 * The category a new project takes: the first one of the default order that no active project
 * uses. When the 16 are all in use, the order starts again (the least used category, the first
 * in the order on a tie): two projects then share a colour, and their names tell them apart.
 * A project with a free colour, or an archived one, uses no category.
 * @param {readonly Pick<Project, 'category' | 'archived'>[]} projects
 * @returns {number}
 */
export function nextCategory(projects) {
  /** @type {Map<number, number>} */
  const uses = new Map(DEFAULT_CATEGORY_ORDER.map((n) => [n, 0]));
  for (const project of projects) {
    if (project.archived || !isCategory(project.category)) continue;
    uses.set(project.category, (uses.get(project.category) ?? 0) + 1);
  }
  let best = /** @type {number} */ (DEFAULT_CATEGORY_ORDER[0]);
  for (const n of DEFAULT_CATEGORY_ORDER) {
    if ((uses.get(n) ?? 0) < (uses.get(best) ?? 0)) best = n;
  }
  return best;
}
