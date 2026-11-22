import { mountRichTextEditor as mountSharedEditor } from '@simple-web-tools/rich-text/editor-lazy';
import { showChunkError, showChunkLoading } from './dom/lazy-chunk-state.js';
import { t } from './i18n.js';

/**
 * Locavern's front door of the rich-text editor, which lives in `@simple-web-tools/rich-text`:
 * the package takes its texts and its tooltip from the app, this module gives it Locavern's
 * catalog, tooltip and loading states. Tiptap stays in its own lazy chunk (the package loads it
 * with a dynamic `import()`); the chunk is in the service worker's precache.
 *
 * @typedef {Omit<
 *   Parameters<typeof mountSharedEditor>[0],
 *   'labels' | 'setTooltip' | 'initTooltips' | 'showLoading' | 'showError'
 * >} RichTextEditorOptions
 * @typedef {ReturnType<typeof mountSharedEditor>} RichTextEditorHandle
 */

/** The editor's texts, in the language of the interface when the editor is mounted. */
function editorLabels() {
  return {
    toolbar: t('editor.toolbar'),
    bold: t('editor.bold'),
    italic: t('editor.italic'),
    strike: t('editor.strike'),
    code: t('editor.code'),
    heading1: t('editor.heading1'),
    heading2: t('editor.heading2'),
    heading3: t('editor.heading3'),
    bulletList: t('editor.bulletList'),
    orderedList: t('editor.orderedList'),
    taskList: t('tasks.checklist'),
    link: t('editor.link'),
    insertImage: t('editor.insertImage'),
    linkLabel: t('editor.linkLabel'),
    linkPlaceholder: t('editor.linkPlaceholder'),
    apply: t('common.apply'),
    cancel: t('common.cancel'),
    localImage: t('common.localImage'),
    loading: t('editor.loading'),
    loadFailed: t('editor.loadFailed'),
    loadFailedText: t('editor.loadFailedText'),
    retry: t('common.retry'),
  };
}

/**
 * Same contract as the package's `mountRichTextEditor`, without the labels and hooks.
 * @param {RichTextEditorOptions} options
 * @returns {RichTextEditorHandle}
 */
export function mountRichTextEditor(options) {
  return mountSharedEditor({
    ...options,
    labels: editorLabels(),
    // Covenant's tooltips (attribute form): the editor notes a text per button, then wires the toolbar.
    setTooltip: (trigger, text) => window.Covenant?.setTooltip?.(trigger, text),
    initTooltips: (root) => window.Covenant?.init?.(root),
    showLoading: showChunkLoading,
    showError: showChunkError,
  });
}
