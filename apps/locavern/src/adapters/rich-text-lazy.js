/** @import { RichTextDoc } from '../types.d.ts' */

import { showChunkError, showChunkLoading } from './dom/lazy-chunk-state.js';
import { t } from './i18n.js';

/**
 * Lazy front door of the rich-text editor. Tiptap and its extensions are most of the
 * application's third-party code: they live in their own chunk, fetched by a dynamic `import()`
 * the first time an editor is shown (a note, a task description). The chunk is in the service
 * worker's precache, so the editor also opens offline after a first visit. CSP
 * `script-src 'self'` covers it: same origin.
 *
 * Once the chunk is in, `mountRichTextEditor` mounts at once and returns the real editor's
 * handle, as before. Until then it returns a stand-in with the same shape: `getDoc()` gives the
 * document the editor was given or last `setDoc()` with (nothing can have been typed yet), and
 * `destroy()` cancels the pending mount.
 *
 * @typedef {typeof import('./rich-text-tiptap.js')} EditorModule
 * @typedef {Parameters<EditorModule['mountRichTextEditor']>[0]} RichTextEditorOptions
 * @typedef {ReturnType<EditorModule['mountRichTextEditor']>} RichTextEditorHandle
 */

/** @type {Promise<EditorModule> | null} */
let pending = null;
/** @type {EditorModule | null} */
let loaded = null;

/**
 * Load the editor chunk once. A failed load is forgotten, so that a retry fetches it again.
 * @returns {Promise<EditorModule>}
 */
function loadEditorModule() {
  if (!pending) {
    pending = import('./rich-text-tiptap.js').then(
      (module) => {
        loaded = module;
        return module;
      },
      (error) => {
        pending = null;
        throw error;
      },
    );
  }
  return pending;
}

/**
 * Same contract as `mountRichTextEditor` of `rich-text-tiptap.js`.
 * @param {RichTextEditorOptions} options
 * @returns {RichTextEditorHandle}
 */
export function mountRichTextEditor(options) {
  if (loaded) return loaded.mountRichTextEditor(options);

  /** @type {RichTextEditorHandle | null} */
  let editor = null;
  let destroyed = false;
  let doc = options.initialDoc;
  let editable = options.editable;

  function start() {
    showChunkLoading(options.container, t('editor.loading'));
    loadEditorModule().then(
      (module) => {
        if (destroyed) return;
        editor = module.mountRichTextEditor({ ...options, initialDoc: doc });
        if (editable !== options.editable) editor.setEditable(editable);
      },
      () => {
        if (destroyed) return;
        showChunkError(
          options.container,
          { title: t('editor.loadFailed'), text: t('editor.loadFailedText') },
          start,
        );
      },
    );
  }
  start();

  return {
    getDoc: () => (editor ? editor.getDoc() : /** @type {RichTextDoc} */ (doc)),
    setDoc(next) {
      doc = next;
      editor?.setDoc(next);
    },
    setEditable(next) {
      editable = next;
      editor?.setEditable(next);
    },
    destroy() {
      destroyed = true;
      editor?.destroy();
      editor = null;
    },
  };
}
