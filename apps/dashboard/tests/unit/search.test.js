/** @import { App } from '../../src/types.d.ts' */
import { describe, expect, test } from 'vitest';
import { resolveLinks } from '../../src/core/links.js';
import {
  filterApps,
  filterExtras,
  filterResolvedLinks,
  matchesTokens,
  normalizeSearchText,
  tokenizeSearchQuery,
} from '../../src/core/search.js';
import { app, settings, template } from './support/data.js';

const tpl = template({ id: 't1', name: 'webapp-spring' });
const apps = [
  app({ id: 'a1', templateId: 't1', name: 'MonComptePerso', slug: 'mon-compte', jiraKey: 'MCP' }),
  app({
    id: 'a2',
    templateId: 't1',
    name: 'Paiement',
    description: 'Données bancaires',
    extras: [{ id: 'x', name: 'Runbook', url: 'https://wiki.example.invalid', tag: 'docs' }],
  }),
];

describe('the words of a query', () => {
  test('are lowercase, without accents, and split on spaces', () => {
    expect(normalizeSearchText('  Équipe  ÉLÈVE ')).toBe('equipe eleve');
    expect(tokenizeSearchQuery('  Données  bancaires ')).toEqual(['donnees', 'bancaires']);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });

  test('all of them must be found', () => {
    expect(matchesTokens('Données bancaires', ['donnees', 'banc'])).toBe(true);
    expect(matchesTokens('Données bancaires', ['donnees', 'xyz'])).toBe(false);
    expect(matchesTokens('anything', [])).toBe(true);
  });
});

describe('applications', () => {
  test('a blank query is every application, the same array', () => {
    expect(filterApps(apps, [tpl], '  ')).toBe(apps);
  });

  test('match by name, slug, Jira key, description, template and extra link', () => {
    for (const [query, id] of /** @type {[string, string][]} */ ([
      ['moncompte', 'a1'],
      ['mon-compte', 'a1'],
      ['mcp', 'a1'],
      ['donnees', 'a2'],
      ['runbook', 'a2'],
    ])) {
      expect(filterApps(apps, [tpl], query).map((a) => a.id)).toEqual([id]);
    }
    expect(filterApps(apps, [tpl], 'spring').map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(filterApps(apps, [tpl], 'nothing')).toEqual([]);
  });
});

describe('links', () => {
  const resolved = resolveLinks(/** @type {App} */ (apps[0]), tpl, 'dev');
  const { tags } = settings();

  test('match by name, address and tag label', () => {
    expect(filterResolvedLinks(resolved, tags, 'git').map((r) => r.link.name)).toEqual(['Git']);
    expect(filterResolvedLinks(resolved, tags, 'mon-compte-dev').map((r) => r.link.name)).toEqual([
      'App',
    ]);
    expect(filterResolvedLinks(resolved, tags, 'git zzz')).toEqual([]);
    expect(filterResolvedLinks(resolved, tags, 'git.example').map((r) => r.link.name)).toEqual([
      'Git',
    ]);
    expect(filterResolvedLinks(resolved, tags, 'application').map((r) => r.link.name)).toEqual([
      'App',
    ]);
    expect(filterResolvedLinks(resolved, tags, '')).toBe(resolved);
  });

  test('extra links match by name, address and tag label', () => {
    const extras = apps[1]?.extras ?? [];
    expect(filterExtras(extras, tags, 'wiki')).toHaveLength(1);
    expect(filterExtras(extras, tags, 'zzz')).toHaveLength(0);
    expect(filterExtras(extras, tags, '')).toBe(extras);
  });
});
