import { Marked } from 'marked';
import { highlightCode } from './highlight.js';
import { decodeEntities, escapeHtml } from './text.js';

/**
 * The HTML of a fenced block of code.
 * - `mermaid`: a `<pre class="slide__diagram mermaid">` that holds the source as text, which the
 *   Mermaid chunk turns into an SVG once the slide is on screen.
 * - a registered language: highlighted.
 * - anything else: the code, escaped, not highlighted.
 * @param {{ text: string, lang?: string }} token
 */
function renderCode({ text, lang }) {
  const language = (lang ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';

  if (language === 'mermaid') {
    return `<pre class="slide__diagram mermaid">${escapeHtml(text)}</pre>`;
  }

  const highlighted = highlightCode(text, language);
  if (highlighted !== null) {
    return `<pre class="slide__code hljs"><code class="language-${escapeHtml(language)}">${highlighted}</code></pre>`;
  }
  return `<pre class="slide__code"><code>${escapeHtml(text)}</code></pre>`;
}

/**
 * The plain text of inline tokens: what a person reads, with no marks and no entities.
 * @param {readonly import('marked').Token[] | undefined} tokens
 * @returns {string}
 */
function plainText(tokens) {
  let text = '';
  for (const token of tokens ?? []) {
    if ('tokens' in token && token.tokens) text += plainText(token.tokens);
    else if (token.type === 'br') text += ' ';
    else if (token.type === 'html' || token.type === 'space') continue;
    else if ('text' in token && typeof token.text === 'string') text += token.text;
  }
  return text;
}

/**
 * The title (first heading of level 1 to 3) and the description (first paragraph) of a slide, as
 * plain text, for the overview and the "next slide" card.
 * @param {readonly import('marked').Token[]} tokens
 * @returns {{ title: string, description: string }}
 */
function summarize(tokens) {
  const heading = tokens.find((token) => token.type === 'heading' && token.depth <= 3);
  const paragraph = tokens.find((token) => token.type === 'paragraph');
  const clean = (/** @type {string} */ text) => decodeEntities(text).replace(/\s+/g, ' ').trim();
  return {
    title: heading && 'tokens' in heading ? clean(plainText(heading.tokens)) : '',
    description: paragraph && 'tokens' in paragraph ? clean(plainText(paragraph.tokens)) : '',
  };
}

/**
 * A Markdown renderer (GitHub flavoured). One instance serves the content and the notes of every
 * slide of a presentation. The HTML it returns is NOT safe: raw HTML of the source passes through,
 * and the adapter sanitizes it before it reaches the page.
 */
export function createMarkdownRenderer() {
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({ renderer: { code: renderCode } });

  return {
    /**
     * @param {string} markdown
     * @returns {{ html: string, title: string, description: string }}
     */
    render(markdown) {
      if (!markdown) return { html: '', title: '', description: '' };
      const tokens = marked.lexer(markdown);
      return { html: marked.parser(tokens), ...summarize(tokens) };
    },
  };
}
