// Syntax highlighting. Only the core of highlight.js and the grammars listed here are bundled
// (tree-shaking keeps the rest out). To add a language: import its grammar from
// `highlight.js/lib/languages/<name>` and add a `[name, grammar]` entry below; the usual aliases
// (`js`, `ts`, `yml`) come with the grammar.
import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';

const GRAMMARS = /** @type {const} */ ([
  ['java', java],
  ['javascript', javascript],
  ['typescript', typescript],
  ['json', json],
  ['yaml', yaml],
]);

for (const [name, grammar] of GRAMMARS) hljs.registerLanguage(name, grammar);

/** The canonical names of the languages that are highlighted. */
export const HIGHLIGHTED_LANGUAGES = Object.freeze(GRAMMARS.map(([name]) => name));

/**
 * The highlighted HTML of a block of code (every character of the code escaped), or `null` when
 * the language is not one of the registered grammars.
 * @param {string} code
 * @param {string} language
 * @returns {string | null}
 */
export function highlightCode(code, language) {
  if (!language || !hljs.getLanguage(language)) return null;
  return hljs.highlight(code, { language, ignoreIllegals: true }).value;
}
