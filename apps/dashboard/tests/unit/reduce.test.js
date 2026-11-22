// The state machine: every data command, what it refuses, and the effects it asks for.
/** @import { AppCommand, AppState } from '../../src/types.d.ts' */
import { describe, expect, test } from 'vitest';
import {
  createInitialState,
  createStore,
  diffEffects,
  isDataCommand,
  reduce,
} from '../../src/core/store.js';
import { app, settings, stateWith, template } from './support/data.js';

const t1 = template({ id: 't1' });
const a1 = app({
  id: 'a1',
  templateId: 't1',
  slug: 'one',
  envs: {
    dev: { meta: { cluster: 'c-dev' }, overrides: { 't1-git': 'https://own.example.invalid' } },
    prod: { meta: { cluster: 'c-prod' }, overrides: {} },
  },
});
const a2 = app({ id: 'a2', templateId: 't1', slug: 'two' });

/** A state with one template and two applications. */
const base = () => stateWith({ templates: [t1], apps: [a1, a2] });

/**
 * @param {AppState} state
 * @param {AppCommand} command
 */
const run = (state, command) => reduce(state, command);

/** The effect types, in order. @param {{ effects: { type: string }[] }} result */
const types = (result) => result.effects.map((e) => e.type);

describe('view commands', () => {
  test('hydrate cleans what storage holds and takes the role of the tab', () => {
    const { nextState, effects } = run(createInitialState(), {
      type: 'hydrate',
      payload: {
        settings: settings({ defaultAppId: 'a1' }),
        templates: [t1],
        apps: [
          { ...a1, position: 1 },
          { ...a2, position: 0 },
        ],
        readOnly: true,
      },
    });

    expect(nextState.readOnly).toBe(true);
    expect(nextState.apps.map((a) => a.id)).toEqual(['a2', 'a1']);
    expect(nextState.settings.defaultAppId).toBe('a1');
    expect(effects).toEqual([]);
  });

  test('the filter and the edit mode work in a read-only tab, and a no-op returns the same state', () => {
    const readOnly = stateWith({ readOnly: true });
    expect(run(readOnly, { type: 'set_search', query: 'x' }).nextState.search).toBe('x');
    expect(run(readOnly, { type: 'set_edit_mode', editMode: true }).nextState.editMode).toBe(true);
    const state = base();
    expect(run(state, { type: 'set_search', query: '' }).nextState).toBe(state);
    expect(run(state, { type: 'set_edit_mode', editMode: false }).nextState).toBe(state);
    expect(run(state, { type: 'set_read_only', readOnly: false }).nextState).toBe(state);
  });

  test('a data command is refused in a read-only tab: same state, no effect', () => {
    const state = stateWith({ templates: [t1], readOnly: true });
    const result = run(state, { type: 'update_template', id: 't1', name: 'Other' });

    expect(result.nextState).toBe(state);
    expect(result.effects).toEqual([]);
    expect(isDataCommand('update_template')).toBe(true);
    expect(isDataCommand('set_search')).toBe(false);
    expect(isDataCommand('hydrate')).toBe(false);
  });

  test('the store tells its listeners only when something changed', () => {
    const store = createStore(base());
    const heard = /** @type {string[]} */ ([]);
    store.subscribe(({ command }) => heard.push(command.type));

    store.dispatch({ type: 'update_template', id: 't1', name: 'Renamed' });
    store.dispatch({ type: 'update_template', id: 't1', name: 'Renamed' });
    store.dispatch({ type: 'delete_template', id: 't1' }); // still used: refused

    expect(heard).toEqual(['update_template']);
  });
});

describe('settings', () => {
  test('the name is cleaned, the default application must exist, the default environment is one of three', () => {
    const state = base();
    const named = run(state, { type: 'update_settings', dashboardName: '  My   name ' });
    expect(named.nextState.settings.dashboardName).toBe('My name');
    expect(types(named)).toEqual(['persist_settings']);

    expect(
      run(state, { type: 'update_settings', defaultAppId: 'a2' }).nextState.settings.defaultAppId,
    ).toBe('a2');
    expect(run(state, { type: 'update_settings', defaultAppId: 'nope' }).nextState).toBe(state);
    expect(
      run(state, { type: 'update_settings', defaultEnv: 'first' }).nextState.settings.defaultEnv,
    ).toBe('first');
    expect(
      run(state, { type: 'update_settings', defaultEnv: /** @type {never} */ ('prod') }).nextState,
    ).toBe(state);
  });
});

describe('tags', () => {
  test('add, label, icon, order and delete', () => {
    let state = base();
    state = run(state, {
      type: 'add_tag',
      key: 'Docs & More',
      label: 'Docs',
      icon: 'book-open',
    }).nextState;
    expect(state.settings.tags.at(-1)).toEqual({
      key: 'docs-more',
      label: 'Docs',
      icon: 'book-open',
    });

    const same = run(state, { type: 'add_tag', key: 'docs-more', label: 'x', icon: 'tag' });
    expect(same.nextState).toBe(state);
    expect(run(state, { type: 'add_tag', key: '###', label: 'x', icon: 'tag' }).nextState).toBe(
      state,
    );

    state = run(state, {
      type: 'update_tag',
      key: 'docs-more',
      label: 'Documents',
      icon: 'bad icon',
    }).nextState;
    expect(state.settings.tags.at(-1)).toMatchObject({ label: 'Documents', icon: 'tag' });
    expect(run(state, { type: 'update_tag', key: 'docs-more', label: '  ' }).nextState).toBe(state);
    expect(run(state, { type: 'update_tag', key: 'nope', label: 'x' }).nextState).toBe(state);

    state = run(state, { type: 'shift_tag', key: 'docs-more', delta: -1 }).nextState;
    expect(state.settings.tags.map((t) => t.key)).toEqual(['cicd', 'docs-more', 'app']);
    expect(run(state, { type: 'shift_tag', key: 'cicd', delta: -1 }).nextState).toBe(state);

    state = run(state, { type: 'delete_tag', key: 'docs-more' }).nextState;
    expect(state.settings.tags.map((t) => t.key)).toEqual(['cicd', 'app']);
  });

  test('renaming the key carries the template links and the extra links along', () => {
    const withExtra = app({
      id: 'a3',
      templateId: 't1',
      extras: [{ id: 'x', name: 'Wiki', url: 'https://w.example.invalid', tag: 'cicd' }],
    });
    const state = stateWith({ templates: [t1], apps: [a1, withExtra] });

    const result = run(state, { type: 'rename_tag', key: 'cicd', newKey: 'pipelines' });

    expect(result.nextState.settings.tags.map((t) => t.key)).toEqual(['pipelines', 'app']);
    expect(result.nextState.templates[0]?.links.map((l) => l.tag)).toEqual(['pipelines', 'app']);
    expect(result.nextState.apps[1]?.extras[0]?.tag).toBe('pipelines');
    expect(types(result)).toEqual(['persist_settings', 'persist_template', 'persist_app']);
    // An application with no extra link on that tag is untouched.
    expect(result.nextState.apps[0]).toBe(state.apps[0]);
  });

  test('a key that is empty, taken or unchanged is refused', () => {
    const state = base();
    for (const newKey of ['', '###', 'app', 'cicd']) {
      expect(run(state, { type: 'rename_tag', key: 'cicd', newKey }).nextState).toBe(state);
    }
  });

  test('deleting a tag keeps the links that carry it', () => {
    const state = base();
    const result = run(state, { type: 'delete_tag', key: 'cicd' });

    expect(result.nextState.templates).toBe(state.templates);
    expect(types(result)).toEqual(['persist_settings']);
  });
});

describe('templates', () => {
  test('add: cleaned, at the end, with a free id', () => {
    const state = base();
    const { template: draft } = {
      template: { ...template({ id: 't2', name: '  Second  ' }), position: undefined },
    };
    const added = run(state, { type: 'add_template', template: draft });

    expect(added.nextState.templates.map((t) => [t.id, t.position, t.name])).toEqual([
      ['t1', 0, 'Template t1'],
      ['t2', 1, 'Second'],
    ]);
    expect(types(added)).toEqual(['persist_template']);
    expect(run(state, { type: 'add_template', template: { ...draft, id: 't1' } }).nextState).toBe(
      state,
    );
    expect(
      run(state, { type: 'add_template', template: /** @type {never} */ ({ id: 'x' }) }).nextState,
    ).toBe(state);
  });

  test('rename and describe', () => {
    const state = base();
    const result = run(state, {
      type: 'update_template',
      id: 't1',
      name: ' Web ',
      description: 'A\n\n\n\nB',
    });

    expect(result.nextState.templates[0]).toMatchObject({ name: 'Web', description: 'A\n\nB' });
    expect(run(state, { type: 'update_template', id: 't1', name: '   ' }).nextState).toBe(state);
    expect(run(state, { type: 'update_template', id: 'nope', name: 'x' }).nextState).toBe(state);
  });

  test('delete only when no application uses it, and the positions follow', () => {
    const state = stateWith({
      templates: [t1, template({ id: 't2' }), template({ id: 't3' })],
      apps: [a1],
    });

    expect(run(state, { type: 'delete_template', id: 't1' }).nextState).toBe(state);
    const result = run(state, { type: 'delete_template', id: 't2' });
    expect(result.nextState.templates.map((t) => [t.id, t.position])).toEqual([
      ['t1', 0],
      ['t3', 1],
    ]);
    expect(types(result)).toEqual(['remove_template', 'persist_template']);
    expect(run(state, { type: 'delete_template', id: 'nope' }).nextState).toBe(state);
  });
});

describe('environments of a template', () => {
  test('adding one gives every application of the template an empty record for it', () => {
    const state = stateWith({
      templates: [t1, template({ id: 't2' })],
      apps: [a1, app({ id: 'o', templateId: 't2' })],
    });
    const result = run(state, { type: 'add_env', templateId: 't1', key: 'Pré Prod', label: '' });

    expect(result.nextState.templates[0]?.envs.at(-1)).toEqual({
      key: 'pre-prod',
      label: 'PRE-PROD',
    });
    expect(result.nextState.apps[0]?.envs['pre-prod']).toEqual({ meta: {}, overrides: {} });
    // The other template's application is not touched.
    expect(result.nextState.apps[1]).toBe(state.apps[1]);
    expect(
      run(state, { type: 'add_env', templateId: 't1', key: 'dev', label: 'x' }).nextState,
    ).toBe(state);
    expect(run(state, { type: 'add_env', templateId: 't1', key: '--', label: 'x' }).nextState).toBe(
      state,
    );
  });

  test('renaming the key moves the data of the applications with it, renaming the label does not', () => {
    const state = base();
    const moved = run(state, {
      type: 'update_env',
      templateId: 't1',
      key: 'dev',
      newKey: 'development',
    });

    expect(moved.nextState.templates[0]?.envs[0]).toEqual({ key: 'development', label: 'DEV' });
    expect(moved.nextState.apps[0]?.envs.development).toEqual(a1.envs.dev);
    expect(moved.nextState.apps[0]?.envs.dev).toBeUndefined();

    const relabelled = run(state, {
      type: 'update_env',
      templateId: 't1',
      key: 'dev',
      label: 'Dev',
    });
    expect(relabelled.nextState.templates[0]?.envs[0]).toEqual({ key: 'dev', label: 'Dev' });
    expect(relabelled.nextState.apps).toBe(state.apps);

    for (const command of /** @type {AppCommand[]} */ ([
      { type: 'update_env', templateId: 't1', key: 'dev', newKey: 'prod' },
      { type: 'update_env', templateId: 't1', key: 'dev', newKey: '' },
      { type: 'update_env', templateId: 't1', key: 'dev', label: '  ' },
      { type: 'update_env', templateId: 't1', key: 'nope', label: 'x' },
    ])) {
      expect(run(state, command).nextState).toBe(state);
    }
  });

  test('deleting one drops its data from the applications, but never the last one', () => {
    const state = base();
    const result = run(state, { type: 'delete_env', templateId: 't1', key: 'dev' });

    expect(result.nextState.templates[0]?.envs.map((e) => e.key)).toEqual(['prod']);
    expect(Object.keys(result.nextState.apps[0]?.envs ?? {})).toEqual(['prod']);
    expect(
      run(result.nextState, { type: 'delete_env', templateId: 't1', key: 'prod' }).nextState,
    ).toBe(result.nextState);
  });

  test('moving one changes the order only', () => {
    const state = base();
    const result = run(state, { type: 'shift_env', templateId: 't1', key: 'prod', delta: -1 });

    expect(result.nextState.templates[0]?.envs.map((e) => e.key)).toEqual(['prod', 'dev']);
    expect(types(result)).toEqual(['persist_template']);
    expect(
      run(state, { type: 'shift_env', templateId: 't1', key: 'dev', delta: -1 }).nextState,
    ).toBe(state);
  });
});

describe('metadata fields of a template', () => {
  test('add: the key is cleaned, taken and reserved keys are refused', () => {
    const state = base();
    const added = run(state, {
      type: 'add_meta_field',
      templateId: 't1',
      key: 'Dernier déploiement',
      label: 'Last',
      fieldType: 'date',
    });

    expect(added.nextState.templates[0]?.metaFields.at(-1)).toEqual({
      key: 'Dernier_deploiement',
      label: 'Last',
      type: 'date',
      options: [],
    });
    for (const key of ['cluster', 'env', 'slug', 'jiraKey', 'meta', '***']) {
      expect(
        run(state, { type: 'add_meta_field', templateId: 't1', key, label: 'x' }).nextState,
      ).toBe(state);
    }
  });

  test('changing the type to list keeps the choices; changing it back drops them', () => {
    let state = base();
    state = run(state, {
      type: 'update_meta_field',
      templateId: 't1',
      key: 'cluster',
      fieldType: 'select',
      options: ['a', ' b ', 'a'],
    }).nextState;
    expect(state.templates[0]?.metaFields[0]).toMatchObject({
      type: 'select',
      options: ['a', 'b'],
    });
    state = run(state, {
      type: 'update_meta_field',
      templateId: 't1',
      key: 'cluster',
      fieldType: 'text',
    }).nextState;
    expect(state.templates[0]?.metaFields[0]).toMatchObject({ type: 'text', options: [] });
  });

  test('renaming the key carries the values of every environment along', () => {
    const state = base();
    const result = run(state, {
      type: 'update_meta_field',
      templateId: 't1',
      key: 'cluster',
      newKey: 'platform',
    });

    expect(result.nextState.apps[0]?.envs.dev?.meta).toEqual({ platform: 'c-dev' });
    expect(result.nextState.apps[0]?.envs.prod?.meta).toEqual({ platform: 'c-prod' });
    // An application with no value is untouched.
    expect(result.nextState.apps[1]).toBe(state.apps[1]);
    expect(types(result)).toEqual(['persist_template', 'persist_app']);
    for (const newKey of ['slug', '', 'cluster']) {
      expect(
        run(state, { type: 'update_meta_field', templateId: 't1', key: 'cluster', newKey })
          .nextState,
      ).toBe(state);
    }
  });

  test('deleting one drops its values, and moving one changes the order only', () => {
    let state = run(base(), {
      type: 'add_meta_field',
      templateId: 't1',
      key: 'owner',
      label: 'Owner',
    }).nextState;
    state = run(state, {
      type: 'shift_meta_field',
      templateId: 't1',
      key: 'owner',
      delta: -1,
    }).nextState;
    expect(state.templates[0]?.metaFields.map((f) => f.key)).toEqual(['owner', 'cluster']);

    const result = run(state, { type: 'delete_meta_field', templateId: 't1', key: 'cluster' });
    expect(result.nextState.templates[0]?.metaFields.map((f) => f.key)).toEqual(['owner']);
    expect(result.nextState.apps[0]?.envs.dev?.meta).toEqual({});
  });
});

describe('links of a template', () => {
  test('add, change, move and delete; deleting drops the overrides of that link', () => {
    let state = base();
    state = run(state, {
      type: 'add_template_link',
      templateId: 't1',
      id: 'l9',
      name: ' New ',
      tag: 'docs',
      pattern: ' https://x/{slug} ',
    }).nextState;
    expect(state.templates[0]?.links.at(-1)).toEqual({
      id: 'l9',
      name: 'New',
      tag: 'docs',
      scope: 'env',
      pattern: 'https://x/{slug}',
    });
    expect(
      run(state, {
        type: 'add_template_link',
        templateId: 't1',
        id: 'l9',
        name: 'x',
        tag: '',
        pattern: '',
      }).nextState,
    ).toBe(state);

    state = run(state, {
      type: 'update_template_link',
      templateId: 't1',
      id: 'l9',
      name: 'Renamed',
      scope: 'global',
      pattern: 'https://y',
    }).nextState;
    expect(state.templates[0]?.links.at(-1)).toMatchObject({
      name: 'Renamed',
      scope: 'global',
      pattern: 'https://y',
    });
    expect(
      run(state, { type: 'update_template_link', templateId: 't1', id: 'l9', name: ' ' }).nextState,
    ).toBe(state);

    state = run(state, {
      type: 'shift_template_link',
      templateId: 't1',
      id: 'l9',
      delta: -1,
    }).nextState;
    expect(state.templates[0]?.links.map((l) => l.id)).toEqual(['t1-git', 'l9', 't1-app']);

    const removed = run(state, { type: 'delete_template_link', templateId: 't1', id: 't1-git' });
    expect(removed.nextState.templates[0]?.links.map((l) => l.id)).toEqual(['l9', 't1-app']);
    expect(removed.nextState.apps[0]?.envs.dev?.overrides).toEqual({});
    expect(removed.nextState.apps[1]).toBe(state.apps[1]);
  });
});

describe('applications', () => {
  test('add: needs an existing template and a free slug, and gets a record per environment', () => {
    const state = stateWith({ templates: [t1] });
    const draft = {
      ...app({ id: 'n', templateId: 't1', slug: 'New App', envs: {} }),
      position: undefined,
    };
    const added = run(state, { type: 'add_app', app: draft });

    expect(added.nextState.apps[0]).toMatchObject({ id: 'n', slug: 'new-app', position: 0 });
    expect(Object.keys(added.nextState.apps[0]?.envs ?? {})).toEqual(['dev', 'prod']);
    expect(types(added)).toEqual(['persist_app']);
    expect(run(added.nextState, { type: 'add_app', app: { ...draft, id: 'm' } }).nextState).toBe(
      added.nextState,
    );
    expect(run(state, { type: 'add_app', app: { ...draft, templateId: 'gone' } }).nextState).toBe(
      state,
    );
    // A slug that is nothing once cleaned is made from the name.
    expect(
      run(state, { type: 'add_app', app: { ...draft, slug: '--', name: 'From name' } }).nextState
        .apps[0]?.slug,
    ).toBe('from-name');
  });

  test('update: the slug stays unique, the name stays filled', () => {
    const state = base();
    const result = run(state, {
      type: 'update_app',
      id: 'a1',
      name: ' One ',
      slug: 'Eins',
      jiraKey: 'ONE',
      description: 'text',
    });

    expect(result.nextState.apps[0]).toMatchObject({
      name: 'One',
      slug: 'eins',
      jiraKey: 'ONE',
      description: 'text',
    });
    expect(run(state, { type: 'update_app', id: 'a1', slug: 'two' }).nextState).toBe(state);
    expect(run(state, { type: 'update_app', id: 'a1', slug: 'one' }).nextState).toBe(state);
    expect(run(state, { type: 'update_app', id: 'a1', name: '  ' }).nextState).toBe(state);
    expect(run(state, { type: 'update_app', id: 'nope', name: 'x' }).nextState).toBe(state);
  });

  test('delete: the positions follow, and the default application is cleared', () => {
    const state = run(base(), { type: 'update_settings', defaultAppId: 'a1' }).nextState;
    const result = run(state, { type: 'delete_app', id: 'a1' });

    expect(result.nextState.apps.map((a) => [a.id, a.position])).toEqual([['a2', 0]]);
    expect(result.nextState.settings.defaultAppId).toBeNull();
    expect(types(result)).toEqual(['remove_app', 'persist_settings', 'persist_app']);
  });

  test('a value is set, trimmed, and cleared with an empty text; only for a field and an environment the template has', () => {
    const state = base();
    const set = run(state, {
      type: 'set_meta',
      appId: 'a2',
      envKey: 'dev',
      fieldKey: 'cluster',
      value: '  ocp-1 ',
    });
    expect(set.nextState.apps[1]?.envs.dev?.meta).toEqual({ cluster: 'ocp-1' });

    const cleared = run(set.nextState, {
      type: 'set_meta',
      appId: 'a2',
      envKey: 'dev',
      fieldKey: 'cluster',
      value: '',
    });
    expect(cleared.nextState.apps[1]?.envs.dev?.meta).toEqual({});
    for (const command of /** @type {AppCommand[]} */ ([
      { type: 'set_meta', appId: 'a2', envKey: 'nope', fieldKey: 'cluster', value: 'x' },
      { type: 'set_meta', appId: 'a2', envKey: 'dev', fieldKey: 'nope', value: 'x' },
      { type: 'set_meta', appId: 'nope', envKey: 'dev', fieldKey: 'cluster', value: 'x' },
      { type: 'set_meta', appId: 'a1', envKey: 'dev', fieldKey: 'cluster', value: 'c-dev' },
    ])) {
      expect(run(state, command).nextState).toBe(state);
    }
  });

  test('an override must be an http or https address, and an empty one removes it', () => {
    const state = base();
    const set = run(state, {
      type: 'set_override',
      appId: 'a2',
      envKey: 'prod',
      linkId: 't1-git',
      url: 'git.example.invalid/two',
    });
    expect(set.nextState.apps[1]?.envs.prod?.overrides).toEqual({
      't1-git': 'https://git.example.invalid/two',
    });

    const removed = run(set.nextState, {
      type: 'set_override',
      appId: 'a2',
      envKey: 'prod',
      linkId: 't1-git',
      url: ' ',
    });
    expect(removed.nextState.apps[1]?.envs.prod?.overrides).toEqual({});
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
      expect(
        run(state, { type: 'set_override', appId: 'a2', envKey: 'prod', linkId: 't1-git', url })
          .nextState,
      ).toBe(state);
    }
    expect(
      run(state, {
        type: 'set_override',
        appId: 'a2',
        envKey: 'prod',
        linkId: 'nope',
        url: 'https://x.example',
      }).nextState,
    ).toBe(state);
  });

  test('extra links: http or https only, then change and delete', () => {
    let state = base();
    state = run(state, {
      type: 'add_extra',
      appId: 'a1',
      id: 'x1',
      name: ' Wiki ',
      url: 'wiki.example.invalid',
      tag: 'docs',
    }).nextState;
    expect(state.apps[0]?.extras).toEqual([
      { id: 'x1', name: 'Wiki', url: 'https://wiki.example.invalid', tag: 'docs' },
    ]);

    for (const url of ['javascript:alert(1)', '', 'ftp://x.example']) {
      expect(
        run(state, { type: 'add_extra', appId: 'a1', id: 'bad', name: 'x', url, tag: '' })
          .nextState,
      ).toBe(state);
      expect(run(state, { type: 'update_extra', appId: 'a1', id: 'x1', url }).nextState).toBe(
        state,
      );
    }
    expect(
      run(state, {
        type: 'add_extra',
        appId: 'a1',
        id: 'x1',
        name: 'dup',
        url: 'https://y.example',
        tag: '',
      }).nextState,
    ).toBe(state);

    state = run(state, {
      type: 'update_extra',
      appId: 'a1',
      id: 'x1',
      name: 'Docs',
      url: 'https://docs.example.invalid',
      tag: '',
    }).nextState;
    expect(state.apps[0]?.extras[0]).toMatchObject({
      name: 'Docs',
      url: 'https://docs.example.invalid',
      tag: '',
    });
    state = run(state, { type: 'delete_extra', appId: 'a1', id: 'x1' }).nextState;
    expect(state.apps[0]?.extras).toEqual([]);
  });
});

describe('merge', () => {
  const incoming = {
    settings: settings({
      dashboardName: 'Theirs',
      tags: [
        { key: 'cicd', label: 'THEIR ci', icon: 'tag' },
        { key: 'new', label: 'New', icon: 'tag' },
      ],
    }),
    templates: [
      { ...t1, name: 'Theirs' },
      template({ id: 't9', envs: [{ key: 'qa', label: 'QA' }] }),
    ].map((t, position) => ({ ...t, position })),
    apps: [
      { ...a1, name: 'Theirs' },
      app({ id: 'a9', templateId: 't9', envs: {} }),
      app({ id: 'a8', templateId: 't1', envs: {} }),
    ].map((a, position) => ({ ...a, position })),
  };

  test('adds what the workspace lacks and keeps what it has', () => {
    const state = base();
    const result = run(state, { type: 'merge_data', data: incoming });

    expect(result.nextState.settings.dashboardName).toBe(state.settings.dashboardName);
    expect(result.nextState.settings.tags.map((t) => [t.key, t.label])).toEqual([
      ['cicd', 'CI / CD'],
      ['app', 'Application'],
      ['new', 'New'],
    ]);
    expect(result.nextState.templates.map((t) => [t.id, t.name, t.position])).toEqual([
      ['t1', 'Template t1', 0],
      ['t9', 'Template t9', 1],
    ]);
    expect(result.nextState.apps.map((a) => [a.id, a.name, a.position])).toEqual([
      ['a1', 'App a1', 0],
      ['a2', 'App a2', 1],
      ['a9', 'App a9', 2],
      ['a8', 'App a8', 3],
    ]);
    // The new applications get a record for each environment of their template.
    expect(Object.keys(result.nextState.apps[2]?.envs ?? {})).toEqual(['qa']);
    expect(Object.keys(result.nextState.apps[3]?.envs ?? {})).toEqual(['dev', 'prod']);
    expect(types(result)).toEqual([
      'persist_settings',
      'persist_template',
      'persist_app',
      'persist_app',
    ]);
  });

  test('merging what is already there changes nothing', () => {
    const state = base();
    const again = run(state, {
      type: 'merge_data',
      data: { settings: state.settings, templates: state.templates, apps: state.apps },
    });

    expect(again.nextState).toBe(state);
  });
});

describe('effects', () => {
  test('the difference between two states, removals first, then settings, templates, applications', () => {
    const before = base();
    const after = run(
      run(run(before, { type: 'delete_app', id: 'a2' }).nextState, {
        type: 'update_settings',
        dashboardName: 'x',
      }).nextState,
      { type: 'update_template', id: 't1', name: 'y' },
    ).nextState;

    expect(diffEffects(before, after).map((e) => e.type)).toEqual([
      'remove_app',
      'persist_settings',
      'persist_template',
    ]);
    expect(diffEffects(before, before)).toEqual([]);
  });
});
