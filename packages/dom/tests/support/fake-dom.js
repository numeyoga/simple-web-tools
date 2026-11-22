// A small stand-in for the DOM: the repository has no jsdom or happy-dom (and the real browser
// is covered by the apps' Playwright journeys). It implements what `el()` and the builders
// touch: elements with attributes, reflected properties, `style`, `dataset`, children, events
// and a `querySelector` that knows `.class`, `tag` and `[attr]`. Assigning `innerHTML` is not
// supported, so a builder that used it fails.

const BOOLEAN_PROPS = ['disabled', 'hidden', 'checked', 'selected', 'required', 'autofocus'];
const STRING_PROPS = ['id', 'type', 'name', 'placeholder', 'value', 'popover', 'rows'];

export class FakeNode {
  constructor() {
    /** @type {FakeParent | null} */
    this.parentNode = null;
  }

  get isConnected() {
    /** @type {FakeNode | null} */
    let node = this;
    while (node) {
      if (node === currentDocument?.documentElement) return true;
      node = node.parentNode;
    }
    return false;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }
}
FakeNode.TEXT_NODE = 3;

export class FakeText extends FakeNode {
  /** @param {string} data */
  constructor(data) {
    super();
    this.nodeType = 3;
    this.data = data;
  }

  get textContent() {
    return this.data;
  }

  cloneNode() {
    return new FakeText(this.data);
  }
}

/** Children shared by elements and fragments. */
class FakeParent extends FakeNode {
  constructor() {
    super();
    /** @type {(FakeElement | FakeText)[]} */
    this.childNodes = [];
  }

  /** @returns {FakeEl[]} */
  get children() {
    return /** @type {FakeEl[]} */ (this.childNodes.filter((node) => node instanceof FakeElement));
  }

  /** @param {...(FakeNode | string)} nodes */
  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeText(node) : node;
      if (child instanceof FakeFragment) {
        this.append(...child.childNodes.splice(0));
        continue;
      }
      child.remove();
      child.parentNode = this;
      this.childNodes.push(/** @type {FakeElement | FakeText} */ (child));
    }
  }

  /** @param {FakeNode} node */
  appendChild(node) {
    this.append(node);
    return node;
  }

  /** @param {FakeNode} node */
  removeChild(node) {
    this.childNodes = this.childNodes.filter((child) => child !== node);
    node.parentNode = null;
  }

  /** @param {...(FakeNode | string)} nodes */
  replaceChildren(...nodes) {
    for (const child of this.childNodes.splice(0)) child.parentNode = null;
    this.append(...nodes);
  }

  /** @returns {string} */
  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    this.replaceChildren(String(value));
  }

  /**
   * @param {string} selector
   * @returns {FakeEl | null}
   */
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  /**
   * @param {string} selector
   * @returns {FakeEl[]}
   */
  querySelectorAll(selector) {
    /** @type {FakeEl[]} */
    const found = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

/** @typedef {FakeElement & { id: string, hidden: boolean, type: string, checked: boolean, selected: boolean }} FakeEl */

/**
 * The fake element behind a built element, with the properties it reflects as attributes.
 * @param {unknown} node
 * @returns {FakeEl}
 */
export function fake(node) {
  return /** @type {FakeEl} */ (node);
}

export class FakeFragment extends FakeParent {
  constructor() {
    super();
    this.nodeType = 11;
  }
}

export class FakeElement extends FakeParent {
  /** @param {string} tagName */
  constructor(tagName) {
    super();
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    /** @type {Map<string, string>} */
    this.attributes = new Map();
    /** @type {Record<string, string>} */
    this.style = {};
    /** @type {Record<string, string>} */
    this.dataset = {};
    /** @type {Map<string, ((event: any) => void)[]>} */
    this.listeners = new Map();
  }

  /** @param {string} name */
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  /**
   * @param {string} name
   * @param {unknown} value
   */
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  /** @param {string} name */
  hasAttribute(name) {
    return this.attributes.has(name);
  }

  /** @param {string} name */
  removeAttribute(name) {
    this.attributes.delete(name);
  }

  get className() {
    return this.getAttribute('class') ?? '';
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  /** @param {string} selector */
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    const attr = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attr) {
      const [, name = '', value] = attr;
      return value === undefined ? this.hasAttribute(name) : this.getAttribute(name) === value;
    }
    return this.tagName === selector.toUpperCase();
  }

  /**
   * @param {string} type
   * @param {(event: any) => void} listener
   */
  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  /** @param {string} type */
  click(type = 'click') {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this });
  }

  /** @param {{ type: string }} event */
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener({ ...event, target: this });
    }
  }

  focus() {
    if (currentDocument) currentDocument.activeElement = this;
  }

  /** @param {boolean} [deep] */
  cloneNode(deep = false) {
    const copy = new FakeElement(this.tagName);
    for (const [name, value] of this.attributes) copy.attributes.set(name, value);
    if (deep) for (const child of this.childNodes) copy.append(child.cloneNode(true));
    return copy;
  }

  /** @param {string} _value */
  set innerHTML(_value) {
    throw new Error('innerHTML must not be used');
  }

  /** `<dialog>` stand-ins. */
  close() {
    this.dispatchEvent({ type: 'close' });
  }
}

for (const name of BOOLEAN_PROPS) {
  Object.defineProperty(FakeElement.prototype, name, {
    get() {
      return this.hasAttribute(name);
    },
    set(value) {
      if (value) this.setAttribute(name, '');
      else this.removeAttribute(name);
    },
  });
}
for (const name of STRING_PROPS) {
  Object.defineProperty(FakeElement.prototype, name, {
    get() {
      return this.getAttribute(name) ?? '';
    },
    set(value) {
      this.setAttribute(name, value);
    },
  });
}

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement('html');
    this.body = new FakeElement('body');
    this.documentElement.append(this.body);
    /** @type {FakeElement} */
    this.activeElement = this.body;
  }

  /** @param {string} tag */
  createElement(tag) {
    return new FakeElement(tag);
  }

  /** @param {string} data */
  createTextNode(data) {
    return new FakeText(data);
  }

  createDocumentFragment() {
    return new FakeFragment();
  }

  /** @param {string} selector */
  querySelector(selector) {
    return this.body.querySelector(selector);
  }
}

/** @type {FakeDocument | null} */
let currentDocument = null;

/**
 * Installs `document`, `window` and `Node` as globals and returns the document and a `Covenant`
 * spy. Call the returned `restore` after the test.
 * @param {Record<string, unknown>} [covenant] methods of `window.Covenant`
 */
export function installFakeDom(covenant = {}) {
  const doc = new FakeDocument();
  currentDocument = doc;
  const previous = {
    document: Reflect.get(globalThis, 'document'),
    window: Reflect.get(globalThis, 'window'),
    Node: Reflect.get(globalThis, 'Node'),
    HTMLElement: Reflect.get(globalThis, 'HTMLElement'),
    CSS: Reflect.get(globalThis, 'CSS'),
  };
  Object.assign(globalThis, {
    document: doc,
    window: { Covenant: covenant },
    Node: FakeNode,
    HTMLElement: FakeElement,
    CSS: { escape: (/** @type {string} */ value) => value },
  });
  return {
    document: doc,
    restore() {
      Object.assign(globalThis, previous);
      currentDocument = null;
    },
  };
}
