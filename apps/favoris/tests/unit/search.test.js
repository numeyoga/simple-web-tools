import { describe, expect, test } from 'vitest';
import { filterLinks, normalizeSearchText, tokenizeSearchQuery } from '../../src/core/search.js';
import {
  selectBoard,
  canShiftGroup,
  canShiftLink,
  countByGroup,
} from '../../src/core/selectors.js';
import { group, hydrated, link } from './support/data.js';

const groups = [
  group({ id: 'docs', label: 'Documentation' }),
  group({ id: 'read', label: 'Lectures' }),
];
const links = [
  link({ id: 'mdn', name: 'MDN Web Docs', url: 'https://developer.mozilla.org', groupId: 'docs' }),
  link({ id: 'hn', name: 'Hacker News', url: 'https://news.ycombinator.com', groupId: 'read' }),
  link({ id: 'caf', name: 'Café du coin', url: 'https://cafe.example', groupId: null }),
];

describe('search', () => {
  test('normalizes case, accents and spaces', () => {
    expect(normalizeSearchText('  Été  CAFÉ ')).toBe('ete cafe');
    expect(tokenizeSearchQuery('  Hacker   NEWS ')).toEqual(['hacker', 'news']);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });

  test('a blank query keeps every link (the same array)', () => {
    expect(filterLinks(links, groups, '')).toBe(links);
    expect(filterLinks(links, groups, '  ')).toBe(links);
  });

  test('matches the name, the address and the label of the group', () => {
    const ids = (/** @type {string} */ q) => filterLinks(links, groups, q).map((l) => l.id);
    expect(ids('hacker')).toEqual(['hn']);
    expect(ids('mozilla')).toEqual(['mdn']);
    expect(ids('lectures')).toEqual(['hn']);
    expect(ids('cafe')).toEqual(['caf']); // without the accent
    expect(ids('news hacker')).toEqual(['hn']); // every word, any order
    expect(ids('zzz')).toEqual([]);
  });
});

describe('selectBoard', () => {
  test('without a search: every group (empty ones too) in the shown order, then the links with no group', () => {
    const store = hydrated({
      groups: [group({ id: 'a' }), group({ id: 'b', featured: true }), group({ id: 'c' })],
      links: [link({ id: '1', groupId: 'a' }), link({ id: '2' })],
    });
    const { sections, searching } = selectBoard(store.getState());
    expect(searching).toBe(false);
    expect(sections.map((s) => s.group?.id ?? null)).toEqual(['b', 'a', 'c', null]);
    expect(sections.map((s) => s.links.length)).toEqual([0, 1, 0, 1]);
  });

  test('with a search: only the cards that hold a match', () => {
    const store = hydrated({ groups, links });
    store.dispatch({ type: 'set_search', query: 'cafe' });
    const { sections, matching, searching } = selectBoard(store.getState());
    expect(searching).toBe(true);
    expect(matching).toBe(1);
    expect(sections.map((s) => s.group?.id ?? null)).toEqual([null]);
  });

  test('canShift tells whether a move is possible', () => {
    const store = hydrated({
      groups: [group({ id: 'a', featured: true }), group({ id: 'b' }), group({ id: 'c' })],
      links: [link({ id: '1', groupId: 'b' }), link({ id: '2', groupId: 'b' })],
    });
    const state = store.getState();
    expect(canShiftGroup(state, 'a', -1)).toBe(false);
    expect(canShiftGroup(state, 'b', -1)).toBe(false); // a is featured
    expect(canShiftGroup(state, 'b', 1)).toBe(true);
    expect(canShiftGroup(state, 'zz', 1)).toBe(false);
    expect(canShiftLink(state, '1', -1)).toBe(false);
    expect(canShiftLink(state, '1', 1)).toBe(true);
    expect(canShiftLink(state, '2', 1)).toBe(false);
  });

  test('countByGroup counts the links of each group, null for none', () => {
    const state = hydrated({ groups, links }).getState();
    expect([...countByGroup(state)]).toEqual([
      ['docs', 1],
      ['read', 1],
      [null, 1],
    ]);
  });
});
