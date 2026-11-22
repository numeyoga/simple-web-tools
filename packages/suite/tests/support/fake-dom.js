// A tiny stand-in for `Document`: the repository has no jsdom or happy-dom, and the builders
// only need createElement, setAttribute, append and textContent. Assigning `innerHTML` throws,
// so a builder that used it would fail its tests.

export class FakeElement {
  /** @param {string} tagName */
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    /** @type {Map<string, string>} */
    this.attributes = new Map();
    /** @type {FakeElement[]} */
    this.children = [];
    this.text = '';
  }

  /**
   * @param {string} name
   * @param {string} value
   */
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  /** @param {string} name */
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  /** @param {...FakeElement} nodes */
  append(...nodes) {
    this.children.push(...nodes);
  }

  /** @param {string} value */
  set textContent(value) {
    this.text = value;
  }

  get textContent() {
    return this.text + this.children.map((child) => child.textContent).join('');
  }

  get classes() {
    return (this.getAttribute('class') ?? '').split(' ').filter(Boolean);
  }

  /** @param {string} _value */
  set innerHTML(_value) {
    throw new Error('innerHTML must not be used');
  }

  /**
   * @param {(el: FakeElement) => boolean} predicate
   * @returns {FakeElement[]}
   */
  findAll(predicate) {
    return [
      ...(predicate(this) ? [this] : []),
      ...this.children.flatMap((child) => child.findAll(predicate)),
    ];
  }
}

/** @returns {Document} */
export function createFakeDocument() {
  const doc = { createElement: (/** @type {string} */ tag) => new FakeElement(tag) };
  return /** @type {Document} */ (/** @type {unknown} */ (doc));
}

/**
 * The fake element behind a node built with {@link createFakeDocument}.
 * @param {unknown} node
 * @returns {FakeElement}
 */
export function asFake(node) {
  return /** @type {FakeElement} */ (node);
}
