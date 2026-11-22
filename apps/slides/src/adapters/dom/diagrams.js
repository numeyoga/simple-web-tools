// Mermaid diagrams on a slide. The library itself is in adapters/mermaid.js (a lazy chunk, loaded
// only when a slide holds a diagram).
import { drawDiagram } from '../mermaid.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/**
 * Draws the diagrams of an element that are not drawn yet. A diagram that cannot be drawn (a
 * syntax error, the library missing) keeps its code on screen, with a message above it.
 * @param {Element} root
 * @param {'light' | 'dark'} theme the theme of the slides it holds
 * @returns {Promise<void>}
 */
export async function renderDiagrams(root, theme) {
  const nodes = [...root.querySelectorAll('pre.mermaid:not([data-processed]):not([data-failed])')];
  // One at a time: a broken diagram does not stop the next one, and each is drawn while it is
  // still in the page (the slide may have changed since the call).
  for (const node of nodes) {
    if (!node.isConnected) continue;
    const source = node.textContent ?? '';
    try {
      await drawDiagram(/** @type {HTMLElement} */ (node), theme);
    } catch {
      // Mermaid draws its own error picture in the element: put the code back.
      node.textContent = source;
      markFailed(node);
    }
  }
}

/** @param {Element} node */
function markFailed(node) {
  if (!node.isConnected || node.hasAttribute('data-failed')) return;
  node.setAttribute('data-failed', '');
  node.removeAttribute('data-processed');
  node.before(
    el(
      'p',
      { class: 'sl-diagram-error', role: 'alert' },
      icon('warning'),
      el('span', null, t('slide.diagram.failed')),
    ),
  );
}
