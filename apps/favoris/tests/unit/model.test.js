import { describe, expect, test } from 'vitest';
import { group } from './support/data.js';
import {
  cleanData,
  endOfGroupIndex,
  moveItem,
  normalizeGroupLabel,
  orderedGroups,
  renumber,
  sanitizeGroup,
  sanitizeLink,
  sortByPosition,
} from '../../src/core/model.js';

/** @param {number} [start] */
const ids = (start = 0) => {
  let n = start;
  return () => `gen-${++n}`;
};

describe('texts', () => {
  test('a label is trimmed, collapsed and cut', () => {
    expect(normalizeGroupLabel('  Read   later \n')).toBe('Read later');
    expect(normalizeGroupLabel('x'.repeat(200))).toHaveLength(80);
    expect(normalizeGroupLabel(12)).toBe('');
  });
});

describe('order', () => {
  test('renumber keeps the objects that already have their number', () => {
    const a = { id: 'a', position: 0 };
    const b = { id: 'b', position: 5 };
    const out = renumber([a, b]);
    expect(out[0]).toBe(a);
    expect(out[1]).toEqual({ id: 'b', position: 1 });
  });

  test('sortByPosition sorts by the stored position, stable, the unnumbered last', () => {
    const items = [
      { id: 'c', position: 2 },
      { id: 'x' },
      { id: 'a', position: 0 },
      { id: 'b', position: 0 },
    ];
    expect(sortByPosition(items).map((i) => i.id)).toEqual(['a', 'b', 'c', 'x']);
  });

  test('orderedGroups puts the featured groups first, each class in its order', () => {
    const g = (/** @type {string} */ id, featured = false) => group({ id, featured });
    expect(orderedGroups([g('a'), g('b', true), g('c'), g('d', true)]).map((x) => x.id)).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
  });

  test('moveItem puts an item before or after another, and ignores unknown ids', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    const names = (/** @type {{ id: string }[]} */ list) => list.map((i) => i.id).join('');
    expect(names(moveItem(items, 'a', 'c', 'after'))).toBe('bcad');
    expect(names(moveItem(items, 'd', 'b', 'before'))).toBe('adbc');
    expect(names(moveItem(items, 'b', 'b', 'after'))).toBe('abcd');
    expect(names(moveItem(items, 'zz', 'b', 'after'))).toBe('abcd');
    expect(names(moveItem(items, 'a', 'zz', 'after'))).toBe('abcd');
  });

  test('endOfGroupIndex is just after the last link of the group, or the end', () => {
    const links = [
      { id: '1', groupId: 'g' },
      { id: '2', groupId: 'h' },
      { id: '3', groupId: 'g' },
      { id: '4', groupId: null },
    ];
    expect(endOfGroupIndex(/** @type {never} */ (links), 'g')).toBe(3);
    expect(endOfGroupIndex(/** @type {never} */ (links), 'new')).toBe(4);
  });
});

describe('sanitizeGroup', () => {
  test('keeps a valid group and reads its colour as a category', () => {
    expect(sanitizeGroup({ id: 'g', label: 'Docs', category: 9, featured: true })).toEqual({
      id: 'g',
      label: 'Docs',
      category: 9,
      featured: true,
      collapsed: false,
    });
  });

  test('turns the hex colour of the old app into a category, and slate when there is none', () => {
    expect(sanitizeGroup({ id: 'g', label: 'Docs', color: '#0d9488' })?.category).toBe(6);
    expect(sanitizeGroup({ id: 'g', label: 'Docs' })?.category).toBe(16);
    expect(sanitizeGroup({ id: 'g', label: 'Docs', category: 99 })?.category).toBe(16);
  });

  test('a blank label falls back to the id; no id and no maker, or no label at all, is refused', () => {
    expect(sanitizeGroup({ id: 'reading', label: '  ' })?.label).toBe('reading');
    expect(sanitizeGroup({ label: 'No id' })).toBeNull();
    expect(sanitizeGroup({ label: 'No id' }, ids())?.id).toBe('gen-1');
    for (const raw of [null, 'text', 4, []]) expect(sanitizeGroup(raw)).toBeNull();
  });

  test('"featured" and "collapsed" are true only for true', () => {
    const group = sanitizeGroup({ id: 'g', label: 'G', featured: 'yes', collapsed: 1 });
    expect(group).toMatchObject({ featured: false, collapsed: false });
  });
});

describe('sanitizeLink', () => {
  test('keeps a valid link and adds https:// to a bare host', () => {
    expect(sanitizeLink({ id: 'l', name: 'Site', url: 'example.org', groupId: 'g' })).toEqual({
      link: { id: 'l', name: 'Site', url: 'https://example.org', groupId: 'g' },
    });
  });

  test('the name falls back to the address', () => {
    expect(sanitizeLink({ id: 'l', url: 'https://example.org' })).toEqual({
      link: { id: 'l', name: 'https://example.org', url: 'https://example.org', groupId: null },
    });
  });

  test('refuses an unsafe address as "unsafe", the rest as "invalid"', () => {
    expect(sanitizeLink({ id: 'l', url: 'javascript:alert(1)' })).toEqual({ reason: 'unsafe' });
    expect(sanitizeLink({ id: 'l', url: 'data:text/html,x' })).toEqual({ reason: 'unsafe' });
    expect(sanitizeLink({ id: 'l', url: '' })).toEqual({ reason: 'invalid' });
    expect(sanitizeLink({ id: 'l' })).toEqual({ reason: 'invalid' });
    expect(sanitizeLink({ url: 'https://example.org' })).toEqual({ reason: 'invalid' });
    expect(sanitizeLink(null)).toEqual({ reason: 'invalid' });
  });
});

describe('cleanData validates record by record', () => {
  test('keeps the good records, numbers them, and counts what it skips', () => {
    const { data, skipped } = cleanData({
      groups: [
        { id: 'a', label: 'A', category: 9 },
        { id: 'a', label: 'Duplicate', category: 9 },
        42,
        { id: 'b', label: 'B', category: 4 },
      ],
      links: [
        { id: '1', name: 'One', url: 'https://one.example', groupId: 'a' },
        { id: '2', name: 'Evil', url: 'javascript:alert(1)', groupId: 'a' },
        { id: '3', name: 'Lost', url: 'https://lost.example', groupId: 'gone' },
        { id: '1', name: 'Same id', url: 'https://same.example', groupId: 'b' },
        { id: '5', name: 'Broken', url: 'http://', groupId: 'b' },
        'nope',
      ],
    });

    expect(data.groups.map((g) => [g.id, g.position])).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
    expect(data.links.map((l) => [l.id, l.groupId, l.position])).toEqual([
      ['1', 'a', 0],
      ['3', null, 1],
    ]);
    expect(skipped).toEqual({ groups: 2, links: 3, unsafeUrls: 1 });
  });

  test('lists that are not lists are empty', () => {
    const { data } = cleanData({ groups: 'no', links: null });
    expect(data).toEqual({ groups: [], links: [] });
  });

  test('records without an id get one from the maker', () => {
    const { data } = cleanData(
      { groups: [{ label: 'G' }], links: [{ url: 'https://example.org' }] },
      { makeId: ids() },
    );
    expect(data.groups[0]?.id).toBe('gen-1');
    expect(data.links[0]?.id).toBe('gen-2');
  });

  test('stored data (sorted) comes back in the order of its positions', () => {
    const { data } = cleanData(
      {
        groups: [
          { id: 'b', label: 'B', position: 1 },
          { id: 'a', label: 'A', position: 0 },
        ],
        links: [
          { id: '2', url: 'https://b.example', position: 1 },
          { id: '1', url: 'https://a.example', position: 0 },
        ],
      },
      { sorted: true },
    );
    expect(data.groups.map((g) => g.id)).toEqual(['a', 'b']);
    expect(data.links.map((l) => l.id)).toEqual(['1', '2']);
  });
});
