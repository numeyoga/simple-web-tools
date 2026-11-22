import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  appendChildren,
  createTNodes,
  el,
  fieldId,
  icon,
  initCovenant,
  mount,
} from '../src/index.js';
import { FakeText, fake, installFakeDom } from './support/fake-dom.js';

/** @type {ReturnType<typeof installFakeDom>} */
let dom;
beforeEach(() => {
  dom = installFakeDom();
});
afterEach(() => dom.restore());

describe('el', () => {
  test('refuses the properties that parse HTML', () => {
    for (const name of ['innerHTML', 'outerHTML', 'srcdoc']) {
      expect(() => el('div', { [name]: '<img src=x onerror=alert(1)>' })).toThrow(
        /would parse HTML/,
      );
    }
  });

  test('puts a string child in a text node, whatever it looks like', () => {
    const node = fake(el('p', null, '<b>bold</b>'));
    expect(node.childNodes).toHaveLength(1);
    expect(node.childNodes[0]).toBeInstanceOf(FakeText);
    expect(node.textContent).toBe('<b>bold</b>');
  });

  test('flattens arrays and skips null, undefined, booleans', () => {
    const node = fake(
      el('ul', null, [el('li', null, 'a'), [el('li', null, 'b')]], null, false, true, 3),
    );
    expect(node.children).toHaveLength(2);
    expect(node.textContent).toBe('ab3');
  });

  test('writes style through the CSSOM, in rem, and leaves unitless properties alone', () => {
    const node = fake(el('div', { style: { width: 120, opacity: 0.5, color: 'red', gap: null } }));
    expect(node.style).toEqual({ width: '7.5rem', opacity: 0.5, color: 'red' });
    expect(node.hasAttribute('style')).toBe(false);
  });

  test('sets class, dataset, handlers, refs and attributes', () => {
    const onclick = vi.fn();
    /** @type {unknown} */
    let seen = null;
    const node = fake(
      el('button', {
        class: 'cv-btn',
        dataset: { focusKey: 'x' },
        onclick,
        ref: (/** @type {unknown} */ n) => (seen = n),
        'aria-label': 'Name',
        disabled: false,
        hidden: true,
        type: 'button',
      }),
    );
    expect(node.className).toBe('cv-btn');
    expect(node.dataset).toEqual({ focusKey: 'x' });
    expect(node.getAttribute('aria-label')).toBe('Name');
    expect(node.hasAttribute('disabled')).toBe(false);
    expect(node.hidden).toBe(true);
    expect(node.type).toBe('button');
    expect(seen).toBe(node);
    node.click();
    expect(onclick).toHaveBeenCalledOnce();
  });
});

describe('appendChildren', () => {
  test('appends into a fragment too', () => {
    const fragment = document.createDocumentFragment();
    appendChildren(fragment, ['a', el('i')]);
    expect(fake(fragment).childNodes).toHaveLength(2);
  });
});

describe('mount', () => {
  test('replaces the content of the host', () => {
    const host = el('main', null, el('p', null, 'old'));
    const view = el('section');
    mount(host, view);
    expect(fake(host).children).toEqual([view]);
  });
});

describe('icon', () => {
  test('is a decorative Phosphor icon, regular or bold', () => {
    expect(fake(icon('gear')).className).toBe('ph ph-gear cv-icon');
    expect(fake(icon('gear', { weight: 'bold', className: 'x' })).className).toBe(
      'ph-bold ph-gear cv-icon x',
    );
    expect(fake(icon('gear')).getAttribute('aria-hidden')).toBe('true');
  });
});

describe('fieldId', () => {
  test('counts up, with the prefix given', () => {
    const first = fieldId('app-hint');
    const second = fieldId('app-hint');
    expect(first).toMatch(/^app-hint-\d+$/);
    expect(second).not.toBe(first);
    expect(fieldId()).toMatch(/^cv-field-\d+$/);
  });
});

describe('initCovenant', () => {
  test('hands the root to Covenant, and does nothing without it', () => {
    const init = vi.fn();
    dom.restore();
    dom = installFakeDom({ init });
    const root = document.createDocumentFragment();
    initCovenant(root);
    expect(init).toHaveBeenCalledWith(root);
    dom.restore();
    dom = installFakeDom({});
    expect(() => initCovenant(root)).not.toThrow();
  });
});

describe('createTNodes', () => {
  const t = (/** @type {string} */ _key, /** @type {Record<string, unknown>} */ params = {}) =>
    `Press ${params.key} to save ${params.count} notes`;
  const tNodes = createTNodes(t);

  test('puts a node where the placeholder is, and keeps the text around it', () => {
    const kbd = el('kbd', null, 'Ctrl');
    const parts = tNodes('hint', { key: kbd }, { count: 3 });
    expect(parts.map((node) => node.textContent)).toEqual(['Press ', 'Ctrl', ' to save 3 notes']);
    expect(parts[1]).not.toBe(kbd);
  });

  test('drops the empty text around a placeholder at the edges', () => {
    const edge = createTNodes(() => '\u0001key\u0001');
    // The translator gets the marks, not the sentence: here it returns them as they are.
    expect(edge('x', { key: el('b', null, 'k') })).toHaveLength(1);
  });
});
