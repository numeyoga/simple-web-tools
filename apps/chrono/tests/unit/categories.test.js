// The categories of project colours (core/categories.js) and how projects take one
// (core/projects.js).
import { describe, expect, test } from 'vitest';
import {
  CATEGORY_COUNT,
  DEFAULT_CATEGORY_ORDER,
  isCategory,
  nextCategory,
  normalizeHex,
} from '../../src/core/categories.js';
import { addProject, updateProject } from '../../src/core/projects.js';
import { seed } from '../../src/core/seed.js';
import { emptyData } from './support/data.js';

/** @param {number | null} category @param {Partial<import('../../src/types.js').Project>} [extra] */
const project = (category, extra = {}) => ({
  id: `p${Math.random()}`,
  name: 'P',
  client: '',
  category,
  customColor: category === null ? '#123456' : null,
  archived: false,
  ...extra,
});

describe('the default order', () => {
  test('is the order of the skill: blue, lime, pink, indigo, cyan, teal, slate... orange last', () => {
    expect(DEFAULT_CATEGORY_ORDER).toEqual([9, 4, 14, 10, 7, 6, 16, 13, 8, 11, 12, 5, 3, 2, 15, 1]);
  });

  test('holds each of the 16 categories once', () => {
    expect([...DEFAULT_CATEGORY_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: CATEGORY_COUNT }, (_, i) => i + 1),
    );
  });
});

describe('nextCategory', () => {
  test('starts with blue', () => {
    expect(nextCategory([])).toBe(9);
  });

  test('walks the whole order, one project after the other', () => {
    /** @type {ReturnType<typeof project>[]} */
    const projects = [];
    const taken = [];
    for (let i = 0; i < 16; i += 1) {
      const next = nextCategory(projects);
      taken.push(next);
      projects.push(project(next));
    }

    expect(taken).toEqual([...DEFAULT_CATEGORY_ORDER]);
  });

  test('skips a category an active project uses, whatever its position', () => {
    expect(nextCategory([project(4), project(9)])).toBe(14);
    expect(nextCategory([project(14)])).toBe(9);
  });

  test('archived projects and free colours use no category', () => {
    expect(nextCategory([project(9, { archived: true }), project(null)])).toBe(9);
  });

  test('cycles after 16: the order starts again, then again', () => {
    const sixteen = DEFAULT_CATEGORY_ORDER.map((n) => project(n));

    expect(nextCategory(sixteen)).toBe(9);
    expect(nextCategory([...sixteen, project(9)])).toBe(4);
    expect(nextCategory([...sixteen, project(9), project(4)])).toBe(14);
    expect(nextCategory([...sixteen, ...sixteen])).toBe(9);
  });

  test('a freed category is reused first', () => {
    const projects = DEFAULT_CATEGORY_ORDER.map((n) => project(n));
    projects[2] = project(14, { archived: true });

    expect(nextCategory(projects)).toBe(14);
  });
});

describe('isCategory and normalizeHex', () => {
  test.each([
    [1, true],
    [16, true],
    [0, false],
    [17, false],
    [2.5, false],
    ['3', false],
    [null, false],
  ])('isCategory(%j) is %s', (value, expected) => {
    expect(isCategory(value)).toBe(expected);
  });

  test.each([
    ['#ABCDEF', '#abcdef'],
    ['#abc', '#aabbcc'],
    [' #A0f ', '#aa00ff'],
    ['abcdef', null],
    ['#abcd', null],
    ['#ggg', null],
    [3, null],
  ])('normalizeHex(%j) is %j', (value, expected) => {
    expect(normalizeHex(value)).toBe(expected);
  });
});

describe('addProject and updateProject', () => {
  test('a new project without a colour takes the next category', () => {
    let data = emptyData();
    for (let i = 0; i < 3; i += 1) data = addProject(data, { name: `P${i}` }, `id${i}`);

    expect(data.projects.map((p) => [p.category, p.customColor])).toEqual([
      [9, null],
      [4, null],
      [14, null],
    ]);
  });

  test('a chosen category, or a free colour, is kept: exactly one of them is set', () => {
    let data = addProject(emptyData(), { name: 'A', category: 3 }, 'a');
    data = addProject(data, { name: 'B', customColor: '#FFFF00' }, 'b');
    // The category wins when both are given; an invalid choice falls back to the default.
    data = addProject(data, { name: 'C', category: 5, customColor: '#123456' }, 'c');
    data = addProject(data, { name: 'D', category: 99, customColor: 'red' }, 'd');

    expect(data.projects.map((p) => [p.category, p.customColor])).toEqual([
      [3, null],
      [null, '#ffff00'],
      [5, null],
      [9, null],
    ]);
  });

  test('a patch with a colour replaces the other kind', () => {
    const data = addProject(emptyData(), { name: 'A', category: 3 }, 'a');

    const free = updateProject(data, { id: 'a', patch: { category: null, customColor: '#abc' } });
    const back = updateProject(free, { id: 'a', patch: { category: 7, customColor: null } });
    const renamed = updateProject(back, { id: 'a', patch: { name: 'B' } });

    expect(free.projects[0]).toMatchObject({ category: null, customColor: '#aabbcc' });
    expect(back.projects[0]).toMatchObject({ category: 7, customColor: null });
    expect(renamed.projects[0]).toMatchObject({ name: 'B', category: 7, customColor: null });
  });
});

describe('the demo data', () => {
  test('every project has a category and no hex colour', () => {
    const { projects } = seed(Date.UTC(2026, 10, 18));

    expect(projects).toHaveLength(6);
    for (const p of projects) {
      expect(isCategory(p.category)).toBe(true);
      expect(p.customColor).toBeNull();
      expect(p).not.toHaveProperty('color');
    }
  });
});
