// Small builders for the tests: templates, applications, settings and states, with the position
// the core keeps.

/** @import { App, AppState, Settings, Template } from '../../../src/types.d.ts' */

import { createInitialState, reduce } from '../../../src/core/store.js';

/**
 * @param {Partial<Template> & { id: string }} fields
 * @returns {Template}
 */
export function template(fields) {
  return {
    name: `Template ${fields.id}`,
    description: '',
    envs: [
      { key: 'dev', label: 'DEV' },
      { key: 'prod', label: 'PROD' },
    ],
    metaFields: [{ key: 'cluster', label: 'Cluster', type: 'mono', options: [] }],
    links: [
      {
        id: `${fields.id}-git`,
        name: 'Git',
        tag: 'cicd',
        scope: 'global',
        pattern: 'https://git.example.invalid/{slug}',
      },
      {
        id: `${fields.id}-app`,
        name: 'App',
        tag: 'app',
        scope: 'env',
        pattern: 'https://{slug}-{env}.example.invalid/{meta.cluster}',
      },
    ],
    position: 0,
    ...fields,
  };
}

/**
 * @param {Partial<App> & { id: string, templateId: string }} fields
 * @returns {App}
 */
export function app(fields) {
  return {
    name: `App ${fields.id}`,
    slug: fields.id,
    jiraKey: '',
    description: '',
    envs: {
      dev: { meta: {}, overrides: {} },
      prod: { meta: {}, overrides: {} },
    },
    extras: [],
    position: 0,
    ...fields,
  };
}

/** @param {Partial<Settings>} [fields] @returns {Settings} */
export function settings(fields = {}) {
  return {
    dashboardName: '',
    defaultAppId: null,
    defaultEnv: 'last',
    tags: [
      { key: 'cicd', label: 'CI / CD', icon: 'git-branch' },
      { key: 'app', label: 'Application', icon: 'browser' },
    ],
    ...fields,
  };
}

/**
 * A state holding the given templates and applications (positions renumbered).
 * @param {{ templates?: Template[], apps?: App[], settings?: Settings, readOnly?: boolean }} [data]
 * @returns {AppState}
 */
export function stateWith({
  templates = [],
  apps = [],
  settings: s = settings(),
  readOnly = false,
} = {}) {
  return reduce(createInitialState(), {
    type: 'hydrate',
    payload: {
      settings: s,
      templates: templates.map((t, position) => ({ ...t, position })),
      apps: apps.map((a, position) => ({ ...a, position })),
      readOnly,
    },
  }).nextState;
}
