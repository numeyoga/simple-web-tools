// Cuts the body of the document into slides.
//
// A slide ends at a line that holds only `---` (spaces around it are allowed). A horizontal rule
// inside a slide is written `***` or `___`. A line of `---` inside a fenced code block (a YAML
// sample, for instance) belongs to the code and does not cut the slide.

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const SEPARATOR = /^[ \t]*---[ \t]*$/;

/**
 * @param {string} body
 * @returns {string[]} the slides, trimmed, the empty ones left out
 */
export function splitSlides(body) {
  /** @type {string[]} */
  const slides = [];
  /** @type {string[]} */
  let current = [];
  /** @type {{ char: string, length: number } | null} */
  let fence = null;

  for (const line of body.split(/\r?\n/)) {
    if (fence) {
      const close = new RegExp(`^ {0,3}\\${fence.char}{${fence.length},}[ \\t]*$`);
      if (close.test(line)) fence = null;
      current.push(line);
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) {
      const marks = open[1] ?? '```';
      fence = { char: marks.charAt(0), length: marks.length };
      current.push(line);
      continue;
    }
    if (SEPARATOR.test(line)) {
      slides.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  slides.push(current.join('\n'));

  return slides.map((slide) => slide.trim()).filter((slide) => slide.length > 0);
}
