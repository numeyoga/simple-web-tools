// The element builder and the small helpers around it. No framework, no dependency. Markup is
// built with `el()` and `append`, never with `innerHTML`: a user's text (a note title, a folder
// name, a bookmark) is only ever a text node. Nothing here knows an app, a language or a class
// prefix.

/** @typedef {import('./types.js').Child} Child */
/** @typedef {import('./types.js').Props} Props */

// Properties that would parse a string as HTML: el() refuses them.
const HTML_PROPS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

/* ------------------------------------------------------------------ */
/* Ergonomic DOM element builder. Usage:
     el('div', { class: 'card', style: { width: 120 }, onclick: fn },
        el('h2', null, 'Title'),
        'plain text',
        items.map(i => el('li', null, i.label))
     )
   A number in `style` is a length in px at the standard text scale and is written in rem
   (`width: 120` gives `7.5rem`), so every size follows the text size of the user. Style goes
   through the CSSOM (`node.style.width = ...`), which a strict CSP allows; there is no
   `style="..."` attribute. */
/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Props} [props] attributes, properties, `style`, `dataset` and `on...` handlers
 * @param {...Child} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (HTML_PROPS.has(k)) {
        throw new Error(`el(): '${k}' would parse HTML; build children instead`);
      }
      if (k === 'style' && typeof v === 'object') {
        const style = /** @type {Record<string, unknown>} */ (v);
        for (const sk in style) {
          const sv = style[sk];
          if (sv == null || sv === false) continue;
          // A CSS property assigned by name: the style object has no index signature.
          /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (node.style))[sk] =
            typeof sv === 'number' && !UNITLESS.has(sk) ? `${sv / 16}rem` : sv;
        }
      } else if (k === 'class' || k === 'className') {
        node.className = String(v);
      } else if (k === 'dataset') {
        Object.assign(node.dataset, v);
      } else if (k === 'ref' && typeof v === 'function') {
        v(node);
      } else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), /** @type {EventListener} */ (v));
      } else if (
        k in node &&
        typeof (/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (node))[k]) !==
          'object' &&
        k !== 'list'
      ) {
        try {
          /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (node))[k] = v;
        } catch {
          node.setAttribute(k, String(v));
        }
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  appendChildren(node, children);
  return node;
}

const UNITLESS = new Set([
  'opacity',
  'zIndex',
  'fontWeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'lineHeight',
  'order',
  'zoom',
]);

/**
 * Appends children: strings and numbers become text nodes, nodes are moved in, arrays are
 * flattened, and `null`, `undefined`, `true` and `false` are skipped.
 * @param {Element | DocumentFragment} node
 * @param {Child[]} children
 */
export function appendChildren(node, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) {
      appendChildren(node, c);
      continue;
    }
    // append() inserts a string as a Text node, never as HTML. CodeQL does not see the
    // instanceof guard of the previous form and reported js/xss-through-dom here.
    node.append(c instanceof Node ? c : String(c));
  }
}

/* Replaces the content of a node with a new node (used by the views). */
/**
 * @param {Element} host
 * @param {Node} node
 */
export function mount(host, node) {
  host.replaceChildren(node);
}

/* Phosphor icon, as in the Icons page of the skill: regular, or bold for one level of emphasis
   (the package ships no other weight). `className` adds app classes (a colour role, a size). */
/**
 * @param {string} name
 * @param {{ weight?: 'regular' | 'bold', className?: string }} [opts]
 */
export function icon(name, opts = {}) {
  const base = opts.weight === 'bold' ? 'ph-bold' : 'ph';
  return el('i', {
    class: `${base} ph-${name} cv-icon${opts.className ? ' ' + opts.className : ''}`,
    'aria-hidden': 'true',
  });
}

let fieldCounter = 0;
/**
 * A unique id for a label, a hint or an error, so that `for`, `aria-describedby` and
 * `aria-labelledby` can point at it. The counter is shared by everything built with this module.
 * @param {string} [prefix]
 */
export function fieldId(prefix = 'cv-field') {
  fieldCounter += 1;
  return `${prefix}-${fieldCounter}`;
}

/**
 * Wires the Covenant behaviours (tooltips, dialogs, comboboxes, menus) of markup built here.
 * Covenant wires the components below the node it is given, never the node itself.
 * @param {ParentNode} root
 */
export function initCovenant(root) {
  window.Covenant?.init?.(root);
}

/**
 * Makes the translator of an app able to put DOM nodes in place of some placeholders (`{key}`
 * holds a `<kbd>`, a styled figure...). The translator writes the sentence, so a language can
 * move the node. `t` is the `t` of `@simple-web-tools/i18n`.
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 */
export function createTNodes(t) {
  /**
   * @param {string} key
   * @param {Record<string, Node>} nodes the node of each placeholder
   * @param {Record<string, unknown>} [params] the other placeholders
   * @returns {Node[]}
   */
  return function tNodes(key, nodes, params = {}) {
    const MARK = '\u0001';
    const marks = Object.fromEntries(
      Object.keys(nodes).map((name) => [name, `${MARK}${name}${MARK}`]),
    );
    return t(key, { ...params, ...marks })
      .split(MARK)
      .map((part, index) => {
        if (index % 2 === 0) return document.createTextNode(part);
        return /** @type {Node} */ (nodes[part]).cloneNode(true);
      })
      .filter((node) => node.nodeType !== Node.TEXT_NODE || node.textContent);
  };
}
