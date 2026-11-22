// The example presentation, bundled with the app: one per language of the interface, loaded the same
// way as a folder the person chooses, so it exercises the real path (folder reader, sanitizer,
// object URLs, Mermaid). Each language is its own small chunk, loaded when it is asked for.

/** @typedef {import('./folder.js').FolderFile} FolderFile */

/** @type {Record<string, () => Promise<Record<string, string>>>} */
const BUNDLES = {
  en: () => import('../examples/en.js').then((module) => module.default),
  fr: () => import('../examples/fr.js').then((module) => module.default),
};

/** The file types of the example's files, by extension. */
const TYPES = { '.md': 'text/markdown', '.svg': 'image/svg+xml' };

/**
 * The files of the example in a language, as if the person had chosen its folder.
 * @param {string} locale the interface locale (`en`, `fr-CA`...): its language picks the example
 * @returns {Promise<FolderFile[]>}
 */
export async function loadExample(locale) {
  const language = locale.split('-')[0] ?? 'en';
  const load = BUNDLES[language] ?? BUNDLES.en;
  const bundle = await /** @type {() => Promise<Record<string, string>>} */ (load)();
  return Object.entries(bundle).map(([name, text]) => {
    const extension = name.slice(name.lastIndexOf('.'));
    const type = TYPES[/** @type {keyof typeof TYPES} */ (extension)] ?? 'text/plain';
    return {
      file: new File([text], name.split('/').pop() ?? name, { type }),
      path: `example/${name}`,
    };
  });
}
