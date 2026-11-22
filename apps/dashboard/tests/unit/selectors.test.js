/** @import { App } from '../../src/types.d.ts' */
import { describe, expect, test } from 'vitest';
import {
  activeEnvKey,
  availableSlug,
  groupByTag,
  openableCount,
  slugTaken,
  startApp,
  templateOf,
  templateUsage,
} from '../../src/core/selectors.js';
import { app, settings, stateWith, template } from './support/data.js';

const tpl = template({ id: 't1' });

describe('which environment opens', () => {
  const envs = [{ key: 'dev' }, { key: 'test' }, { key: 'prod' }].map((e) => ({
    ...e,
    label: e.key,
  }));
  const withEnvs = template({ id: 't', envs });

  test('the chosen one when the template still has it', () => {
    expect(activeEnvKey(withEnvs, 'last', 'test')).toBe('test');
    expect(activeEnvKey(withEnvs, 'first', 'test')).toBe('test');
  });

  test('else the first or the last one, "remember" falling back to the last', () => {
    expect(activeEnvKey(withEnvs, 'first', null)).toBe('dev');
    expect(activeEnvKey(withEnvs, 'last', 'gone')).toBe('prod');
    expect(activeEnvKey(withEnvs, 'remember', undefined)).toBe('prod');
  });

  test('none for a template with no environment', () => {
    expect(activeEnvKey(template({ id: 'x', envs: [] }), 'last', null)).toBeNull();
  });
});

describe('which application opens', () => {
  const state = stateWith({
    templates: [tpl],
    apps: [app({ id: 'a1', templateId: 't1' }), app({ id: 'a2', templateId: 't1' })],
    settings: settings({ defaultAppId: 'a2' }),
  });

  test('the default one, whatever was looked at last', () => {
    expect(startApp(state, 'a1')?.id).toBe('a2');
  });

  test('without a default, the one looked at last, else the first', () => {
    const open = { ...state, settings: settings({ defaultAppId: null }) };
    expect(startApp(open, 'a2')?.id).toBe('a2');
    expect(startApp(open, 'gone')?.id).toBe('a1');
    expect(startApp(open, null)?.id).toBe('a1');
    expect(startApp({ ...open, apps: [] }, null)).toBeNull();
  });
});

describe('templates and slugs', () => {
  const state = stateWith({
    templates: [tpl, template({ id: 't2' })],
    apps: [
      app({ id: 'a1', templateId: 't1' }),
      app({ id: 'a2', templateId: 't1' }),
      app({ id: 'a3', templateId: 'gone' }),
    ],
  });

  test('counts the applications of each template', () => {
    expect([...templateUsage(state)]).toEqual([
      ['t1', 2],
      ['t2', 0],
    ]);
  });

  test('finds the template of an application, null when it is gone', () => {
    const [first, , orphan] = /** @type {[App, App, App]} */ (/** @type {unknown} */ (state.apps));
    expect(templateOf(state, first)?.id).toBe('t1');
    expect(templateOf(state, orphan)).toBeNull();
  });

  test('a slug is taken by another application only', () => {
    expect(slugTaken(state, 'a1', null)).toBe(true);
    expect(slugTaken(state, 'a1', 'a1')).toBe(false);
    expect(slugTaken(state, 'free', null)).toBe(false);
  });

  test('a free slug is the base, or the base with a number', () => {
    expect(availableSlug(state, 'free')).toBe('free');
    expect(availableSlug(state, 'a1')).toBe('a1-2');
    expect(
      availableSlug(
        stateWith({
          apps: [
            app({ id: 'x', templateId: 't', slug: 'a1-2' }),
            app({ id: 'y', templateId: 't', slug: 'a1' }),
          ],
        }),
        'a1',
      ),
    ).toBe('a1-3');
    expect(availableSlug(state, '')).toBe('app');
  });
});

describe('groupByTag', () => {
  const tags = settings().tags;
  const items = [{ tag: 'app' }, { tag: '' }, { tag: 'removed' }, { tag: 'cicd' }, { tag: 'app' }];

  test('lists the tags in their own order, then the unknown keys, then the untagged', () => {
    const groups = groupByTag(items, tags, (item) => item.tag);

    expect(groups.map((g) => [g.key, g.items.length, g.tag?.key ?? null])).toEqual([
      ['cicd', 1, 'cicd'],
      ['app', 2, 'app'],
      ['removed', 1, null],
      ['', 1, null],
    ]);
  });

  test('leaves out a tag with no item', () => {
    expect(groupByTag([], tags, (item) => /** @type {{ tag: string }} */ (item).tag)).toEqual([]);
  });

  test('counts what can be opened', () => {
    expect(
      openableCount(
        [{ problem: null }, { problem: 'unsafe' }, { problem: null }].map(
          (r) => /** @type {any} */ (r),
        ),
      ),
    ).toBe(2);
  });
});
