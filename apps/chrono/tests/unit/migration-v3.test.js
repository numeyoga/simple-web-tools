// Schema version 3: a project colour is a category (1 to 16) or a free colour. `v2ToV3` of
// core/migrations.js, table-driven. The IndexedDB step and the export upgrade that call it are
// in idb-migration.test.js and backup.test.js.
import { describe, expect, test } from 'vitest';
import { V2_PALETTE, colorV2ToV3, v2ToV3 } from '../../src/core/migrations.js';

/** @param {unknown[]} projects @returns {any[]} */
const convert = (projects) => /** @type {any} */ (v2ToV3({ projects })).projects;
/** @param {Record<string, unknown>} extra */
const project = (extra) => ({ id: 'p', name: 'P', client: '', archived: false, ...extra });

describe('the 16 colours of the former palette', () => {
  const NAMES = [
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
    'slate',
  ];

  test('are 16 distinct colours', () => {
    expect(V2_PALETTE).toHaveLength(16);
    expect(new Set(V2_PALETTE).size).toBe(16);
  });

  test.each(NAMES.map((name, index) => [name, index + 1, V2_PALETTE[index]]))(
    '%s is category %i',
    (_name, category, hex) => {
      const [out] = convert([project({ color: hex })]);

      expect(out).toEqual(project({ category, customColor: null }));
      expect(out).not.toHaveProperty('color');
    },
  );

  test.each(NAMES.map((name, index) => [name, index + 1, V2_PALETTE[index]]))(
    '%s in capitals is category %i',
    (_name, category, hex) => {
      expect(convert([project({ color: String(hex).toUpperCase() })])[0]).toMatchObject({
        category,
        customColor: null,
      });
    },
  );

  test('the checked values of the Chrono drift table', () => {
    expect(colorV2ToV3('#ea580c')).toEqual({ category: 1, customColor: null }); // orange
    expect(colorV2ToV3('#d97706')).toEqual({ category: 2, customColor: null }); // amber
    expect(colorV2ToV3('#2563eb')).toEqual({ category: 9, customColor: null }); // blue
    expect(colorV2ToV3('#475569')).toEqual({ category: 16, customColor: null }); // slate
  });
});

/** @type {[string, Record<string, unknown>, Record<string, unknown>][]} */
const CASES = [
  [
    'a free colour is kept as it is',
    { color: '#ffff00' },
    { category: null, customColor: '#ffff00' },
  ],
  [
    'a free colour in capitals is written in lower case',
    { color: '#FFAA00' },
    { category: null, customColor: '#ffaa00' },
  ],
  ['`#rgb` is expanded', { color: '#f0a' }, { category: null, customColor: '#ff00aa' }],
  [
    '`#rgb` of a palette colour is not a palette colour',
    { color: '#d70' },
    { category: null, customColor: '#dd7700' },
  ],
  ['surrounding spaces are ignored', { color: ' #EA580C ' }, { category: 1, customColor: null }],
  [
    'a colour close to the palette is not moved onto it',
    { color: '#ea580d' },
    { category: null, customColor: '#ea580d' },
  ],
  [
    'black, the former `#000` of tests and imports',
    { color: '#000' },
    { category: null, customColor: '#000000' },
  ],
  ['a missing colour takes the next category', {}, { category: 9, customColor: null }],
  ['an empty colour takes the next category', { color: '' }, { category: 9, customColor: null }],
  ['a colour name is not a hex value', { color: 'red' }, { category: 9, customColor: null }],
  ['a hex value of the wrong length', { color: '#12345' }, { category: 9, customColor: null }],
  [
    'an eight-digit hex value is not accepted',
    { color: '#ea580cff' },
    { category: 9, customColor: null },
  ],
  ['a colour that is not text', { color: 5 }, { category: 9, customColor: null }],
  ['a colour that is null', { color: null }, { category: 9, customColor: null }],
];

describe('v2ToV3, one project', () => {
  test.each(CASES)('%s', (_label, input, expected) => {
    const [out] = convert([project(input)]);

    expect(out).toEqual(project(expected));
    expect(out).not.toHaveProperty('color');
  });

  test('keeps the other fields, and exactly one of category and customColor is set', () => {
    for (const [, input] of CASES) {
      const [out] = convert([project({ ...input, note: 'kept' })]);
      expect(out.note).toBe('kept');
      expect((out.category === null) !== (out.customColor === null)).toBe(true);
    }
  });
});

describe('v2ToV3, a list of projects', () => {
  test('a project without a usable colour takes the first free category of the default order', () => {
    const out = convert([
      project({ id: 'a', color: '#ea580c' }), // orange (1), kept
      project({ id: 'b' }),
      project({ id: 'c', color: 'nope' }),
      project({ id: 'd', color: '#9e6ef2' }), // free colour: uses no category
      project({ id: 'e' }),
    ]);

    expect(out.map((p) => [p.id, p.category, p.customColor])).toEqual([
      ['a', 1, null],
      ['b', 9, null], // blue
      ['c', 4, null], // lime
      ['d', null, '#9e6ef2'],
      ['e', 14, null], // pink
    ]);
  });

  test('does not repeat a category that a later project keeps', () => {
    const out = convert([project({ id: 'a' }), project({ id: 'b', color: '#2563eb' })]);

    expect(out.map((p) => p.category)).toEqual([4, 9]); // blue is taken by `b`: lime for `a`
  });

  test('an archived project does not use its category', () => {
    const out = convert([
      project({ id: 'a', color: '#2563eb', archived: true }),
      project({ id: 'b' }),
    ]);

    expect(out.map((p) => p.category)).toEqual([9, 9]);
  });

  test('after 16 projects the order starts again', () => {
    const projects = V2_PALETTE.map((color, index) => project({ id: `p${index}`, color }));

    const out = convert([...projects, project({ id: 'x' }), project({ id: 'y' })]);

    expect(out.slice(16).map((p) => p.category)).toEqual([9, 4]);
  });
});

describe('v2ToV3, what it leaves alone', () => {
  test('a project already in version 3 is unchanged, and the conversion can run twice', () => {
    const v3 = [
      project({ id: 'a', category: 3, customColor: null }),
      project({ id: 'b', category: null, customColor: '#123456' }),
    ];

    expect(convert(v3)).toEqual(v3);
    expect(convert(convert([project({ color: '#2563eb' })]))).toEqual(
      convert([project({ color: '#2563eb' })]),
    );
  });

  test('the other collections and keys are kept, and the input is not mutated', () => {
    const input = {
      projects: [project({ color: '#ea580c' })],
      todos: [{ id: 't', title: 'x' }],
      sessions: [],
      attendance: [],
      extra: 1,
    };
    const copy = structuredClone(input);

    const out = /** @type {any} */ (v2ToV3(input));

    expect(input).toEqual(copy);
    expect(out.todos).toBe(input.todos);
    expect(out.extra).toBe(1);
  });

  test('data without a list of projects, and records that are not objects, are returned as they are', () => {
    expect(v2ToV3(null)).toBeNull();
    expect(v2ToV3('x')).toBe('x');
    expect(v2ToV3({ todos: [] })).toEqual({ todos: [] });
    expect(convert([null, 'x', 3])).toEqual([null, 'x', 3]);
  });
});
