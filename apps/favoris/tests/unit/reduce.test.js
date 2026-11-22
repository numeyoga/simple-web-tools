// The state machine: groups and links, the moves, and the effects, which are the records that
// changed and nothing else.
import { describe, expect, test } from 'vitest';
import { isDataCommand } from '../../src/core/store.js';
import { groupIds, group, hydrated, link, linkIds, positionsAreNumbered } from './support/data.js';

/** A board with two groups and five links. */
function board() {
  return hydrated({
    groups: [group({ id: 'docs' }), group({ id: 'tools' })],
    links: [
      link({ id: 'a', groupId: 'docs' }),
      link({ id: 'b', groupId: 'docs' }),
      link({ id: 'c', groupId: 'tools' }),
      link({ id: 'd', groupId: 'docs' }),
      link({ id: 'e', groupId: null }),
    ],
  });
}

describe('hydrate and view commands', () => {
  test('hydrate cleans what storage returns, in the order of the positions', () => {
    const store = hydrated();
    store.dispatch({
      type: 'hydrate',
      payload: {
        groups: [group({ id: 'b', position: 1 }), group({ id: 'a', position: 0 })],
        links: [
          link({ id: 'x', url: 'javascript:alert(1)', position: 0 }),
          link({ id: 'y', groupId: 'gone', position: 1 }),
        ],
      },
    });
    const { groups, links } = store.getState();
    expect(groups.map((g) => g.id)).toEqual(['a', 'b']);
    expect(links.map((l) => [l.id, l.groupId])).toEqual([['y', null]]); // the unsafe one is dropped
  });

  test('search and edit mode are view state, allowed in a read-only tab, with no effect', () => {
    const store = hydrated({ readOnly: true });
    const a = store.dispatch({ type: 'set_search', query: 'doc' });
    const b = store.dispatch({ type: 'set_edit_mode', editMode: true });
    expect(a.effects).toEqual([]);
    expect(b.effects).toEqual([]);
    expect(store.getState()).toMatchObject({ search: 'doc', editMode: true });
    expect(isDataCommand('set_search')).toBe(false);
    expect(isDataCommand('create_link')).toBe(true);
  });

  test('a data command in a read-only tab changes nothing', () => {
    const store = hydrated({ readOnly: true });
    const before = store.getState();
    const { effects } = store.dispatch({ type: 'create_group', id: 'g', label: 'G', category: 3 });
    expect(effects).toEqual([]);
    expect(store.getState()).toBe(before);
  });
});

describe('groups', () => {
  test('create_group appends a numbered group and persists only it', () => {
    const store = board();
    const { effects } = store.dispatch({
      type: 'create_group',
      id: 'new',
      label: '  Reading  ',
      category: 14,
    });
    expect(store.getState().groups.at(-1)).toEqual({
      id: 'new',
      label: 'Reading',
      category: 14,
      featured: false,
      collapsed: false,
      position: 2,
    });
    expect(effects.map((e) => e.type)).toEqual(['persist_group']);
  });

  test('create_group refuses a blank label and a known id, and fixes a bad colour', () => {
    const store = board();
    const before = store.getState();
    store.dispatch({ type: 'create_group', id: 'x', label: '   ', category: 3 });
    store.dispatch({ type: 'create_group', id: 'docs', label: 'Again', category: 3 });
    expect(store.getState()).toBe(before);
    store.dispatch({ type: 'create_group', id: 'x', label: 'X', category: 99 });
    expect(store.getState().groups.at(-1)?.category).toBe(16);
  });

  test('update_group changes the label, the colour, the star and the fold; nothing changed is no effect', () => {
    const store = board();
    const { effects } = store.dispatch({
      type: 'update_group',
      id: 'docs',
      label: 'Documentation',
      category: 5,
      featured: true,
      collapsed: true,
    });
    expect(store.getState().groups[0]).toMatchObject({
      label: 'Documentation',
      category: 5,
      featured: true,
      collapsed: true,
    });
    expect(effects).toEqual([{ type: 'persist_group', group: store.getState().groups[0] }]);

    const before = store.getState();
    expect(
      store.dispatch({ type: 'update_group', id: 'docs', label: 'Documentation' }).effects,
    ).toEqual([]);
    store.dispatch({ type: 'update_group', id: 'docs', label: '  ' });
    store.dispatch({ type: 'update_group', id: 'nope', label: 'X' });
    expect(store.getState()).toBe(before);
  });

  test('delete_group keeps its links, with no group, and renumbers the groups', () => {
    const store = board();
    const { effects } = store.dispatch({ type: 'delete_group', id: 'docs' });
    const state = store.getState();
    expect(groupIds(state)).toEqual(['tools']);
    expect(state.groups[0]?.position).toBe(0);
    expect(linkIds(state, null).sort()).toEqual(['a', 'b', 'd', 'e']);
    expect(effects.filter((e) => e.type === 'remove_group')).toEqual([
      { type: 'remove_group', id: 'docs' },
    ]);
    // The three links of the group and the renumbered group are written; the others are not.
    expect(
      effects
        .filter((e) => e.type === 'persist_link')
        .map((e) => 'link' in e && e.link.id)
        .sort(),
    ).toEqual(['a', 'b', 'd']);
  });

  test('move_group puts a group next to another, as shown (featured first)', () => {
    const store = hydrated({
      groups: ['a', 'b', 'c', 'd'].map((id) => group({ id })),
    });
    store.dispatch({ type: 'move_group', id: 'a', targetId: 'c', place: 'after' });
    expect(groupIds(store.getState())).toEqual(['b', 'c', 'a', 'd']);
    expect(positionsAreNumbered(store.getState())).toBe(true);

    const { effects } = store.dispatch({
      type: 'move_group',
      id: 'd',
      targetId: 'b',
      place: 'before',
    });
    expect(groupIds(store.getState())).toEqual(['d', 'b', 'c', 'a']);
    expect(effects.every((e) => e.type === 'persist_group')).toBe(true);
    // Moving next to itself, or to where it already is, is nothing.
    const same = store.getState();
    store.dispatch({ type: 'move_group', id: 'd', targetId: 'd', place: 'after' });
    store.dispatch({ type: 'move_group', id: 'd', targetId: 'b', place: 'before' });
    expect(store.getState()).toBe(same);
  });

  test('shift_group moves one place, and never past a group of the other class', () => {
    const store = hydrated({
      groups: [group({ id: 'a', featured: true }), group({ id: 'b' }), group({ id: 'c' })],
    });
    store.dispatch({ type: 'shift_group', id: 'c', delta: -1 });
    expect(groupIds(store.getState())).toEqual(['a', 'c', 'b']);
    const before = store.getState();
    store.dispatch({ type: 'shift_group', id: 'c', delta: -1 }); // a is featured: c stays below it
    store.dispatch({ type: 'shift_group', id: 'a', delta: -1 }); // already first
    store.dispatch({ type: 'shift_group', id: 'b', delta: 1 }); // already last
    expect(store.getState()).toBe(before);
  });
});

describe('links', () => {
  test('create_link normalizes the address and joins the end of its group', () => {
    const store = board();
    const { effects } = store.dispatch({
      type: 'create_link',
      id: 'n',
      name: ' New ',
      url: 'example.org',
      groupId: 'docs',
    });
    expect(linkIds(store.getState(), 'docs')).toEqual(['a', 'b', 'd', 'n']);
    expect(store.getState().links.find((l) => l.id === 'n')).toMatchObject({
      name: 'New',
      url: 'https://example.org',
    });
    expect(positionsAreNumbered(store.getState())).toBe(true);
    // The link, and the links that came after it in the list: nothing else.
    expect(effects.every((e) => e.type === 'persist_link')).toBe(true);
  });

  test('create_link refuses an unsafe address, a known id and an unknown group', () => {
    const store = board();
    const before = store.getState();
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '']) {
      store.dispatch({ type: 'create_link', id: 'n', name: 'X', url, groupId: null });
    }
    store.dispatch({
      type: 'create_link',
      id: 'a',
      name: 'X',
      url: 'https://x.example',
      groupId: null,
    });
    store.dispatch({
      type: 'create_link',
      id: 'n',
      name: 'X',
      url: 'https://x.example',
      groupId: 'gone',
    });
    expect(store.getState()).toBe(before);
  });

  test('the name of a link falls back to its address', () => {
    const store = board();
    store.dispatch({
      type: 'create_link',
      id: 'n',
      name: '  ',
      url: 'https://x.example',
      groupId: null,
    });
    expect(store.getState().links.find((l) => l.id === 'n')?.name).toBe('https://x.example');
  });

  test('update_link changes name and address; an unsafe address is refused and nothing is written', () => {
    const store = board();
    const { effects } = store.dispatch({
      type: 'update_link',
      id: 'a',
      name: 'Alpha',
      url: 'alpha.example',
    });
    expect(store.getState().links[0]).toMatchObject({
      name: 'Alpha',
      url: 'https://alpha.example',
    });
    expect(effects).toHaveLength(1);

    const before = store.getState();
    const refused = store.dispatch({ type: 'update_link', id: 'a', url: 'javascript:alert(1)' });
    expect(refused.effects).toEqual([]);
    expect(store.getState()).toBe(before);
    store.dispatch({ type: 'update_link', id: 'a', name: 'Alpha' }); // nothing changed
    expect(store.getState()).toBe(before);
  });

  test('update_link to another group puts the link at the end of that group', () => {
    const store = board();
    store.dispatch({ type: 'update_link', id: 'a', groupId: 'tools', name: 'Moved' });
    expect(linkIds(store.getState(), 'tools')).toEqual(['c', 'a']);
    expect(linkIds(store.getState(), 'docs')).toEqual(['b', 'd']);
    expect(store.getState().links.find((l) => l.id === 'a')?.name).toBe('Moved');
    expect(positionsAreNumbered(store.getState())).toBe(true);
  });

  test('delete_link removes it and renumbers', () => {
    const store = board();
    const { effects } = store.dispatch({ type: 'delete_link', id: 'b' });
    expect(store.getState().links.map((l) => l.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(effects[0]).toEqual({ type: 'remove_link', id: 'b' });
    expect(positionsAreNumbered(store.getState())).toBe(true);
  });
});

describe('moving links', () => {
  test('next to another link, before or after, in the group of that link', () => {
    const store = board();
    store.dispatch({ type: 'move_link', id: 'c', groupId: null, targetId: 'b', place: 'before' });
    expect(linkIds(store.getState(), 'docs')).toEqual(['a', 'c', 'b', 'd']);
    expect(linkIds(store.getState(), 'tools')).toEqual([]);

    store.dispatch({ type: 'move_link', id: 'a', groupId: null, targetId: 'd', place: 'after' });
    expect(linkIds(store.getState(), 'docs')).toEqual(['c', 'b', 'd', 'a']);
    expect(positionsAreNumbered(store.getState())).toBe(true);
  });

  test('into a group, at its end; into no group; into a group that has no link yet', () => {
    const store = board();
    store.dispatch({ type: 'move_link', id: 'a', groupId: 'tools' });
    expect(linkIds(store.getState(), 'tools')).toEqual(['c', 'a']);
    store.dispatch({ type: 'move_link', id: 'c', groupId: null });
    expect(linkIds(store.getState(), null)).toEqual(['e', 'c']);

    const empty = hydrated({
      groups: [group({ id: 'g' })],
      links: [link({ id: 'x' })],
    });
    empty.dispatch({ type: 'move_link', id: 'x', groupId: 'g' });
    expect(linkIds(empty.getState(), 'g')).toEqual(['x']);
  });

  test('an unknown link, target or group changes nothing; so does a move to where it already is', () => {
    const store = board();
    const before = store.getState();
    store.dispatch({ type: 'move_link', id: 'zz', groupId: null });
    store.dispatch({ type: 'move_link', id: 'a', groupId: null, targetId: 'zz', place: 'after' });
    store.dispatch({ type: 'move_link', id: 'a', groupId: 'gone' });
    store.dispatch({ type: 'move_link', id: 'd', groupId: 'docs' }); // already last of its group
    expect(store.getState()).toBe(before);
  });

  test('only the links whose place or group changed are written', () => {
    const store = board();
    const { effects } = store.dispatch({
      type: 'move_link',
      id: 'b',
      groupId: 'docs',
      targetId: 'd',
      place: 'after',
    });
    expect(effects.map((e) => ('link' in e ? e.link.id : '')).sort()).toEqual(['b', 'c', 'd']);
  });

  test('shift_link moves one place inside the group, and stops at the ends', () => {
    const store = board();
    store.dispatch({ type: 'shift_link', id: 'd', delta: -1 });
    expect(linkIds(store.getState(), 'docs')).toEqual(['a', 'd', 'b']);
    store.dispatch({ type: 'shift_link', id: 'a', delta: 1 });
    expect(linkIds(store.getState(), 'docs')).toEqual(['d', 'a', 'b']);
    const before = store.getState();
    store.dispatch({ type: 'shift_link', id: 'd', delta: -1 });
    store.dispatch({ type: 'shift_link', id: 'b', delta: 1 });
    store.dispatch({ type: 'shift_link', id: 'e', delta: 1 });
    expect(store.getState()).toBe(before);
  });
});

describe('subscribers', () => {
  test('are told of a change, with the effects, and not of a command that changed nothing', () => {
    const store = board();
    /** @type {string[]} */
    const seen = [];
    store.subscribe(({ command, effects }) => seen.push(`${command.type}:${effects.length}`));
    store.dispatch({ type: 'delete_link', id: 'zz' });
    store.dispatch({ type: 'delete_link', id: 'e' });
    expect(seen).toEqual(['delete_link:1']);
  });
});
