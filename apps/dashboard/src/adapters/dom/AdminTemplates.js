// The templates screen: the list of templates on the left, the selected one on the right (its
// name and description, its environments and its links). Every field commits when the person
// leaves it. A template that applications use cannot be deleted.
import { availablePlaceholders } from '../../core/links.js';
import { templateUsage } from '../../core/selectors.js';
import {
  addTemplateCommand,
  addTemplateLinkCommand,
  duplicateTemplateCommand,
} from '../commands.js';
import { card, commitInput, commitSelect, dataTable, focusKey } from './parts.js';
import { createRedraw } from './redraw.js';
import * as UI from './ui.js';

const { el, t } = UI;

/**
 * The list of templates (shared with the metadata screen): one link per template, the selected one
 * marked, with the number of applications that use it.
 * @param {import('../../types.d.ts').AppState} state
 * @param {string | null} selectedId
 * @param {'templates' | 'metadata'} page
 * @returns {HTMLElement}
 */
export function templateList(state, selectedId, page) {
  const usage = templateUsage(state);
  return el(
    'ul',
    { class: 'dsh-list' },
    state.templates.map((template) =>
      el(
        'li',
        null,
        el(
          'a',
          {
            class: 'cv-nav-item',
            href: `#/admin/${page}/${encodeURIComponent(template.id)}`,
            'aria-current': template.id === selectedId ? 'page' : null,
            'data-focus-key': `template:${template.id}`,
          },
          el('span', { class: 'dsh-grow dsh-ellipsis' }, template.name),
          el(
            'span',
            { class: 'dsh-nav-count cv-num' },
            String(usage.get(template.id) ?? 0),
            el(
              'span',
              { class: 'cv-sr-only' },
              ' ',
              t('templates.usageSr', { count: usage.get(template.id) ?? 0 }),
            ),
          ),
        ),
      ),
    ),
  );
}

/**
 * @param {import('./types.js').Context} ctx
 * @param {string | null} templateId from the address
 * @returns {import('./types.js').View}
 */
export function createTemplatesView(ctx, templateId) {
  const { store, toasts } = ctx;
  const root = el('div', { class: 'dsh-view' });
  /** The text typed in the filter of the list (not kept). */
  let filter = '';

  function selected() {
    const { templates } = store.getState();
    return templates.find((tpl) => tpl.id === templateId) ?? templates[0] ?? null;
  }

  /** @param {string} id */
  const go = (id) => ctx.navigate({ screen: 'admin', page: 'templates', templateId: id });

  /* ---------------- the list ---------------- */

  function listCard() {
    const state = store.getState();
    const current = selected();
    const usage = templateUsage(state);
    const filterField = UI.Input({
      ariaLabel: t('templates.filter'),
      placeholder: t('templates.filter'),
      type: 'search',
      icon: 'magnifying-glass',
      value: filter,
      oninput: (e) => {
        filter = /** @type {HTMLInputElement} */ (e.target).value;
        redraw.schedule();
      },
    });
    filterField.input.dataset.focusKey = 'filter';
    const needle = filter.trim().toLowerCase();
    const shown = needle
      ? {
          ...state,
          templates: state.templates.filter((tpl) => tpl.name.toLowerCase().includes(needle)),
        }
      : state;
    return card({
      title: t('templates.listTitle'),
      subtitle: t('templates.total', { count: state.templates.length }),
      body: el(
        'div',
        { class: 'dsh-stack dsh-gap-4' },
        filterField,
        shown.templates.length === 0
          ? el('p', { class: 'dsh-meta' }, t('templates.noMatch'))
          : templateList(shown, current?.id ?? null, 'templates'),
        el(
          'div',
          { class: 'dsh-stack dsh-gap-2' },
          UI.Button({
            variant: 'primary',
            icon: 'plus',
            children: t('templates.new'),
            mutates: true,
            onclick: () => {
              const command = addTemplateCommand({
                name: t('templates.newName', { n: state.templates.length + 1 }),
                ownerLabel: t('templates.ownerLabel'),
              });
              store.dispatch(command);
              go(command.template.id);
              toasts.push({
                variant: 'success',
                title: t('templates.created'),
                body: command.template.name,
              });
            },
          }),
          UI.Button({
            variant: 'ghost',
            icon: 'copy',
            children: t('templates.duplicate'),
            disabled: !current,
            mutates: true,
            onclick: () => {
              if (!current) return;
              const command = duplicateTemplateCommand(
                current,
                t('templates.copyName', { name: current.name }),
              );
              store.dispatch(command);
              go(command.template.id);
              toasts.push({
                variant: 'success',
                title: t('templates.duplicated'),
                body: command.template.name,
              });
            },
          }),
          UI.Button({
            variant: 'ghost',
            icon: 'trash',
            children: t('templates.delete'),
            disabled: !current,
            mutates: true,
            onclick: async () => {
              if (!current) return;
              const used = usage.get(current.id) ?? 0;
              if (used > 0) {
                toasts.push({
                  variant: 'danger',
                  title: t('templates.deleteBlocked'),
                  body: t('templates.deleteBlockedBody', { count: used }),
                });
                return;
              }
              const ok = await UI.Confirm({
                title: t('templates.deleteTitle'),
                message: t('templates.deleteMessage', { name: current.name }),
                confirmLabel: t('common.delete'),
                danger: true,
              });
              if (!ok) return;
              store.dispatch({ type: 'delete_template', id: current.id });
              ctx.navigate({ screen: 'admin', page: 'templates', templateId: null });
              toasts.push({ variant: 'info', title: t('templates.deleted'), body: current.name });
            },
          }),
        ),
      ),
    });
  }

  /* ---------------- the detail ---------------- */

  /** @param {import('../../types.d.ts').Template} template */
  function identityCard(template) {
    const usage = templateUsage(store.getState()).get(template.id) ?? 0;
    const name = commitInput({
      label: t('templates.nameLabel'),
      visibleLabel: true,
      value: template.name,
      focusKey: 'template-name',
      onCommit: (value, field) => {
        if (value.trim() === '') {
          field.setError(t('templates.nameEmpty'));
          field.input.value = template.name;
          return;
        }
        field.setError(null);
        store.dispatch({ type: 'update_template', id: template.id, name: value });
      },
    });
    const description = UI.Textarea({
      label: t('templates.descriptionLabel'),
      value: template.description,
      rows: 2,
      maxLength: 1000,
    });
    description.input.dataset.focusKey = 'template-description';
    description.input.setAttribute('data-mutates', '');
    description.input.addEventListener('change', () =>
      store.dispatch({
        type: 'update_template',
        id: template.id,
        description: description.input.value,
      }),
    );
    return card({
      title: t('templates.detailTitle'),
      subtitle: t('templates.usage', { count: usage }),
      body: el('div', { class: 'dsh-stack dsh-gap-4' }, name, description),
    });
  }

  /** @param {import('../../types.d.ts').Template} template */
  function envsCard(template) {
    const rows = template.envs.map((env, index) => {
      const n = index + 1;
      const label = commitInput({
        label: t('templates.envLabel', { n }),
        value: env.label,
        focusKey: focusKey('env', index, 'label'),
        onCommit: (value, field) => {
          if (value.trim() === '') {
            field.input.value = env.label;
            return;
          }
          store.dispatch({
            type: 'update_env',
            templateId: template.id,
            key: env.key,
            label: value,
          });
        },
      });
      const key = commitInput({
        label: t('templates.envKey', { n }),
        value: env.key,
        mono: true,
        focusKey: focusKey('env', index, 'key'),
        onCommit: (value, field) => {
          const result = store.dispatch({
            type: 'update_env',
            templateId: template.id,
            key: env.key,
            newKey: value,
          });
          if (result.effects.length === 0) {
            field.setError(value.trim() === env.key ? null : t('templates.envKeyInvalid'));
            field.input.value = env.key;
          }
        },
      });
      return [
        label,
        key,
        el(
          'span',
          { class: 'dsh-row dsh-gap-1' },
          UI.IconButton({
            icon: 'caret-up',
            label: t('common.moveUp', { name: env.label }),
            size: 'sm',
            disabled: index === 0,
            mutates: true,
            onclick: () =>
              store.dispatch({
                type: 'shift_env',
                templateId: template.id,
                key: env.key,
                delta: -1,
              }),
          }),
          UI.IconButton({
            icon: 'caret-down',
            label: t('common.moveDown', { name: env.label }),
            size: 'sm',
            disabled: index === template.envs.length - 1,
            mutates: true,
            onclick: () =>
              store.dispatch({
                type: 'shift_env',
                templateId: template.id,
                key: env.key,
                delta: 1,
              }),
          }),
          UI.IconButton({
            icon: 'trash',
            label: t('templates.envDelete', { name: env.label }),
            size: 'sm',
            disabled: template.envs.length <= 1,
            mutates: true,
            onclick: async () => {
              const ok = await UI.Confirm({
                title: t('templates.envDeleteTitle'),
                message: t('templates.envDeleteMessage', { name: env.label }),
                confirmLabel: t('common.delete'),
                danger: true,
              });
              if (ok) store.dispatch({ type: 'delete_env', templateId: template.id, key: env.key });
            },
          }),
        ),
      ];
    });
    return card({
      title: t('templates.envsTitle'),
      subtitle: t('templates.envsSubtitle', { placeholder: '{env}' }),
      actions: UI.Button({
        size: 'sm',
        icon: 'plus',
        children: t('common.add'),
        mutates: true,
        onclick: () => {
          let n = 1;
          while (template.envs.some((e) => e.key === `env${n}`)) n += 1;
          const key = `env${n}`;
          store.dispatch({
            type: 'add_env',
            templateId: template.id,
            key,
            label: key.toUpperCase(),
          });
        },
      }),
      flush: true,
      body: dataTable({
        caption: t('templates.envsTitle'),
        columns: [t('templates.colLabel'), t('templates.colKey'), t('common.actions')],
        rows,
      }),
    });
  }

  /** @param {import('../../types.d.ts').Template} template */
  function linksCard(template) {
    const { settings } = store.getState();
    const tagOptions = [
      { value: '', label: t('tags.none') },
      ...settings.tags.map((tag) => ({ value: tag.key, label: tag.label })),
      ...[...new Set(template.links.map((l) => l.tag))]
        .filter((key) => key !== '' && !settings.tags.some((tag) => tag.key === key))
        .map((key) => ({ value: key, label: t('tags.unknown', { key }) })),
    ];
    const rows = template.links.map((link, index) => {
      const n = index + 1;
      return [
        el(
          'span',
          { class: 'dsh-row dsh-gap-1' },
          UI.IconButton({
            icon: 'caret-up',
            label: t('common.moveUp', { name: link.name }),
            size: 'sm',
            disabled: index === 0,
            mutates: true,
            onclick: () =>
              store.dispatch({
                type: 'shift_template_link',
                templateId: template.id,
                id: link.id,
                delta: -1,
              }),
          }),
          UI.IconButton({
            icon: 'caret-down',
            label: t('common.moveDown', { name: link.name }),
            size: 'sm',
            disabled: index === template.links.length - 1,
            mutates: true,
            onclick: () =>
              store.dispatch({
                type: 'shift_template_link',
                templateId: template.id,
                id: link.id,
                delta: 1,
              }),
          }),
        ),
        commitInput({
          label: t('templates.linkName', { n }),
          value: link.name,
          focusKey: focusKey('link', index, 'name'),
          onCommit: (value, field) => {
            if (value.trim() === '') field.input.value = link.name;
            else
              store.dispatch({
                type: 'update_template_link',
                templateId: template.id,
                id: link.id,
                name: value,
              });
          },
        }),
        commitSelect({
          label: t('templates.linkTag', { n }),
          value: link.tag,
          options: tagOptions,
          focusKey: focusKey('link', index, 'tag'),
          onCommit: (value) =>
            store.dispatch({
              type: 'update_template_link',
              templateId: template.id,
              id: link.id,
              tag: value,
            }),
        }),
        commitInput({
          label: t('templates.linkPattern', { n }),
          value: link.pattern,
          mono: true,
          placeholder: t('urls.placeholder'),
          focusKey: focusKey('link', index, 'pattern'),
          onCommit: (value) =>
            store.dispatch({
              type: 'update_template_link',
              templateId: template.id,
              id: link.id,
              pattern: value,
            }),
        }),
        commitSelect({
          label: t('templates.linkScope', { n }),
          value: link.scope,
          options: [
            { value: 'env', label: t('templates.scopeEnv') },
            { value: 'global', label: t('templates.scopeGlobal') },
          ],
          focusKey: focusKey('link', index, 'scope'),
          onCommit: (value) =>
            store.dispatch({
              type: 'update_template_link',
              templateId: template.id,
              id: link.id,
              scope: value === 'global' ? 'global' : 'env',
            }),
        }),
        UI.IconButton({
          icon: 'trash',
          label: t('templates.linkDelete', { name: link.name }),
          size: 'sm',
          mutates: true,
          onclick: async () => {
            const ok = await UI.Confirm({
              title: t('templates.linkDeleteTitle'),
              message: t('templates.linkDeleteMessage', { name: link.name }),
              confirmLabel: t('common.delete'),
              danger: true,
            });
            if (ok)
              store.dispatch({
                type: 'delete_template_link',
                templateId: template.id,
                id: link.id,
              });
          },
        }),
      ];
    });
    return card({
      title: t('templates.linksTitle'),
      subtitle: t('templates.linksSubtitle', { count: template.links.length }),
      actions: UI.Button({
        size: 'sm',
        icon: 'plus',
        children: t('templates.linkAdd'),
        mutates: true,
        onclick: () =>
          store.dispatch(
            addTemplateLinkCommand(template.id, {
              name: t('templates.linkNewName'),
              tag: settings.tags[0]?.key ?? '',
              pattern: 'https://example.com/{slug}/{env}',
            }),
          ),
      }),
      flush: true,
      body:
        template.links.length === 0
          ? el('p', { class: 'dsh-card__empty dsh-meta' }, t('templates.noLinks'))
          : dataTable({
              caption: t('templates.linksTitle'),
              columns: [
                t('common.order'),
                t('templates.colName'),
                t('templates.colTag'),
                t('templates.colPattern'),
                t('templates.colScope'),
                t('common.actions'),
              ],
              rows,
            }),
    });
  }

  /** @param {import('../../types.d.ts').Template} template */
  function placeholdersAlert(template) {
    return UI.Alert({
      status: 'info',
      title: t('templates.placeholdersTitle'),
      text: el(
        'span',
        null,
        availablePlaceholders(template).flatMap((placeholder, index) => [
          index === 0 ? null : ' · ',
          el('code', { class: 'cv-num' }, placeholder),
        ]),
        el('br'),
        t('templates.placeholdersHelp'),
      ),
    });
  }

  function build() {
    const template = selected();
    const state = store.getState();
    return el(
      'div',
      { class: 'dsh-split' },
      listCard(),
      template
        ? el(
            'div',
            { class: 'dsh-stack dsh-gap-5 dsh-min' },
            identityCard(template),
            envsCard(template),
            linksCard(template),
            placeholdersAlert(template),
          )
        : UI.EmptyState({
            icon: 'stack',
            title: t('templates.emptyTitle'),
            text: state.templates.length === 0 ? t('templates.emptyText') : '',
          }),
    );
  }

  const redraw = createRedraw(root, build);
  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (
      state.templates !== prevState.templates ||
      state.apps !== prevState.apps ||
      state.settings !== prevState.settings
    ) {
      redraw.schedule();
    }
  });
  redraw.draw();
  return { el: root, destroy: unsubscribe, title: () => t('admin.templates') };
}
