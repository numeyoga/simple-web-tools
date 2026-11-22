// Mermaid, loaded on demand. The library is large (about 2 MB of script once split into chunks), so
// it is loaded by a dynamic `import()` the first time a slide on screen holds a diagram, and never
// otherwise; the build precaches its chunks for offline use. The code of the diagram is read from
// the page as text and drawn with `securityLevel: 'strict'`, which keeps HTML and click handlers out
// of labels. Mermaid's SVG carries inline styles, which is why this app's CSP allows
// `style-src 'unsafe-inline'` (see vite.config.js).

/** @typedef {typeof import('mermaid').default} Mermaid */

/** @type {Promise<Mermaid> | null} */
let loading = null;
/** @type {'light' | 'dark' | null} */
let configuredTheme = null;

/** @returns {Promise<Mermaid>} */
function loadMermaid() {
  loading ??= import('mermaid').then((module) => module.default);
  // A failed load (offline with no cache) is tried again the next time.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * Draws one diagram in place: its `<pre class="mermaid">` becomes an SVG.
 * @param {HTMLElement} node
 * @param {'light' | 'dark'} theme the theme of the slide it is on
 * @returns {Promise<void>} rejects when the library cannot be loaded or the code is not a diagram
 */
export async function drawDiagram(node, theme) {
  const mermaid = await loadMermaid();
  if (configuredTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'light' ? 'default' : 'dark',
    });
    configuredTheme = theme;
  }
  await mermaid.run({ nodes: [node] });
  // Mermaid marks the element when it starts; this says the SVG is in place.
  node.setAttribute('data-drawn', '');
}
