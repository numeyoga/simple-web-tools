import { describe, expect, test } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_ORDER,
  DEFAULT_CATEGORY,
  LEGACY_PALETTE,
  categoryFromHex,
  isCategory,
  nextCategory,
} from '../../src/core/colors.js';

describe('categories', () => {
  test('there are 16, numbered from 1, and the advised order is a permutation of them', () => {
    expect(CATEGORIES).toHaveLength(16);
    expect([...CATEGORY_ORDER].sort((a, b) => a - b)).toEqual([...CATEGORIES]);
  });

  test('isCategory accepts the integers 1 to 16 only', () => {
    expect([1, 9, 16].every(isCategory)).toBe(true);
    for (const value of [0, 17, 1.5, '9', null, undefined, NaN])
      expect(isCategory(value)).toBe(false);
  });
});

describe('the colours of the previous version', () => {
  test('each of its 12 colours maps to a category, all different', () => {
    expect(LEGACY_PALETTE).toHaveLength(12);
    expect(new Set(LEGACY_PALETTE.map(([, category]) => category)).size).toBe(12);
    for (const [hex, category] of LEGACY_PALETTE) expect(categoryFromHex(hex)).toBe(category);
  });

  test('the hues are kept: blue, teal, pink, slate', () => {
    expect(categoryFromHex('#2563eb')).toBe(9);
    expect(categoryFromHex('#0d9488')).toBe(6);
    expect(categoryFromHex('#db2777')).toBe(14);
    expect(categoryFromHex('#64748b')).toBe(16);
  });

  test('another valid colour goes to the nearest one, an invalid one to slate', () => {
    expect(categoryFromHex('#2564ec')).toBe(9);
    expect(categoryFromHex('#F00')).toBe(15);
    for (const value of ['red', '', null, undefined, 12, '#12345']) {
      expect(categoryFromHex(value)).toBe(DEFAULT_CATEGORY);
    }
  });
});

describe('nextCategory', () => {
  test('follows the advised order, skipping the colours in use', () => {
    expect(nextCategory([])).toBe(9);
    expect(nextCategory([{ category: 9 }])).toBe(4);
    expect(nextCategory([{ category: 4 }, { category: 9 }])).toBe(14);
  });

  test('starts the order again when the 16 colours are used', () => {
    const all = CATEGORIES.map((category) => ({ category }));
    expect(nextCategory(all)).toBe(9);
    expect(nextCategory([...all, { category: 9 }])).toBe(4);
  });
});
