// The data of the previous version, turned into workspaces: both of its formats, and what an old
// export file holds. Pure functions: the storage is passed in as strings.
import { describe, expect, test } from 'vitest';
import { isLegacyExport, readLegacyData } from '../../src/core/backup.js';
import {
  LEGACY_KEYS,
  parseLegacyStorage,
  summarizeLegacyImport,
  toWorkspaceId,
} from '../../src/core/legacy.js';
import {
  legacyExportFile,
  multiSpaceStorage,
  singleKeyStorage,
} from './support/legacy-fixtures.js';

/** @param {Record<string, string>} keys */
function storageOf(keys) {
  return {
    spaces: keys[LEGACY_KEYS.spaces] ?? null,
    currentSpace: keys[LEGACY_KEYS.currentSpace] ?? null,
    singleSpace: keys[LEGACY_KEYS.singleSpace] ?? null,
    theme: keys[LEGACY_KEYS.theme] ?? null,
    dataOf: (/** @type {string} */ id) => keys[`${LEGACY_KEYS.dataPrefix}${id}`] ?? null,
  };
}

let counter = 0;
const options = { makeId: () => `made-${++counter}`, defaultLabel: 'Mes favoris', now: 42 };

describe('several spaces (favoris.spaces and favoris.v1:<id>)', () => {
  const legacy = parseLegacyStorage(storageOf(multiSpaceStorage()), options);

  test('one workspace per space, in order, with its label and its date', () => {
    expect(legacy?.workspaces.map((w) => [w.id, w.label, w.createdAt])).toEqual([
      ['default', 'Mon espace', 1700000000000],
      ['travail', 'Travail', 1700000100000],
      ['lectures-2', 'Lectures', 1700000200000],
    ]);
  });

  test('the space that was open is the active workspace, the theme is carried', () => {
    expect(legacy?.activeId).toBe('travail');
    expect(legacy?.theme).toBe('dark');
  });

  test('groups keep their order, star, fold and label; colours become categories', () => {
    const groups = legacy?.workspaces[0]?.data.groups;
    expect(
      groups?.map((g) => [g.id, g.label, g.category, g.featured, g.collapsed, g.position]),
    ).toEqual([
      ['docs', 'Documentation', 10, true, false, 0], // indigo
      ['tools', 'Outils', 6, false, true, 1], // teal
      ['reading', 'Lecture', 2, false, false, 2], // amber
      ['ancien-tag', 'ancien-tag', 16, false, false, 3], // the tag that was deleted
    ]);
  });

  test('links keep their order and their group; the tag of a deleted tag is a group, an empty tag is none', () => {
    const links = legacy?.workspaces[0]?.data.links;
    expect(links?.map((l) => [l.id, l.name, l.url, l.groupId, l.position])).toEqual([
      ['l1', 'MDN Web Docs', 'https://developer.mozilla.org', 'docs', 0],
      ['l2', 'GitHub', 'https://github.com', 'tools', 1],
      ['l3', 'Can I Use', 'https://caniuse.com', 'docs', 2],
      ['l4', 'Vieux lien', 'https://old.example', null, 3],
      ['l5', 'Tag disparu', 'https://gone.example', 'ancien-tag', 4],
      ['l7', 'Sans schéma', 'https://exemple.org', 'reading', 5],
    ]);
  });

  test('a javascript: link is not imported, and is counted', () => {
    const first = legacy?.workspaces[0];
    expect(first?.data.links.some((l) => l.url.startsWith('javascript'))).toBe(false);
    expect(first?.skipped).toEqual({ groups: 0, links: 0, unsafeUrls: 1 });
  });

  test('a space that was never opened (no data key) is an empty workspace', () => {
    const never = legacy?.workspaces[2];
    expect(never?.data).toEqual({ groups: [], links: [] });
    expect(never?.unreadable).toBe(false);
  });

  test('the totals', () => {
    expect(legacy && summarizeLegacyImport(legacy)).toEqual({
      workspaces: 3,
      links: 7,
      skipped: { groups: 0, links: 0, unsafeUrls: 1 },
      unreadable: 0,
    });
  });
});

describe('the single key of the versions before spaces (favoris.v1)', () => {
  test('is one workspace named by the app, holding the groups and links', () => {
    const legacy = parseLegacyStorage(storageOf(singleKeyStorage()), options);
    expect(legacy?.workspaces).toHaveLength(1);
    expect(legacy?.workspaces[0]).toMatchObject({
      id: 'default',
      label: 'Mes favoris',
      createdAt: 42,
    });
    expect(legacy?.workspaces[0]?.data.groups).toMatchObject([
      { id: 'docs', category: 9, featured: true },
    ]);
    expect(legacy?.workspaces[0]?.data.links.map((l) => l.groupId)).toEqual(['docs', null]);
    expect(legacy?.activeId).toBe('default');
    expect(legacy?.theme).toBeNull();
  });

  test('the key of the default space wins over the single key, as the old app copied it once', () => {
    const keys = {
      ...singleKeyStorage(),
      'favoris.v1:default': JSON.stringify({
        tags: [],
        links: [{ id: 'z', url: 'https://z.example' }],
      }),
    };
    const legacy = parseLegacyStorage(storageOf(keys), options);
    expect(legacy?.workspaces[0]?.data.links.map((l) => l.id)).toEqual(['z']);
  });

  test('when there is a list of spaces, the single key is ignored', () => {
    const keys = { ...singleKeyStorage(), ...multiSpaceStorage() };
    const legacy = parseLegacyStorage(storageOf(keys), options);
    expect(legacy?.workspaces).toHaveLength(3);
  });
});

describe('nothing to import, and damaged data', () => {
  test('a browser that never ran the previous version has nothing', () => {
    expect(parseLegacyStorage(storageOf({}), options)).toBeNull();
    expect(parseLegacyStorage(storageOf({ [LEGACY_KEYS.spaces]: '[]' }), options)).toBeNull();
    expect(
      parseLegacyStorage(storageOf({ [LEGACY_KEYS.spaces]: '{not json' }), options),
    ).toBeNull();
  });

  test('a space whose data is not valid JSON is imported empty and reported', () => {
    const keys = {
      [LEGACY_KEYS.spaces]: JSON.stringify([{ id: 'a', label: 'A' }]),
      [`${LEGACY_KEYS.dataPrefix}a`]: '{"tags": [',
    };
    const legacy = parseLegacyStorage(storageOf(keys), options);
    expect(legacy?.workspaces[0]).toMatchObject({
      unreadable: true,
      data: { groups: [], links: [] },
    });
    expect(legacy && summarizeLegacyImport(legacy).unreadable).toBe(1);
  });

  test('data that is not an object ("null", a list) is empty and unreadable', () => {
    for (const raw of ['null', '[1,2]', '"text"', '12']) {
      const keys = {
        [LEGACY_KEYS.spaces]: JSON.stringify([{ id: 'a', label: 'A' }]),
        [`${LEGACY_KEYS.dataPrefix}a`]: raw,
      };
      expect(parseLegacyStorage(storageOf(keys), options)?.workspaces[0]?.unreadable).toBe(true);
    }
  });

  test('bad entries of the list of spaces are skipped, bad ids are made valid and unique', () => {
    const keys = {
      [LEGACY_KEYS.spaces]: JSON.stringify([
        null,
        'text',
        { label: 'No id' },
        { id: 'Mon Espace_1', label: '  ' },
        { id: 'mon-espace-1', label: 'Same slug' },
        { id: 'Mon Espace_1', label: 'Same id' },
        { id: '***', createdAt: 'yesterday' },
      ]),
      [LEGACY_KEYS.currentSpace]: 'unknown',
    };
    const legacy = parseLegacyStorage(storageOf(keys), options);
    expect(legacy?.workspaces.map((w) => [w.id, w.label, w.createdAt])).toEqual([
      ['mon-espace-1', 'Mon Espace_1', 42],
      ['mon-espace-1-2', 'Same slug', 42],
      ['space', '***', 42],
    ]);
    expect(legacy?.activeId).toBe('mon-espace-1'); // the current space is unknown: the first one
  });

  test('toWorkspaceId makes ids the registry accepts', () => {
    expect(toWorkspaceId('Été / Café', new Set())).toBe('ete-cafe');
    expect(toWorkspaceId('x'.repeat(60), new Set())).toHaveLength(36);
    expect(toWorkspaceId('a', new Set(['a', 'a-2']))).toBe('a-3');
    expect(toWorkspaceId('', new Set())).toBe('space');
  });

  test('only light and dark are carried as a theme', () => {
    const keys = { ...singleKeyStorage(), [LEGACY_KEYS.theme]: 'sepia' };
    expect(parseLegacyStorage(storageOf(keys), options)?.theme).toBeNull();
  });
});

describe('the file the previous version exported', () => {
  test('is recognized: tags and links, no envelope', () => {
    expect(isLegacyExport(legacyExportFile())).toBe(true);
    expect(
      isLegacyExport({ app: 'favoris', format: 'favoris-workspace', tags: [], links: [] }),
    ).toBe(false);
    expect(isLegacyExport({ groups: [], links: [] })).toBe(false);
    expect(isLegacyExport(null)).toBe(false);
    expect(isLegacyExport([])).toBe(false);
  });

  test('is read record by record: groups, categories, safe addresses, missing ids made up', () => {
    const { data, skipped } = readLegacyData(legacyExportFile(), () => 'made-up');
    expect(data.groups.map((g) => [g.id, g.category, g.featured])).toEqual([
      ['clients', 14, true],
      ['outils', 6, false],
    ]);
    expect(data.links.map((l) => [l.id, l.url, l.groupId])).toEqual([
      ['t1', 'https://intranet.example/', 'clients'],
      ['t3', 'https://wiki.example', 'outils'],
    ]);
    expect(skipped).toEqual({ groups: 0, links: 1, unsafeUrls: 1 });
  });
});
