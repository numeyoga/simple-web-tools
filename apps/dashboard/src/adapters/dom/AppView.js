// An application: its name and facts, the tabs of the environments of its template, for each
// environment the metadata strip and the links resolved from the patterns of the template (copy,
// open, and in edit mode a different address), then the extra links that belong to no
// environment. In edit mode the facts and the metadata can be changed in place.
//
// Every environment has its own tab panel, all drawn (Covenant's tabs switch them without a
// round trip); the environment that is shown is remembered. The view is drawn again when what it
// shows changes (`createRedraw` keeps the focus).
import { filterExtras, filterResolvedLinks } from '../../core/search.js';
import { activeEnvKey, groupByTag, templateOf } from '../../core/selectors.js';
import { missingByEnv, resolveLinks } from '../../core/links.js';
import { safeHref } from '../../core/url.js';
import { copyText } from '../clipboard.js';
import { duplicateAppCommand } from '../commands.js';
import { readViewMemory, writeViewMemory } from '../view-memory.js';
import { confirmDeleteApp, openExtraForm, openOverrideForm } from './AppDialogs.js';
import { focusKey } from './parts.js';
import { createRedraw } from './redraw.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/**
 * Why an address cannot be opened, for a person.
 * @param {import('../../types.d.ts').ResolvedLink} resolved
 * @returns {string}
 */
function problemText({ problem, missing }) {
  switch (problem) {
    case 'unresolved':
      return t('links.problem.unresolved', { names: missing.join(', ') });
    case 'unsafe':
      return t('links.problem.unsafe');
    case 'invalid':
      return t('links.problem.invalid');
    case 'empty':
      return t('links.problem.empty');
    default:
      return '';
  }
}

/**
 * @param {import('./types.js').Context} ctx
 * @param {string} appId
 * @param {{ sessionEnvs: Map<string, string> }} memory the environments chosen during this visit
 * @returns {import('./types.js').View}
 */
export function createAppView(ctx, appId, { sessionEnvs }) {
  const { store, toasts } = ctx;
  const root = el('div', { class: 'dsh-view' });

  /** The environment shown: set by the tabs, kept across drawings. @type {string | null} */
  let currentEnv = null;

  const app0 = () => store.getState().apps.find((a) => a.id === appId) ?? null;

  /** @param {string} envKey */
  function chooseEnv(envKey) {
    currentEnv = envKey;
    sessionEnvs.set(appId, envKey);
    writeViewMemory(ctx.workspaceId, appId, envKey);
  }

  /* ---------------- the links ---------------- */

  /**
   * @param {import('../../types.d.ts').App} app
   * @param {string} envKey
   * @param {import('../../types.d.ts').ResolvedLink} resolved
   * @param {boolean} editMode
   */
  function linkRow(app, envKey, resolved, editMode) {
    const { link, url, overridden, problem } = resolved;
    const href = problem === null ? safeHref(url) : null;
    const reason = problem === null ? '' : problemText(resolved);
    const actions = el('span', { class: 'dsh-link__actions' });
    if (editMode) {
      actions.append(
        UI.IconButton({
          icon: 'pencil-simple',
          label: t('links.override', { name: link.name }),
          size: 'sm',
          mutates: true,
          onclick: () => openOverrideForm(store, { app, envKey, resolved }),
        }),
      );
      if (overridden) {
        actions.append(
          UI.IconButton({
            icon: 'arrow-counter-clockwise',
            label: t('links.resetOverride', { name: link.name }),
            size: 'sm',
            mutates: true,
            onclick: () =>
              store.dispatch({
                type: 'set_override',
                appId: app.id,
                envKey,
                linkId: link.id,
                url: '',
              }),
          }),
        );
      }
    }
    actions.append(
      UI.IconButton({
        icon: 'copy',
        label: t('links.copy', { name: link.name }),
        size: 'sm',
        disabled: href === null,
        onclick: async () =>
          toasts.push(
            (await copyText(url))
              ? { variant: 'success', title: t('links.copied'), body: link.name }
              : {
                  variant: 'danger',
                  title: t('links.copyFailed'),
                  body: t('links.copyFailedBody'),
                },
          ),
      }),
      href
        ? el(
            'a',
            {
              class: 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm',
              href,
              target: '_blank',
              rel: 'noopener noreferrer',
              'aria-label': t('links.open', { name: link.name }),
              'data-cv-tooltip': t('links.open', { name: link.name }),
            },
            icon('arrow-square-out'),
          )
        : el(
            'span',
            {
              class: 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm dsh-disabled',
              role: 'img',
              'aria-label': t('links.cannotOpen', { name: link.name, reason }),
              'data-cv-tooltip': reason,
            },
            icon('arrow-square-out'),
          ),
    );
    return el(
      'li',
      { class: 'dsh-link', 'data-link-id': link.id },
      el(
        'span',
        { class: 'dsh-link__name' },
        icon('link'),
        el('span', { class: 'dsh-ellipsis' }, link.name),
        overridden ? UI.Tag(t('links.overridden')) : null,
      ),
      el(
        'span',
        { class: `dsh-link__url cv-num dsh-ellipsis${problem === null ? '' : ' dsh-danger-text'}` },
        url === '' ? '–' : url,
      ),
      problem === null ? null : UI.Badge({ variant: 'warning', children: reason }),
      actions,
    );
  }

  /**
   * @param {import('../../types.d.ts').AppState} state
   * @param {import('../../types.d.ts').App} app
   * @param {import('../../types.d.ts').Template} template
   * @param {string} envKey
   */
  function linksCard(state, app, template, envKey) {
    const all = resolveLinks(app, template, envKey);
    const shown = filterResolvedLinks(all, state.settings.tags, state.search);
    const envLabel = template.envs.find((e) => e.key === envKey)?.label ?? envKey;
    const groups = groupByTag(shown, state.settings.tags, (r) => r.link.tag);
    const headingId = UI.fieldId('dsh-links');
    return el(
      'section',
      { class: 'dsh-card', 'aria-labelledby': headingId },
      el(
        'header',
        { class: 'dsh-card__head' },
        el('h3', { class: 'cv-h4', id: headingId }, t('links.title', { env: envLabel })),
        el('span', { class: 'dsh-meta cv-num dsh-end' }, t('links.count', { count: all.length })),
      ),
      groups.length === 0
        ? el(
            'p',
            { class: 'dsh-card__empty dsh-meta' },
            state.search.trim() !== '' ? t('links.noMatch') : t('links.noLinks'),
          )
        : groups.map(({ key, tag, items }) =>
            el(
              'div',
              { class: 'dsh-group', 'data-tag': key },
              el(
                'h4',
                { class: 'dsh-group__title cv-overline' },
                icon(tag?.icon ?? 'tag', { weight: 'bold' }),
                tag?.label ?? (key === '' ? t('tags.none') : t('tags.unknown', { key })),
                el('span', { class: 'dsh-group__count cv-num' }, String(items.length)),
              ),
              el(
                'ul',
                { class: 'dsh-rows' },
                items.map((resolved) => linkRow(app, envKey, resolved, state.editMode)),
              ),
            ),
          ),
    );
  }

  /* ---------------- the metadata of an environment ---------------- */

  /**
   * @param {import('../../types.d.ts').App} app
   * @param {import('../../types.d.ts').Template} template
   * @param {string} envKey
   * @param {boolean} editMode
   */
  function metaStrip(app, template, envKey, editMode) {
    const values = app.envs[envKey]?.meta ?? {};
    if (template.metaFields.length === 0) {
      return el(
        'div',
        { class: 'dsh-block dsh-block--dashed dsh-row dsh-center dsh-gap-3' },
        icon('info'),
        el('span', { class: 'dsh-grow' }, t('meta.none')),
        editMode
          ? el(
              'a',
              {
                class: 'cv-btn cv-btn--ghost cv-btn--sm',
                href: `#/admin/metadata/${encodeURIComponent(template.id)}`,
              },
              t('meta.configure'),
            )
          : null,
      );
    }
    const fields = template.metaFields.map((field) => {
      const value = values[field.key] ?? '';
      if (!editMode) {
        return el(
          'div',
          { class: 'dsh-fact' },
          el('dt', { class: 'cv-overline' }, field.label),
          el('dd', { class: field.type === 'mono' ? 'cv-num' : '' }, value === '' ? '–' : value),
        );
      }
      const key = focusKey('meta', envKey, field.key);
      /** @param {string} next */
      const commit = (next) =>
        store.dispatch({
          type: 'set_meta',
          appId: app.id,
          envKey,
          fieldKey: field.key,
          value: next,
        });
      if (field.type === 'select') {
        const options =
          field.options.includes(value) || value === '' ? field.options : [value, ...field.options];
        const select = UI.Select({
          label: field.label,
          value,
          options: [
            { value: '', label: t('meta.noValue') },
            ...options.map((o) => ({ value: o, label: o })),
          ],
          onchange: commit,
          mutates: true,
        });
        select.input.dataset.focusKey = key;
        return el('div', { class: 'dsh-fact' }, select);
      }
      const input = UI.Input({
        label: field.label,
        value,
        type: field.type === 'date' ? 'date' : 'text',
        mono: field.type === 'mono' || field.type === 'date',
      });
      input.input.dataset.focusKey = key;
      input.input.setAttribute('data-mutates', '');
      input.input.addEventListener('change', () => commit(input.input.value));
      return el('div', { class: 'dsh-fact' }, input);
    });
    return el(
      'div',
      { class: 'dsh-block' },
      editMode
        ? el('div', { class: 'dsh-facts dsh-facts--edit' }, fields)
        : el('dl', { class: 'dsh-facts' }, fields),
      editMode
        ? el(
            'a',
            {
              class: 'cv-btn cv-btn--ghost cv-btn--sm dsh-configure',
              href: `#/admin/metadata/${encodeURIComponent(template.id)}`,
            },
            t('meta.configure'),
          )
        : null,
    );
  }

  /* ---------------- the extra links ---------------- */

  /**
   * @param {import('../../types.d.ts').AppState} state
   * @param {import('../../types.d.ts').App} app
   */
  function extrasCard(state, app) {
    const shown = filterExtras(app.extras, state.settings.tags, state.search);
    const groups = groupByTag(shown, state.settings.tags, (x) => x.tag);
    const headingId = UI.fieldId('dsh-extras');
    return el(
      'section',
      { class: 'dsh-card', 'aria-labelledby': headingId },
      el(
        'header',
        { class: 'dsh-card__head' },
        el('h3', { class: 'cv-h4', id: headingId }, t('extras.title')),
        el('span', { class: 'dsh-meta' }, t('extras.subtitle')),
        el(
          'span',
          { class: 'dsh-end' },
          state.editMode
            ? UI.Button({
                size: 'sm',
                icon: 'plus',
                children: t('extras.add'),
                mutates: true,
                onclick: () => openExtraForm(store, app, null),
              })
            : null,
        ),
      ),
      groups.length === 0
        ? el(
            'p',
            { class: 'dsh-card__empty dsh-meta' },
            state.search.trim() !== '' ? t('extras.noMatch') : t('extras.none'),
          )
        : el(
            'div',
            { class: 'dsh-extra-grid' },
            groups.map(({ key, tag, items }) =>
              el(
                'div',
                { class: 'dsh-group', 'data-tag': key },
                el(
                  'h4',
                  { class: 'dsh-group__title cv-overline' },
                  icon(tag?.icon ?? 'tag', { weight: 'bold' }),
                  tag?.label ?? (key === '' ? t('tags.none') : t('tags.unknown', { key })),
                  el('span', { class: 'dsh-group__count cv-num' }, String(items.length)),
                ),
                el(
                  'ul',
                  { class: 'dsh-rows' },
                  items.map((extra) => {
                    const href = safeHref(extra.url);
                    return el(
                      'li',
                      { class: 'dsh-link', 'data-extra-id': extra.id },
                      el(
                        'span',
                        { class: 'dsh-link__name dsh-grow' },
                        icon('link'),
                        href
                          ? el(
                              'a',
                              {
                                class: 'dsh-ellipsis dsh-plain-link',
                                href,
                                target: '_blank',
                                rel: 'noopener noreferrer',
                                'data-cv-tooltip': extra.url,
                              },
                              extra.name,
                              el('span', { class: 'cv-sr-only' }, ' ', t('links.newTab')),
                            )
                          : el('span', { class: 'dsh-ellipsis' }, extra.name),
                      ),
                      el(
                        'span',
                        { class: 'dsh-link__actions' },
                        state.editMode
                          ? [
                              UI.IconButton({
                                icon: 'pencil-simple',
                                label: t('extras.edit', { name: extra.name }),
                                size: 'sm',
                                mutates: true,
                                onclick: () => openExtraForm(store, app, extra),
                              }),
                              UI.IconButton({
                                icon: 'trash',
                                label: t('extras.delete', { name: extra.name }),
                                size: 'sm',
                                mutates: true,
                                onclick: async () => {
                                  const ok = await UI.Confirm({
                                    title: t('extras.deleteTitle'),
                                    message: t('extras.deleteMessage', { name: extra.name }),
                                    confirmLabel: t('common.delete'),
                                    danger: true,
                                  });
                                  if (ok) {
                                    store.dispatch({
                                      type: 'delete_extra',
                                      appId: app.id,
                                      id: extra.id,
                                    });
                                  }
                                },
                              }),
                            ]
                          : href
                            ? el(
                                'a',
                                {
                                  class: 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm',
                                  href,
                                  target: '_blank',
                                  rel: 'noopener noreferrer',
                                  'aria-label': t('links.open', { name: extra.name }),
                                  'data-cv-tooltip': t('links.open', { name: extra.name }),
                                },
                                icon('arrow-square-out'),
                              )
                            : null,
                      ),
                    );
                  }),
                ),
              ),
            ),
          ),
    );
  }

  /* ---------------- the header ---------------- */

  /**
   * @param {import('../../types.d.ts').AppState} state
   * @param {import('../../types.d.ts').App} app
   * @param {import('../../types.d.ts').Template | null} template
   */
  function header(state, app, template) {
    const editMode = state.editMode;
    const toolbar = el(
      'div',
      { class: 'dsh-row dsh-wrap dsh-gap-2 dsh-end' },
      UI.Button({
        icon: 'pencil-simple',
        children: t('app.edit'),
        mutates: true,
        onclick: () => store.dispatch({ type: 'set_edit_mode', editMode: !editMode }),
      }),
      UI.Button({
        icon: 'copy',
        children: t('app.duplicate'),
        mutates: true,
        onclick: () => {
          const command = duplicateAppCommand(
            store.getState(),
            app,
            t('apps.copyName', { name: app.name }),
          );
          store.dispatch(command);
          ctx.navigate({ screen: 'app', appId: command.app.id });
          toasts.push({ variant: 'success', title: t('apps.duplicated'), body: command.app.name });
        },
      }),
      editMode
        ? UI.Button({
            variant: 'danger',
            icon: 'trash',
            children: t('app.delete'),
            mutates: true,
            onclick: async () => {
              if (await confirmDeleteApp(store, toasts, app))
                ctx.navigate({ screen: 'app', appId: null });
            },
          })
        : null,
    );
    // The "Edit" button is a toggle: `aria-pressed` says whether the edit mode is on.
    const editButton = toolbar.querySelector('button');
    editButton?.setAttribute('aria-pressed', String(editMode));
    editButton?.setAttribute('data-focus-key', 'edit-mode');

    if (!editMode) {
      return el(
        'header',
        { class: 'dsh-header' },
        el(
          'div',
          { class: 'dsh-grow dsh-stack dsh-gap-2' },
          el(
            'div',
            { class: 'dsh-row dsh-wrap dsh-center dsh-gap-4' },
            template ? UI.Tag([icon('stack'), template.name]) : null,
            el(
              'span',
              { class: 'dsh-meta' },
              t('app.slug'),
              ' ',
              el('span', { class: 'cv-num' }, app.slug),
            ),
            el(
              'span',
              { class: 'dsh-meta' },
              t('app.jira'),
              ' ',
              el('span', { class: 'cv-num' }, app.jiraKey || '–'),
            ),
          ),
          app.description === '' ? null : el('p', { class: 'dsh-description' }, app.description),
        ),
        toolbar,
      );
    }
    const nameField = UI.Input({ label: t('apps.nameLabel'), value: app.name, required: true });
    const slugField = UI.Input({
      label: t('apps.slugLabel'),
      value: app.slug,
      mono: true,
      icon: 'hash',
    });
    const jiraField = UI.Input({ label: t('apps.jiraLabel'), value: app.jiraKey });
    const descriptionField = UI.Textarea({
      label: t('apps.descriptionLabel'),
      value: app.description,
      rows: 2,
      maxLength: 1000,
    });
    nameField.input.dataset.focusKey = 'app-name';
    slugField.input.dataset.focusKey = 'app-slug';
    jiraField.input.dataset.focusKey = 'app-jira';
    descriptionField.input.dataset.focusKey = 'app-description';
    for (const field of [nameField, slugField, jiraField, descriptionField]) {
      field.input.setAttribute('data-mutates', '');
    }
    nameField.input.addEventListener('change', () => {
      if (nameField.input.value.trim() === '') {
        nameField.setError(t('apps.nameEmpty'));
        nameField.input.value = app.name;
        return;
      }
      nameField.setError(null);
      store.dispatch({ type: 'update_app', id: app.id, name: nameField.input.value });
    });
    slugField.input.addEventListener('change', () => {
      const slug = slugField.input.value;
      const clean = store.dispatch({ type: 'update_app', id: app.id, slug });
      const taken = store.getState().apps.some((a) => a.id !== app.id && a.slug === slug.trim());
      if (clean.effects.length === 0 && taken) slugField.setError(t('apps.slugTaken', { slug }));
      else if (clean.effects.length === 0) slugField.input.value = app.slug;
      else slugField.setError(null);
    });
    jiraField.input.addEventListener('change', () =>
      store.dispatch({ type: 'update_app', id: app.id, jiraKey: jiraField.input.value }),
    );
    descriptionField.input.addEventListener('change', () =>
      store.dispatch({ type: 'update_app', id: app.id, description: descriptionField.input.value }),
    );
    return el(
      'header',
      { class: 'dsh-header dsh-header--edit' },
      el(
        'div',
        { class: 'dsh-grow dsh-stack dsh-gap-4' },
        el('div', { class: 'dsh-form-grid' }, nameField, slugField, jiraField),
        descriptionField,
        template ? el('div', null, UI.Tag([icon('stack'), template.name])) : null,
      ),
      toolbar,
    );
  }

  /* ---------------- the whole view ---------------- */

  function build() {
    const state = store.getState();
    const app = state.apps.find((a) => a.id === appId);
    if (!app) return [];
    const template = templateOf(state, app);
    if (!template) {
      return [
        header(state, app, null),
        UI.Alert({
          status: 'danger',
          title: t('app.noTemplateTitle'),
          text: t('app.noTemplateText'),
        }),
        el('a', { class: 'cv-link', href: '#/admin/templates' }, t('app.noTemplateAction')),
        extrasCard(state, app),
      ];
    }
    const remembered =
      state.settings.defaultEnv === 'remember'
        ? (readViewMemory(ctx.workspaceId).envs[appId] ?? null)
        : (sessionEnvs.get(appId) ?? null);
    const envKey = activeEnvKey(template, state.settings.defaultEnv, currentEnv ?? remembered);
    const missing = missingByEnv(app, template);

    const uid = UI.fieldId('dsh-env');
    const tabs =
      template.envs.length === 0
        ? UI.Alert({ status: 'info', title: t('app.noEnvTitle'), text: t('app.noEnvText') })
        : el(
            'div',
            { class: 'cv-tabs' },
            el(
              'div',
              { role: 'tablist', 'aria-label': t('app.envTabs') },
              template.envs.map((env, index) =>
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'cv-tab',
                    role: 'tab',
                    id: `${uid}-tab-${index}`,
                    'aria-controls': `${uid}-panel-${index}`,
                    'aria-selected': String(env.key === envKey),
                    'data-env': env.key,
                    'data-focus-key': `tab:${env.key}`,
                  },
                  env.label,
                  (missing[env.key] ?? 0) > 0
                    ? el(
                        'span',
                        { class: 'cv-tab__count' },
                        String(missing[env.key]),
                        el(
                          'span',
                          { class: 'cv-sr-only' },
                          ' ',
                          t('app.missing', { count: missing[env.key] ?? 0 }),
                        ),
                      )
                    : null,
                ),
              ),
            ),
            template.envs.map((env, index) =>
              el(
                'div',
                {
                  class: 'cv-tabpanel dsh-stack dsh-gap-5',
                  role: 'tabpanel',
                  id: `${uid}-panel-${index}`,
                  'aria-labelledby': `${uid}-tab-${index}`,
                  tabindex: 0,
                  hidden: env.key !== envKey,
                },
                metaStrip(app, template, env.key, state.editMode),
                linksCard(state, app, template, env.key),
              ),
            ),
          );
    const tablist = tabs instanceof HTMLElement ? tabs.querySelector('[role="tablist"]') : null;
    // Covenant's own handlers switch the tab; this runs after them (a timeout), once the selected
    // tab is the new one.
    /** @param {Event} event */
    const follow = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[role="tab"]')) return;
      setTimeout(() => {
        const selected = tablist?.querySelector('[role="tab"][aria-selected="true"]');
        if (selected instanceof HTMLElement && selected.dataset.env)
          chooseEnv(selected.dataset.env);
      });
    };
    tablist?.addEventListener('click', follow);
    tablist?.addEventListener('focusin', follow);

    const bulk = el(
      'div',
      { class: 'dsh-row dsh-wrap dsh-gap-2' },
      UI.Button({
        icon: 'arrow-square-out',
        children: t('app.openAll'),
        onclick: () => openAll(app, template),
      }),
      UI.Button({
        variant: 'ghost',
        icon: 'copy',
        children: t('app.copyAll'),
        onclick: () => void copyAll(app, template),
      }),
      state.editMode
        ? UI.Button({
            variant: 'ghost',
            icon: 'plus',
            children: t('app.addEnv'),
            mutates: true,
            onclick: () => addEnv(template),
          })
        : null,
    );
    return [
      header(state, app, template),
      ...(template.envs.length === 0 && !state.editMode ? [] : [bulk]),
      tabs,
      extrasCard(state, app),
    ];
  }

  /** The environment that is shown now. @param {import('../../types.d.ts').Template} template */
  function shownEnv(template) {
    const selected = root.querySelector('[role="tab"][aria-selected="true"]');
    const key = selected instanceof HTMLElement ? selected.dataset.env : undefined;
    return key && template.envs.some((env) => env.key === key) ? key : null;
  }

  /**
   * @param {import('../../types.d.ts').App} app
   * @param {import('../../types.d.ts').Template} template
   */
  function openAll(app, template) {
    const envKey = shownEnv(template);
    if (envKey === null) return;
    const links = resolveLinks(app, template, envKey).filter((r) => r.problem === null);
    for (const { url } of links) {
      const href = safeHref(url);
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    }
    toasts.push({
      variant: 'info',
      title: t('app.opening', { count: links.length }),
      body: t('app.openingBody'),
    });
  }

  /**
   * @param {import('../../types.d.ts').App} app
   * @param {import('../../types.d.ts').Template} template
   */
  async function copyAll(app, template) {
    const envKey = shownEnv(template);
    if (envKey === null) return;
    const links = resolveLinks(app, template, envKey).filter((r) => r.problem === null);
    const ok = await copyText(links.map(({ link, url }) => `${link.name}\t${url}`).join('\n'));
    toasts.push(
      ok
        ? { variant: 'success', title: t('app.copiedAll', { count: links.length }) }
        : { variant: 'danger', title: t('links.copyFailed'), body: t('links.copyFailedBody') },
    );
  }

  /** @param {import('../../types.d.ts').Template} template */
  function addEnv(template) {
    let n = 1;
    while (template.envs.some((e) => e.key === `env${n}`)) n += 1;
    const key = `env${n}`;
    store.dispatch({ type: 'add_env', templateId: template.id, key, label: key.toUpperCase() });
    chooseEnv(key);
    toasts.push({
      variant: 'success',
      title: t('app.envAdded'),
      body: t('app.envAddedBody', { template: template.name }),
    });
  }

  const redraw = createRedraw(root, build);
  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (
      state.apps !== prevState.apps ||
      state.templates !== prevState.templates ||
      state.settings !== prevState.settings ||
      state.search !== prevState.search ||
      state.editMode !== prevState.editMode
    ) {
      if (!state.apps.some((a) => a.id === appId)) return;
      redraw.schedule();
    }
  });
  redraw.draw();

  return {
    el: root,
    destroy: unsubscribe,
    title: () => app0()?.name ?? '',
  };
}
