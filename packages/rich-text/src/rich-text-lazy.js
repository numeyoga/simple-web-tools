/** @import { RichTextDoc } from './types.d.ts' */

/**
 * Lazy front door of the rich-text editor. Tiptap and its extensions are most of an app's
 * third-party code: they live in their own chunk, fetched by a dynamic `import()` the first
 * time an editor is shown. An app that precaches its chunks (a service worker) also opens the
 * editor offline after a first visit. CSP `script-src 'self'` covers the chunk: same origin.
 *
 * Once the chunk is in, `mountRichTextEditor` mounts at once and returns the real editor's
 * handle. Until then it returns a stand-in with the same shape: `getDoc()` gives the document
 * the editor was given or last `setDoc()` with (nothing can have been typed yet), and
 * `destroy()` cancels the pending mount.
 *
 * @typedef {typeof import('./rich-text-tiptap.js')} EditorModule
 * @typedef {import('./rich-text-tiptap.js').RichTextEditorLabels} RichTextEditorLabels
 * @typedef {RichTextEditorLabels & {
 *   loading: string;
 *   loadFailed: string;
 *   loadFailedText: string;
 *   retry: string;
 * }} RichTextLazyLabels the editor labels plus the texts of the loading and error states
 * @typedef {{
 *   showLoading?: (container: HTMLElement, label: string) => void;
 *   showError?: (
 *     container: HTMLElement,
 *     message: { title: string; text: string },
 *     onRetry: () => void,
 *   ) => void;
 * }} RichTextLoadStateHooks replace the default loading placeholder and error alert
 * @typedef {Omit<import('./rich-text-tiptap.js').RichTextEditorOptions, 'labels'> & {
 *   labels: RichTextLazyLabels;
 * } & RichTextLoadStateHooks} RichTextEditorOptions
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
 * Default placeholder while the chunk loads: a busy region announcing the label.
 * @param {HTMLElement} container replaced by the placeholder
 * @param {string} label
 */
function defaultShowLoading(container, label) {
  const box = document.createElement('div');
  box.setAttribute('aria-busy', 'true');
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.textContent = label;
  box.append(status);
  container.replaceChildren(box);
}

/**
 * Default inline error when the chunk cannot be fetched, with a retry button.
 * @param {string} retryLabel
 * @returns {NonNullable<RichTextLoadStateHooks['showError']>}
 */
function createDefaultShowError(retryLabel) {
  return (container, { title, text }, onRetry) => {
    const alert = document.createElement('div');
    alert.className = 'cv-alert cv-alert--danger';
    alert.setAttribute('role', 'alert');
    const body = document.createElement('div');
    body.className = 'cv-alert__body';
    const lead = document.createElement('span');
    lead.className = 'cv-alert__title';
    lead.textContent = title;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'cv-btn cv-btn--sm';
    retry.textContent = retryLabel;
    retry.addEventListener('click', onRetry);
    body.append(lead, ` ${text} `, retry);
    alert.append(body);
    container.replaceChildren(alert);
  };
}

/**
 * Same contract as `mountRichTextEditor` of `rich-text-tiptap.js`, plus the loading and error
 * texts in `labels` and the optional `showLoading` / `showError` hooks.
 * @param {RichTextEditorOptions} options
 * @returns {RichTextEditorHandle}
 */
export function mountRichTextEditor(options) {
  if (loaded) return loaded.mountRichTextEditor(options);

  const {
    showLoading = defaultShowLoading,
    showError = createDefaultShowError(options.labels.retry),
  } = options;
  /** @type {RichTextEditorHandle | null} */
  let editor = null;
  let destroyed = false;
  let doc = options.initialDoc;
  let editable = options.editable;

  function start() {
    showLoading(options.container, options.labels.loading);
    loadEditorModule().then(
      (module) => {
        if (destroyed) return;
        editor = module.mountRichTextEditor({ ...options, initialDoc: doc });
        if (editable !== options.editable) editor.setEditable(editable);
      },
      () => {
        if (destroyed) return;
        showError(
          options.container,
          { title: options.labels.loadFailed, text: options.labels.loadFailedText },
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
