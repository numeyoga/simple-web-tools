import { describe, expect, test } from 'vitest';
import {
  cleanData,
  normalizeIcon,
  normalizeMetaKey,
  sanitizeApp,
  sanitizeOptions,
  sanitizeTags,
  sanitizeTemplate,
  shiftAt,
  slugify,
  sortByPosition,
} from '../../src/core/model.js';
import { app, settings, template } from './support/data.js';

/** Ids `m1`, `m2`... */
function counter() {
  let n = 0;
  return () => `m${(n += 1)}`;
}

describe('keys and names', () => {
  test('a slug has lowercase letters, digits and single dashes, without accents', () => {
    expect(slugify('Mon Compte Perso')).toBe('mon-compte-perso');
    expect(slugify('  Équipe — Données  ')).toBe('equipe-donnees');
    expect(slugify('---')).toBe('');
    expect(slugify(42)).toBe('');
    expect(slugify('x'.repeat(100))).toHaveLength(40);
  });

  test('the key of a metadata field keeps its case and drops what a placeholder cannot hold', () => {
    expect(normalizeMetaKey('controlM')).toBe('controlM');
    expect(normalizeMetaKey('Dernier déploiement')).toBe('Dernier_deploiement');
    expect(normalizeMetaKey('a-b.c')).toBe('a_b_c');
    expect(normalizeMetaKey('***')).toBe('');
  });

  test('an icon is a Phosphor name, anything else is the tag icon', () => {
    expect(normalizeIcon('git-branch')).toBe('git-branch');
    for (const raw of ['', 'Git Branch', '<img>', 3, null]) expect(normalizeIcon(raw)).toBe('tag');
  });

  test('the choices of a list are trimmed texts without duplicates', () => {
    expect(sanitizeOptions([' a ', 'a', '', 'b', 3, null])).toEqual(['a', 'b', '3']);
    expect(sanitizeOptions('a, b')).toEqual([]);
  });

  test('shiftAt moves an item, and returns the same array when it cannot', () => {
    const list = ['a', 'b', 'c'];
    expect(shiftAt(list, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(shiftAt(list, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(shiftAt(list, 0, -1)).toBe(list);
    expect(shiftAt(list, 2, 1)).toBe(list);
    expect(shiftAt(list, 7, 1)).toBe(list);
  });

  test('records without a position keep their place after the numbered ones', () => {
    expect(
      sortByPosition([{ id: 'x' }, { id: 'b', position: 1 }, { id: 'a', position: 0 }]).map(
        (r) => r.id,
      ),
    ).toEqual(['a', 'b', 'x']);
  });
});

describe('tags', () => {
  test('reads the earlier version’s object, in its order', () => {
    const { tags, skipped } = sanitizeTags({
      cicd: { label: 'CI / CD', icon: 'git-branch' },
      equipe: { label: '', icon: 'Not An Icon' },
    });

    expect(tags).toEqual([
      { key: 'cicd', label: 'CI / CD', icon: 'git-branch' },
      { key: 'equipe', label: 'equipe', icon: 'tag' },
    ]);
    expect(skipped).toBe(0);
  });

  test('reads a list, and skips a key that is not in slug form or is repeated', () => {
    const { tags, skipped } = sanitizeTags([
      { key: 'docs', label: 'Docs', icon: 'book-open' },
      { key: 'Docs', label: 'No' },
      { key: 'docs', label: 'Again' },
      { label: 'No key' },
      'text',
    ]);

    expect(tags.map((t) => t.key)).toEqual(['docs']);
    expect(skipped).toBe(4);
  });

  test('anything else is no tags', () => {
    expect(sanitizeTags(undefined)).toEqual({ tags: [], skipped: 0 });
    expect(sanitizeTags('x')).toEqual({ tags: [], skipped: 0 });
  });
});

describe('templates', () => {
  test('cleans the environments, fields and links one by one', () => {
    const cleaned = sanitizeTemplate(
      {
        id: 't1',
        name: '  web   app ',
        envs: [
          { key: 'DEV', label: '' },
          { key: 'dev' },
          { key: '' },
          'x',
          { key: 'Pré prod', label: 'PP' },
        ],
        metaFields: [
          { key: 'cluster', label: 'Cluster', type: 'weird' },
          { key: 'cluster' },
          { key: 'region', type: 'select', options: ['a', 'a', 'b'] },
          { key: 'owner', type: 'text', options: ['ignored'] },
        ],
        links: [
          { id: 'l1', name: 'Git', tag: 'cicd', scope: 'global', pattern: 'https://x/{slug}' },
          { id: 'l1', name: 'Same id', pattern: 'x' },
          { id: 'l2', pattern: 3 },
          { name: 'No id', pattern: 'https://y', scope: 'nope' },
        ],
      },
      counter(),
    );

    expect(cleaned?.name).toBe('web app');
    expect(cleaned?.envs).toEqual([
      { key: 'dev', label: 'DEV' },
      { key: 'pre-prod', label: 'PP' },
    ]);
    expect(cleaned?.metaFields.map((f) => [f.key, f.type, f.options])).toEqual([
      ['cluster', 'text', []],
      ['region', 'select', ['a', 'b']],
      ['owner', 'text', []],
    ]);
    expect(cleaned?.links.map((l) => [l.id, l.scope, l.tag])).toEqual([
      ['l1', 'global', 'cicd'],
      ['m1', 'env', ''],
    ]);
  });

  test('is not a template without a list of environments, and takes an id from the caller', () => {
    expect(sanitizeTemplate({ id: 't', name: 'x' })).toBeNull();
    expect(sanitizeTemplate('x')).toBeNull();
    expect(sanitizeTemplate({ name: 'x', envs: [] })).toBeNull();
    expect(sanitizeTemplate({ name: 'x', envs: [] }, counter())?.id).toBe('m1');
  });
});

describe('applications', () => {
  test('reads the earlier version’s environments: metadata and overrides', () => {
    const result = sanitizeApp(
      {
        id: 'a1',
        name: 'Account',
        slug: 'Mon Slug',
        templateId: 't1',
        jiraKey: 'ACC',
        envs: {
          dev: {
            meta: { cluster: 'ocp-1', owner: 7, empty: '', 'bad key': 'x', obj: {} },
            overrides: { l1: 'grafana.example.invalid/x', l2: 'javascript:alert(1)', l3: '' },
          },
        },
        extras: [
          { id: 'x1', name: 'Wiki', url: 'wiki.example.invalid', tag: 'docs' },
          { id: 'x2', name: 'Evil', url: 'javascript:alert(1)' },
          { id: 'x3', name: 'Nothing', url: '' },
          'no',
        ],
      },
      counter(),
    );

    expect(result?.app.slug).toBe('mon-slug');
    expect(result?.app.envs.dev).toEqual({
      meta: { cluster: 'ocp-1', owner: '7' },
      overrides: { l1: 'https://grafana.example.invalid/x' },
    });
    expect(result?.app.extras).toEqual([
      { id: 'x1', name: 'Wiki', url: 'https://wiki.example.invalid', tag: 'docs' },
    ]);
    expect(result?.unsafe).toBe(2);
    expect(result?.parts).toBe(2);
  });

  test('reads an environment that is only its metadata', () => {
    const result = sanitizeApp({ id: 'a', templateId: 't', envs: { prod: { cluster: 'x' } } });

    expect(result?.app.envs.prod).toEqual({ meta: { cluster: 'x' }, overrides: {} });
  });

  test('is not an application without a template, and falls back to the slug or the id for its name', () => {
    expect(sanitizeApp({ id: 'a' })).toBeNull();
    expect(sanitizeApp(null)).toBeNull();
    expect(sanitizeApp({ id: 'a1', templateId: 't', slug: 'the-slug' })?.app.name).toBe('the-slug');
    expect(sanitizeApp({ id: 'a1', templateId: 't' })?.app.slug).toBe('a1');
  });
});

describe('cleanData', () => {
  test('skips and counts what cannot be used, never fatal', () => {
    const { data, skipped } = cleanData({
      settings: {
        dashboardName: ' Mine ',
        defaultAppId: 'a1',
        defaultEnv: 'first',
        tags: [{ key: 'docs' }],
      },
      templates: [template({ id: 't1' }), 'x', template({ id: 't1' }), { id: 't3' }],
      apps: [
        app({ id: 'a1', templateId: 't1' }),
        app({ id: 'a1', templateId: 't1' }),
        app({ id: 'a2', templateId: 'gone' }),
        { name: 'no id, no template' },
      ],
    });

    expect(data.templates.map((t) => t.id)).toEqual(['t1']);
    expect(data.apps.map((a) => a.id)).toEqual(['a1', 'a2']); // the one that lost its template stays
    expect(skipped).toEqual({ templates: 3, apps: 2, parts: 0, unsafeUrls: 0 });
    expect(data.settings).toMatchObject({
      dashboardName: 'Mine',
      defaultAppId: 'a1',
      defaultEnv: 'first',
    });
    expect(data.templates.map((t) => t.position)).toEqual([0]);
    expect(data.apps.map((a) => a.position)).toEqual([0, 1]);
  });

  test('a default application that does not exist, and an unknown default environment, fall back', () => {
    const { data } = cleanData({
      settings: { defaultAppId: 'nope', defaultEnv: 'prod' },
      templates: [],
      apps: [],
    });

    expect(data.settings).toMatchObject({ defaultAppId: null, defaultEnv: 'last' });
  });

  test('reads the settings from the top level too, as the earlier version wrote them', () => {
    const { data } = cleanData({ dashboardName: 'Old', tags: { docs: { label: 'Docs' } } });

    expect(data.settings.dashboardName).toBe('Old');
    expect(data.settings.tags.map((t) => t.key)).toEqual(['docs']);
  });

  test('puts what storage holds in the order of its positions', () => {
    const { data } = cleanData(
      {
        settings: settings(),
        templates: [],
        apps: [
          app({ id: 'b', templateId: 't', position: 1 }),
          app({ id: 'a', templateId: 't', position: 0 }),
        ],
      },
      { sorted: true },
    );

    expect(data.apps.map((a) => a.id)).toEqual(['a', 'b']);
  });

  test('cleaning is stable: clean data cleans to itself', () => {
    const first = cleanData({
      settings: settings({ dashboardName: 'X' }),
      templates: [template({ id: 't1' })],
      apps: [app({ id: 'a1', templateId: 't1' })],
    });

    expect(cleanData(first.data, { sorted: true }).data).toEqual(first.data);
  });
});
