// What the shared rich-text editor asks of the app: Covenant tooltips for its toolbar buttons,
// and the translated labels. The editor package has no catalog and no tooltip of its own.

import * as UI from './ui.js';

const { el, t } = UI;

/**
 * The texts of the editor, in the language of the page. Computed when an editor is mounted.
 * @returns {import('@simple-web-tools/rich-text/editor-lazy').RichTextLazyLabels}
 */
export function editorLabels() {
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
    taskList: t('editor.taskList'),
    link: t('editor.link'),
    insertImage: t('editor.insertImage'),
    linkLabel: t('editor.linkLabel'),
    linkPlaceholder: t('editor.linkPlaceholder'),
    apply: t('editor.apply'),
    cancel: t('common.cancel'),
    localImage: t('editor.localImage'),
    loading: t('editor.loading'),
    loadFailed: t('editor.loadFailed'),
    loadFailedText: t('editor.loadFailedText'),
    retry: t('editor.retry'),
  };
}

/**
 * The editor calls this on each toolbar button while it builds the toolbar, before the button
 * has a parent: the text is only noted, `initEditorTooltips` wraps the buttons afterwards.
 * @param {HTMLElement} trigger
 * @param {string} text
 */
export function setEditorTooltip(trigger, text) {
  trigger.dataset.tipText = text;
}

/**
 * Wraps each noted button in a Covenant tooltip (`cv-tooltip-wrap`), shown below it: the toolbar
 * is the first row of the editor, so a tooltip above would leave the pane.
 * @param {ParentNode} root the toolbar
 */
export function initEditorTooltips(root) {
  for (const button of root.querySelectorAll('button[data-tip-text]')) {
    const tip = el(
      'span',
      { class: 'cv-tooltip cv-tooltip--bottom', role: 'tooltip', hidden: true },
      /** @type {HTMLElement} */ (button).dataset.tipText,
    );
    const wrap = el('span', { class: 'cv-tooltip-wrap' });
    button.replaceWith(wrap);
    wrap.append(button, tip);
  }
  UI.initCovenant(root);
}
