/** @import { App, AppCommand, AppState, Template } from '../types.d.ts' */

// Builds the commands that need an id from the adapter's side, so that a view only says what the
// user asked for.

import { emptyEnvData } from '../core/model.js';
import { availableSlug } from '../core/selectors.js';
import { newId } from './ids.js';

/**
 * A new application on a template: an empty record for each environment of the template.
 * @param {Template} template
 * @param {{ name: string, slug: string, jiraKey: string }} input
 * @returns {Extract<AppCommand, { type: 'add_app' }>}
 */
export function addAppCommand(template, { name, slug, jiraKey }) {
  return {
    type: 'add_app',
    app: {
      id: newId(),
      name,
      slug,
      templateId: template.id,
      jiraKey,
      description: '',
      envs: Object.fromEntries(template.envs.map((env) => [env.key, emptyEnvData()])),
      extras: [],
    },
  };
}

/**
 * A copy of an application under a new name, with a free slug and its own extra links.
 * @param {AppState} state
 * @param {App} app
 * @param {string} name the name of the copy
 * @returns {Extract<AppCommand, { type: 'add_app' }>}
 */
export function duplicateAppCommand(state, app, name) {
  const { position: _position, ...rest } = app;
  return {
    type: 'add_app',
    app: {
      ...rest,
      id: newId(),
      name,
      slug: availableSlug(state, `${app.slug}-copy`),
      extras: app.extras.map((extra) => ({ ...extra, id: newId() })),
    },
  };
}

/**
 * A new template: two environments and an `owner` field, ready to be filled in.
 * @param {{ name: string, ownerLabel: string }} input
 * @returns {Extract<AppCommand, { type: 'add_template' }>}
 */
export function addTemplateCommand({ name, ownerLabel }) {
  return {
    type: 'add_template',
    template: {
      id: newId(),
      name,
      description: '',
      envs: [
        { key: 'dev', label: 'DEV' },
        { key: 'prod', label: 'PROD' },
      ],
      metaFields: [{ key: 'owner', label: ownerLabel, type: 'text', options: [] }],
      links: [],
    },
  };
}

/**
 * A copy of a template under a new name; its links get new ids (the overrides of the
 * applications are by link id, and stay with the original).
 * @param {Template} template
 * @param {string} name
 * @returns {Extract<AppCommand, { type: 'add_template' }>}
 */
export function duplicateTemplateCommand(template, name) {
  const { position: _position, ...rest } = template;
  return {
    type: 'add_template',
    template: {
      ...rest,
      id: newId(),
      name,
      links: template.links.map((link) => ({ ...link, id: newId() })),
    },
  };
}

/**
 * A new link of a template.
 * @param {string} templateId
 * @param {{ name: string, tag: string, pattern: string }} input
 * @returns {Extract<AppCommand, { type: 'add_template_link' }>}
 */
export function addTemplateLinkCommand(templateId, { name, tag, pattern }) {
  return { type: 'add_template_link', templateId, id: newId(), name, tag, scope: 'env', pattern };
}

/**
 * A new extra link of an application.
 * @param {string} appId
 * @param {{ name: string, url: string, tag: string }} input
 * @returns {Extract<AppCommand, { type: 'add_extra' }>}
 */
export function addExtraCommand(appId, { name, url, tag }) {
  return { type: 'add_extra', appId, id: newId(), name, url, tag };
}
