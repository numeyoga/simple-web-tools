// The notes of a slide, written as containers.
//
//   :::notes-public
//   Notes printed with the slide.
//   :::
//
//   :::notes-presenter
//   Notes shown in the presenter window only.
//   :::
//
// The directives are taken out of the slide before it is rendered. Several of the same kind are
// joined in the order they appear.
const DIRECTIVE_PATTERN =
  /^:::[ \t]*(notes-public|notes-presenter)[ \t]*\r?\n([\s\S]*?)\r?\n:::[ \t]*$/gm;

/** @type {Record<string, 'public' | 'presenter'>} */
const KEY_BY_NAME = {
  'notes-public': 'public',
  'notes-presenter': 'presenter',
};

/**
 * @param {string} slideSource
 * @returns {{ content: string, notes: { public: string, presenter: string } }} the slide without
 *   its directives, and the raw Markdown of each kind of notes (empty when there is none)
 */
export function extractDirectives(slideSource) {
  /** @type {{ public: string[], presenter: string[] }} */
  const collected = { public: [], presenter: [] };

  for (const match of slideSource.matchAll(DIRECTIVE_PATTERN)) {
    const key = KEY_BY_NAME[match[1] ?? ''];
    if (key) collected[key].push((match[2] ?? '').trim());
  }

  return {
    content: slideSource.replace(DIRECTIVE_PATTERN, '').trim(),
    notes: {
      public: collected.public.join('\n\n'),
      presenter: collected.presenter.join('\n\n'),
    },
  };
}
