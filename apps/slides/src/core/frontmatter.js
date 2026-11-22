import { parse as parseYaml } from 'yaml';
import { PresentationError } from './errors.js';

// The frontmatter, when there is one, is a YAML block between two `---` lines at the very start
// of the file. Its position removes the ambiguity with the slide separator, which is also `---`.
const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** @typedef {{ title?: unknown, description?: unknown, author?: unknown, theme?: unknown, ratio?: unknown }} RawMeta */

/**
 * `auto` stays `auto`; any other value that is set stands for the fixed 16:9 frame.
 * @param {unknown} value
 * @returns {'auto' | 'fixed' | undefined}
 */
function normalizeRatio(value) {
  if (value === 'auto') return 'auto';
  return value ? 'fixed' : undefined;
}

/**
 * Splits the frontmatter from the body. A block that is not a YAML mapping (a first slide framed
 * by two separators, for instance) is not a frontmatter: the whole source is the body.
 * @param {string} source
 * @returns {{ meta: RawMeta, body: string }}
 * @throws {PresentationError} `invalid-frontmatter` when the block is not valid YAML
 */
export function extractFrontmatter(source) {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) return { meta: {}, body: source };

  /** @type {unknown} */
  let raw;
  try {
    raw = parseYaml(match[1] ?? '');
  } catch (error) {
    throw new PresentationError(
      'invalid-frontmatter',
      error instanceof Error ? (error.message.split('\n')[0] ?? '') : '',
    );
  }
  // A block with nothing but comments parses to `null`: it is a slide that starts with a heading.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { meta: {}, body: source };
  }

  const record = /** @type {RawMeta} */ (raw);
  const meta = {
    ...record,
    ...(record.ratio !== undefined ? { ratio: normalizeRatio(record.ratio) } : {}),
  };
  return { meta, body: source.slice(match[0].length) };
}
