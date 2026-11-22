/** @import { App, AppCommand, AppState, EnvData, Settings, StoreEffect, Template } from '../types.d.ts' */

// The state machine (decision 0004): `reduce(state, command)` returns the next state and the
// effects the adapter has to persist. Nothing here reads a clock, makes an id, touches the DOM
// or the storage: a command carries its ids.
//
// - View commands (`hydrate`, `reload_data`, `set_read_only`, `set_search`, `set_edit_mode`) work
//   in every tab.
// - Data commands change the settings, the templates or the applications. In a read-only tab
//   they are refused: the state is returned as it was, with no effect. `isDataCommand` tells the
//   adapter which commands to announce as refused.
// - A command that cannot apply (unknown id, blank name, unsafe address, nothing changed, a
//   template still in use) returns the same state object and no effect, so callers can compare
//   references.
// - The effects of a data command are the difference between the two states, record by record
//   (`diffEffects`): a reorder persists the records whose `position` changed and nothing else.
// - Renaming the key of an environment or of a metadata field, and removing one, carry the data
//   of the applications along (their values and overrides), in the same command.

import {
  MAX_PATTERN_LENGTH,
  MAX_VALUE_LENGTH,
  META_FIELD_TYPES,
  DEFAULT_ENVS,
  RESERVED_KEYS,
  cleanData,
  cleanText,
  emptyData,
  emptyEnvData,
  normalizeDescription,
  normalizeIcon,
  normalizeLabel,
  normalizeMetaKey,
  normalizeName,
  renumber,
  sanitizeApp,
  sanitizeOptions,
  sanitizeTemplate,
  shiftAt,
  slugify,
} from './model.js';
import { parseUrl } from './url.js';

/** @type {ReadonlySet<AppCommand['type']>} */
const VIEW_COMMANDS = new Set([
  'hydrate',
  'reload_data',
  'set_read_only',
  'set_search',
  'set_edit_mode',
]);

/**
 * Whether a command changes the data of the workspace (and so needs the write lock).
 * @param {AppCommand['type']} type
 * @returns {boolean}
 */
export function isDataCommand(type) {
  return !VIEW_COMMANDS.has(type);
}

/** @returns {AppState} */
export function createInitialState() {
  return { schemaVersion: 1, readOnly: false, ...emptyData(), search: '', editMode: false };
}

/** @param {AppState} state */
const unchanged = (state) => ({ nextState: state, effects: /** @type {StoreEffect[]} */ ([]) });

/**
 * The records that differ between two states: removals first, then the writes, settings before
 * templates before applications.
 * @param {AppState} prev
 * @param {AppState} next
 * @returns {StoreEffect[]}
 */
export function diffEffects(prev, next) {
  /** @type {StoreEffect[]} */
  const effects = [];
  const templateIds = new Set(next.templates.map((t) => t.id));
  const appIds = new Set(next.apps.map((a) => a.id));
  for (const template of prev.templates) {
    if (!templateIds.has(template.id)) effects.push({ type: 'remove_template', id: template.id });
  }
  for (const app of prev.apps) {
    if (!appIds.has(app.id)) effects.push({ type: 'remove_app', id: app.id });
  }
  if (prev.settings !== next.settings) {
    effects.push({ type: 'persist_settings', settings: next.settings });
  }
  const templatesBefore = new Map(prev.templates.map((t) => [t.id, t]));
  for (const template of next.templates) {
    if (templatesBefore.get(template.id) !== template) {
      effects.push({ type: 'persist_template', template });
    }
  }
  const appsBefore = new Map(prev.apps.map((a) => [a.id, a]));
  for (const app of next.apps) {
    if (appsBefore.get(app.id) !== app) effects.push({ type: 'persist_app', app });
  }
  return effects;
}

/* ------------------------------------------------------------------ */
/* Small helpers on the state */

/**
 * @param {AppState} state
 * @param {string} id
 * @returns {Template | undefined}
 */
const templateById = (state, id) => state.templates.find((t) => t.id === id);

/**
 * Replaces a template and, when `mapApp` is given, the applications that use it. The same state
 * when nothing changed.
 * @param {AppState} state
 * @param {string} templateId
 * @param {(template: Template) => Template} change
 * @param {((app: App, before: Template, after: Template) => App) | null} [mapApp]
 * @returns {AppState}
 */
function withTemplate(state, templateId, change, mapApp = null) {
  const before = templateById(state, templateId);
  if (!before) return state;
  const after = change(before);
  if (after === before) return state;
  let apps = state.apps;
  if (mapApp) {
    const mapped = state.apps.map((app) =>
      app.templateId === templateId ? mapApp(app, before, after) : app,
    );
    // The same array when no application changed, so a view can compare by reference.
    if (mapped.some((app, index) => app !== state.apps[index])) apps = mapped;
  }
  return { ...state, templates: state.templates.map((t) => (t === before ? after : t)), apps };
}

/**
 * Replaces one application. The same state when nothing changed.
 * @param {AppState} state
 * @param {string} appId
 * @param {(app: App) => App} change
 * @returns {AppState}
 */
function withApp(state, appId, change) {
  const before = state.apps.find((a) => a.id === appId);
  if (!before) return state;
  const after = change(before);
  if (after === before) return state;
  return { ...state, apps: state.apps.map((a) => (a === before ? after : a)) };
}

/**
 * An application with the data of every environment of its template: an environment it has no
 * data for gets an empty record.
 * @param {Omit<App, 'position'> & { position?: number }} app
 * @param {Template | undefined} template
 * @returns {Omit<App, 'position'> & { position?: number }}
 */
function withEnvRecords(app, template) {
  if (!template) return app;
  const missing = template.envs.filter((env) => !(env.key in app.envs));
  if (missing.length === 0) return app;
  /** @type {Record<string, EnvData>} */
  const envs = { ...app.envs };
  for (const env of missing) envs[env.key] = emptyEnvData();
  return { ...app, envs };
}

/**
 * The data of one environment of an application, changed.
 * @param {App} app
 * @param {string} envKey
 * @param {(env: EnvData) => EnvData} change
 * @returns {App}
 */
function changeEnv(app, envKey, change) {
  const before = app.envs[envKey] ?? emptyEnvData();
  const after = change(before);
  if (after === before && envKey in app.envs) return app;
  return { ...app, envs: { ...app.envs, [envKey]: after } };
}

/**
 * An object without one key.
 * @template T
 * @param {Readonly<Record<string, T>>} record
 * @param {string} key
 * @returns {Record<string, T>}
 */
function without(record, key) {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

/** @param {unknown} value @returns {value is string} */
const isText = (value) => typeof value === 'string';

/* ------------------------------------------------------------------ */
/* The data commands */

/**
 * The next state of a data command, before its effects are worked out.
 * @param {AppState} state
 * @param {AppCommand} command
 * @returns {AppState}
 */
function applyData(state, command) {
  switch (command.type) {
    /* ---- settings ---- */
    case 'update_settings': {
      const { settings } = state;
      /** @type {Settings} */
      const next = {
        ...settings,
        dashboardName:
          command.dashboardName === undefined
            ? settings.dashboardName
            : normalizeLabel(command.dashboardName),
        defaultAppId:
          command.defaultAppId === undefined
            ? settings.defaultAppId
            : command.defaultAppId !== null && state.apps.some((a) => a.id === command.defaultAppId)
              ? command.defaultAppId
              : null,
        defaultEnv:
          command.defaultEnv !== undefined && DEFAULT_ENVS.includes(command.defaultEnv)
            ? command.defaultEnv
            : settings.defaultEnv,
      };
      const same =
        next.dashboardName === settings.dashboardName &&
        next.defaultAppId === settings.defaultAppId &&
        next.defaultEnv === settings.defaultEnv;
      return same ? state : { ...state, settings: next };
    }

    /* ---- tags ---- */
    case 'add_tag': {
      const key = slugify(command.key);
      if (key === '' || state.settings.tags.some((tag) => tag.key === key)) return state;
      const tag = {
        key,
        label: normalizeLabel(command.label) || key,
        icon: normalizeIcon(command.icon),
      };
      return { ...state, settings: { ...state.settings, tags: [...state.settings.tags, tag] } };
    }

    case 'update_tag': {
      const tag = state.settings.tags.find((t) => t.key === command.key);
      if (!tag) return state;
      const label = command.label === undefined ? tag.label : normalizeLabel(command.label);
      const icon = command.icon === undefined ? tag.icon : normalizeIcon(command.icon);
      if (label === '' || (label === tag.label && icon === tag.icon)) return state;
      return {
        ...state,
        settings: {
          ...state.settings,
          tags: state.settings.tags.map((t) => (t === tag ? { ...tag, label, icon } : t)),
        },
      };
    }

    case 'rename_tag': {
      const newKey = slugify(command.newKey);
      const tags = state.settings.tags;
      if (
        newKey === '' ||
        newKey === command.key ||
        !tags.some((t) => t.key === command.key) ||
        tags.some((t) => t.key === newKey)
      ) {
        return state;
      }
      const remap = (/** @type {string} */ key) => (key === command.key ? newKey : key);
      return {
        ...state,
        settings: {
          ...state.settings,
          tags: tags.map((t) => (t.key === command.key ? { ...t, key: newKey } : t)),
        },
        // The links keep the tag they had: they follow the new key.
        templates: state.templates.map((template) =>
          template.links.some((l) => l.tag === command.key)
            ? { ...template, links: template.links.map((l) => ({ ...l, tag: remap(l.tag) })) }
            : template,
        ),
        apps: state.apps.map((app) =>
          app.extras.some((x) => x.tag === command.key)
            ? { ...app, extras: app.extras.map((x) => ({ ...x, tag: remap(x.tag) })) }
            : app,
        ),
      };
    }

    case 'delete_tag': {
      const tags = state.settings.tags;
      if (!tags.some((t) => t.key === command.key)) return state;
      return {
        ...state,
        settings: { ...state.settings, tags: tags.filter((t) => t.key !== command.key) },
      };
    }

    case 'shift_tag': {
      const tags = state.settings.tags;
      const next = shiftAt(
        tags,
        tags.findIndex((t) => t.key === command.key),
        command.delta,
      );
      return next === tags ? state : { ...state, settings: { ...state.settings, tags: [...next] } };
    }

    /* ---- templates ---- */
    case 'add_template': {
      const template = sanitizeTemplate(command.template);
      if (!template || state.templates.some((t) => t.id === template.id)) return state;
      return {
        ...state,
        templates: [...state.templates, { ...template, position: state.templates.length }],
      };
    }

    case 'update_template':
      return withTemplate(state, command.id, (template) => {
        const name = command.name === undefined ? template.name : normalizeName(command.name);
        const description =
          command.description === undefined
            ? template.description
            : normalizeDescription(command.description);
        if (name === '' || (name === template.name && description === template.description)) {
          return template;
        }
        return { ...template, name, description };
      });

    case 'delete_template': {
      if (!templateById(state, command.id)) return state;
      if (state.apps.some((app) => app.templateId === command.id)) return state;
      return {
        ...state,
        templates: renumber(state.templates.filter((t) => t.id !== command.id)),
      };
    }

    /* ---- environments of a template ---- */
    case 'add_env': {
      const key = slugify(command.key);
      return withTemplate(
        state,
        command.templateId,
        (template) =>
          key === '' || template.envs.some((e) => e.key === key)
            ? template
            : {
                ...template,
                envs: [
                  ...template.envs,
                  { key, label: normalizeLabel(command.label) || key.toUpperCase() },
                ],
              },
        (app) => (key in app.envs ? app : { ...app, envs: { ...app.envs, [key]: emptyEnvData() } }),
      );
    }

    case 'update_env': {
      const newKey = command.newKey === undefined ? command.key : slugify(command.newKey);
      return withTemplate(
        state,
        command.templateId,
        (template) => {
          const env = template.envs.find((e) => e.key === command.key);
          if (!env || newKey === '') return template;
          if (newKey !== env.key && template.envs.some((e) => e.key === newKey)) return template;
          const label = command.label === undefined ? env.label : normalizeLabel(command.label);
          if (label === '' || (label === env.label && newKey === env.key)) return template;
          return {
            ...template,
            envs: template.envs.map((e) => (e === env ? { key: newKey, label } : e)),
          };
        },
        (app) => {
          if (newKey === command.key || !(command.key in app.envs)) return app;
          const moved = app.envs[command.key];
          return {
            ...app,
            envs: { ...without(app.envs, command.key), [newKey]: moved ?? emptyEnvData() },
          };
        },
      );
    }

    case 'delete_env':
      return withTemplate(
        state,
        command.templateId,
        (template) =>
          template.envs.length <= 1 || !template.envs.some((e) => e.key === command.key)
            ? template
            : { ...template, envs: template.envs.filter((e) => e.key !== command.key) },
        (app) => (command.key in app.envs ? { ...app, envs: without(app.envs, command.key) } : app),
      );

    case 'shift_env':
      return withTemplate(state, command.templateId, (template) => {
        const envs = shiftAt(
          template.envs,
          template.envs.findIndex((e) => e.key === command.key),
          command.delta,
        );
        return envs === template.envs ? template : { ...template, envs };
      });

    /* ---- metadata fields of a template ---- */
    case 'add_meta_field': {
      const key = normalizeMetaKey(command.key);
      return withTemplate(state, command.templateId, (template) => {
        if (key === '' || RESERVED_KEYS.includes(key)) return template;
        if (template.metaFields.some((f) => f.key === key)) return template;
        const type = META_FIELD_TYPES.includes(command.fieldType ?? 'text')
          ? (command.fieldType ?? 'text')
          : 'text';
        return {
          ...template,
          metaFields: [
            ...template.metaFields,
            { key, label: normalizeLabel(command.label) || key, type, options: [] },
          ],
        };
      });
    }

    case 'update_meta_field': {
      const newKey = command.newKey === undefined ? command.key : normalizeMetaKey(command.newKey);
      return withTemplate(
        state,
        command.templateId,
        (template) => {
          const field = template.metaFields.find((f) => f.key === command.key);
          if (!field || newKey === '') return template;
          if (newKey !== field.key) {
            if (RESERVED_KEYS.includes(newKey)) return template;
            if (template.metaFields.some((f) => f.key === newKey)) return template;
          }
          const label = command.label === undefined ? field.label : normalizeLabel(command.label);
          const type =
            command.fieldType !== undefined && META_FIELD_TYPES.includes(command.fieldType)
              ? command.fieldType
              : field.type;
          const options =
            type !== 'select'
              ? []
              : command.options === undefined
                ? field.options
                : sanitizeOptions(command.options);
          const same =
            label === field.label &&
            type === field.type &&
            newKey === field.key &&
            options.length === field.options.length &&
            options.every((option, i) => option === field.options[i]);
          if (label === '' || same) return template;
          return {
            ...template,
            metaFields: template.metaFields.map((f) =>
              f === field ? { key: newKey, label, type, options } : f,
            ),
          };
        },
        (app) => {
          if (newKey === command.key) return app;
          // The values typed under the old key follow the new one.
          /** @type {Record<string, EnvData>} */
          const envs = {};
          let touched = false;
          for (const [envKey, env] of Object.entries(app.envs)) {
            const value = env.meta[command.key];
            if (value === undefined) {
              envs[envKey] = env;
              continue;
            }
            touched = true;
            envs[envKey] = { ...env, meta: { ...without(env.meta, command.key), [newKey]: value } };
          }
          return touched ? { ...app, envs } : app;
        },
      );
    }

    case 'delete_meta_field':
      return withTemplate(
        state,
        command.templateId,
        (template) =>
          template.metaFields.some((f) => f.key === command.key)
            ? { ...template, metaFields: template.metaFields.filter((f) => f.key !== command.key) }
            : template,
        (app) => {
          /** @type {Record<string, EnvData>} */
          const envs = {};
          let touched = false;
          for (const [envKey, env] of Object.entries(app.envs)) {
            if (command.key in env.meta) {
              touched = true;
              envs[envKey] = { ...env, meta: without(env.meta, command.key) };
            } else {
              envs[envKey] = env;
            }
          }
          return touched ? { ...app, envs } : app;
        },
      );

    case 'shift_meta_field':
      return withTemplate(state, command.templateId, (template) => {
        const metaFields = shiftAt(
          template.metaFields,
          template.metaFields.findIndex((f) => f.key === command.key),
          command.delta,
        );
        return metaFields === template.metaFields ? template : { ...template, metaFields };
      });

    /* ---- links of a template ---- */
    case 'add_template_link':
      return withTemplate(state, command.templateId, (template) => {
        if (command.id === '' || template.links.some((l) => l.id === command.id)) return template;
        return {
          ...template,
          links: [
            ...template.links,
            {
              id: command.id,
              name: normalizeName(command.name) || command.id,
              tag: isText(command.tag) ? command.tag.trim() : '',
              scope: command.scope === 'global' ? 'global' : 'env',
              pattern: isText(command.pattern)
                ? command.pattern.trim().slice(0, MAX_PATTERN_LENGTH)
                : '',
            },
          ],
        };
      });

    case 'update_template_link':
      return withTemplate(state, command.templateId, (template) => {
        const link = template.links.find((l) => l.id === command.id);
        if (!link) return template;
        const name = command.name === undefined ? link.name : normalizeName(command.name);
        const tag = command.tag === undefined ? link.tag : command.tag.trim();
        const scope =
          command.scope === undefined ? link.scope : command.scope === 'global' ? 'global' : 'env';
        const pattern =
          command.pattern === undefined
            ? link.pattern
            : command.pattern.trim().slice(0, MAX_PATTERN_LENGTH);
        if (
          name === '' ||
          (name === link.name &&
            tag === link.tag &&
            scope === link.scope &&
            pattern === link.pattern)
        ) {
          return template;
        }
        return {
          ...template,
          links: template.links.map((l) =>
            l === link ? { ...link, name, tag, scope, pattern } : l,
          ),
        };
      });

    case 'delete_template_link':
      return withTemplate(
        state,
        command.templateId,
        (template) =>
          template.links.some((l) => l.id === command.id)
            ? { ...template, links: template.links.filter((l) => l.id !== command.id) }
            : template,
        (app) => {
          /** @type {Record<string, EnvData>} */
          const envs = {};
          let touched = false;
          for (const [envKey, env] of Object.entries(app.envs)) {
            if (command.id in env.overrides) {
              touched = true;
              envs[envKey] = { ...env, overrides: without(env.overrides, command.id) };
            } else {
              envs[envKey] = env;
            }
          }
          return touched ? { ...app, envs } : app;
        },
      );

    case 'shift_template_link':
      return withTemplate(state, command.templateId, (template) => {
        const links = shiftAt(
          template.links,
          template.links.findIndex((l) => l.id === command.id),
          command.delta,
        );
        return links === template.links ? template : { ...template, links };
      });

    /* ---- applications ---- */
    case 'add_app': {
      const result = sanitizeApp(command.app);
      if (!result) return state;
      const { app } = result;
      const template = templateById(state, app.templateId);
      if (
        !template ||
        app.slug === '' ||
        state.apps.some((a) => a.id === app.id || a.slug === app.slug)
      ) {
        return state;
      }
      const filled = withEnvRecords(app, template);
      return {
        ...state,
        apps: [...state.apps, /** @type {App} */ ({ ...filled, position: state.apps.length })],
      };
    }

    case 'update_app':
      return withApp(state, command.id, (app) => {
        const name = command.name === undefined ? app.name : normalizeName(command.name);
        const slug = command.slug === undefined ? app.slug : slugify(command.slug);
        const jiraKey =
          command.jiraKey === undefined ? app.jiraKey : cleanText(command.jiraKey, 80);
        const description =
          command.description === undefined
            ? app.description
            : normalizeDescription(command.description);
        if (name === '' || slug === '') return app;
        if (slug !== app.slug && state.apps.some((a) => a.slug === slug && a.id !== app.id)) {
          return app;
        }
        if (
          name === app.name &&
          slug === app.slug &&
          jiraKey === app.jiraKey &&
          description === app.description
        ) {
          return app;
        }
        return { ...app, name, slug, jiraKey, description };
      });

    case 'delete_app': {
      if (!state.apps.some((a) => a.id === command.id)) return state;
      return {
        ...state,
        settings:
          state.settings.defaultAppId === command.id
            ? { ...state.settings, defaultAppId: null }
            : state.settings,
        apps: renumber(state.apps.filter((a) => a.id !== command.id)),
      };
    }

    case 'set_meta': {
      const app = state.apps.find((a) => a.id === command.appId);
      const template = app ? templateById(state, app.templateId) : undefined;
      if (
        !template ||
        !template.envs.some((e) => e.key === command.envKey) ||
        !template.metaFields.some((f) => f.key === command.fieldKey)
      ) {
        return state;
      }
      const value = cleanText(command.value, MAX_VALUE_LENGTH);
      return withApp(state, command.appId, (current) =>
        changeEnv(current, command.envKey, (env) => {
          if ((env.meta[command.fieldKey] ?? '') === value) return env;
          return {
            ...env,
            meta:
              value === ''
                ? without(env.meta, command.fieldKey)
                : { ...env.meta, [command.fieldKey]: value },
          };
        }),
      );
    }

    case 'set_override': {
      const app = state.apps.find((a) => a.id === command.appId);
      const template = app ? templateById(state, app.templateId) : undefined;
      if (
        !template ||
        !template.envs.some((e) => e.key === command.envKey) ||
        !template.links.some((l) => l.id === command.linkId)
      ) {
        return state;
      }
      const text = command.url.trim();
      /** @type {string | null} */
      let url = null;
      if (text !== '') {
        const parsed = parseUrl(text);
        if (!parsed.ok) return state;
        url = parsed.url;
      }
      return withApp(state, command.appId, (current) =>
        changeEnv(current, command.envKey, (env) => {
          if ((env.overrides[command.linkId] ?? null) === url) return env;
          return {
            ...env,
            overrides:
              url === null
                ? without(env.overrides, command.linkId)
                : { ...env.overrides, [command.linkId]: url },
          };
        }),
      );
    }

    case 'add_extra': {
      const parsed = parseUrl(command.url);
      if (!parsed.ok || command.id === '') return state;
      return withApp(state, command.appId, (app) =>
        app.extras.some((x) => x.id === command.id)
          ? app
          : {
              ...app,
              extras: [
                ...app.extras,
                {
                  id: command.id,
                  name: normalizeName(command.name) || parsed.url,
                  url: parsed.url,
                  tag: isText(command.tag) ? command.tag.trim() : '',
                },
              ],
            },
      );
    }

    case 'update_extra':
      return withApp(state, command.appId, (app) => {
        const extra = app.extras.find((x) => x.id === command.id);
        if (!extra) return app;
        let { url } = extra;
        if (command.url !== undefined) {
          const parsed = parseUrl(command.url);
          if (!parsed.ok) return app;
          url = parsed.url;
        }
        const name = command.name === undefined ? extra.name : normalizeName(command.name);
        const tag = command.tag === undefined ? extra.tag : command.tag.trim();
        if (name === '' || (name === extra.name && url === extra.url && tag === extra.tag)) {
          return app;
        }
        return {
          ...app,
          extras: app.extras.map((x) => (x === extra ? { ...extra, name, url, tag } : x)),
        };
      });

    case 'delete_extra':
      return withApp(state, command.appId, (app) =>
        app.extras.some((x) => x.id === command.id)
          ? { ...app, extras: app.extras.filter((x) => x.id !== command.id) }
          : app,
      );

    /* ---- merge: what the workspace lacks is added, what it has is kept ---- */
    case 'merge_data': {
      const { data } = command;
      const tags = data.settings.tags.filter(
        (tag) => !state.settings.tags.some((own) => own.key === tag.key),
      );
      const templates = data.templates.filter(
        (template) => !state.templates.some((own) => own.id === template.id),
      );
      const templatesAfter = [...state.templates, ...templates];
      const apps = data.apps.filter((app) => !state.apps.some((own) => own.id === app.id));
      if (tags.length === 0 && templates.length === 0 && apps.length === 0) return state;
      return {
        ...state,
        settings:
          tags.length === 0
            ? state.settings
            : { ...state.settings, tags: [...state.settings.tags, ...tags] },
        templates: renumber([...state.templates, ...templates]),
        apps: renumber([
          ...state.apps,
          ...apps.map(
            (app) =>
              /** @type {App} */ (
                withEnvRecords(
                  app,
                  templatesAfter.find((t) => t.id === app.templateId),
                )
              ),
          ),
        ]),
      };
    }

    default:
      return state;
  }
}

/**
 * @param {AppState} state
 * @param {AppCommand} command
 * @returns {{ nextState: AppState, effects: StoreEffect[] }}
 */
export function reduce(state, command) {
  switch (command.type) {
    case 'hydrate': {
      const { readOnly = false, ...data } = command.payload;
      const { data: clean } = cleanData(data, { sorted: true });
      return { nextState: { ...state, ...clean, readOnly }, effects: [] };
    }

    case 'reload_data': {
      const { data: clean } = cleanData(command.payload, { sorted: true });
      return { nextState: { ...state, ...clean }, effects: [] };
    }

    case 'set_read_only':
      return state.readOnly === command.readOnly
        ? unchanged(state)
        : { nextState: { ...state, readOnly: command.readOnly }, effects: [] };

    case 'set_search':
      return state.search === command.query
        ? unchanged(state)
        : { nextState: { ...state, search: command.query }, effects: [] };

    case 'set_edit_mode':
      return state.editMode === command.editMode
        ? unchanged(state)
        : { nextState: { ...state, editMode: command.editMode }, effects: [] };

    default: {
      if (state.readOnly) return unchanged(state);
      const nextState = applyData(state, command);
      if (nextState === state) return unchanged(state);
      return { nextState, effects: diffEffects(state, nextState) };
    }
  }
}

/**
 * A small observable around `reduce`.
 * @param {AppState} [initialState]
 */
export function createStore(initialState = createInitialState()) {
  let state = initialState;
  /** @type {Set<(info: { state: AppState, prevState: AppState, command: AppCommand, effects: StoreEffect[] }) => void>} */
  const listeners = new Set();
  return {
    getState: () => state,
    /**
     * @param {AppCommand} command
     * @returns {{ state: AppState, effects: StoreEffect[] }}
     */
    dispatch(command) {
      const prevState = state;
      const { nextState, effects } = reduce(prevState, command);
      state = nextState;
      if (nextState !== prevState) {
        for (const listener of listeners) listener({ state, prevState, command, effects });
      }
      return { state, effects };
    },
    /**
     * @param {(info: { state: AppState, prevState: AppState, command: AppCommand, effects: StoreEffect[] }) => void} listener
     * @returns {() => void}
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
