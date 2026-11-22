// The metadata screen: pick a template, then name the fields each application fills in for each
// of its environments. A field's key is the placeholder a link pattern reads (`{meta.<key>}`).
import { META_FIELD_TYPES, RESERVED_KEYS, normalizeMetaKey } from '../../core/model.js';
import { card, commitInput, commitSelect, dataTable, focusKey } from './parts.js';
import { templateList } from './AdminTemplates.js';
import { createRedraw } from './redraw.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** The name of a field type, in the language of the interface. @param {string} type */
function typeName(type) {
  switch (type) {
    case 'mono':
      return t('meta.typeMono');
    case 'select':
      return t('meta.typeSelect');
    case 'date':
      return t('meta.typeDate');
    default:
      return t('meta.typeText');
  }
}

/**
 * @param {import('./types.js').Context} ctx
 * @param {string | null} templateId from the address
 * @returns {import('./types.js').View}
 */
export function createMetadataView(ctx, templateId) {
  const { store } = ctx;
  const root = el('div', { class: 'dsh-view' });

  function selected() {
    const { templates } = store.getState();
    return templates.find((tpl) => tpl.id === templateId) ?? templates[0] ?? null;
  }

  /** @param {import('../../types.d.ts').Template} template */
  function fieldsCard(template) {
    const rows = template.metaFields.map((field, index) => {
      const n = index + 1;
      return [
        el(
          'span',
          { class: 'dsh-row dsh-gap-1' },
          UI.IconButton({
            icon: 'caret-up',
            label: t('common.moveUp', { name: field.label }),
            size: 'sm',
            disabled: index === 0,
            mutates: true,
            onclick: () =>
              store.dispatch({
                type: 'shift_meta_field',
                templateId: template.id,
                key: field.key,
                delta: -1,
              }),
          }),
          UI.IconButton({
            icon: 'caret-down',
            label: t('common.moveDown', { name: field.label }),
            size: 'sm',
            disabled: index === template.metaFields.length - 1,
            mutates: true,
            onclick: () =>
              store.dispatch({
                type: 'shift_meta_field',
                templateId: template.id,
                key: field.key,
                delta: 1,
              }),
          }),
        ),
        commitInput({
          label: t('meta.fieldLabel', { n }),
          value: field.label,
          focusKey: focusKey('field', index, 'label'),
          onCommit: (value, input) => {
            if (value.trim() === '') input.input.value = field.label;
            else
              store.dispatch({
                type: 'update_meta_field',
                templateId: template.id,
                key: field.key,
                label: value,
              });
          },
        }),
        commitInput({
          label: t('meta.fieldKey', { n }),
          value: field.key,
          mono: true,
          focusKey: focusKey('field', index, 'key'),
          onCommit: (value, input) => {
            const key = normalizeMetaKey(value);
            const result = store.dispatch({
              type: 'update_meta_field',
              templateId: template.id,
              key: field.key,
              newKey: value,
            });
            if (result.effects.length === 0 && key !== field.key) {
              input.setError(
                RESERVED_KEYS.includes(key) ? t('meta.keyReserved', { key }) : t('meta.keyInvalid'),
              );
            }
            if (result.effects.length === 0) input.input.value = field.key;
          },
        }),
        commitSelect({
          label: t('meta.fieldType', { n }),
          value: field.type,
          options: META_FIELD_TYPES.map((type) => ({ value: type, label: typeName(type) })),
          focusKey: focusKey('field', index, 'type'),
          onCommit: (value) =>
            store.dispatch({
              type: 'update_meta_field',
              templateId: template.id,
              key: field.key,
              fieldType: META_FIELD_TYPES.find((type) => type === value) ?? 'text',
            }),
        }),
        field.type === 'select'
          ? commitInput({
              label: t('meta.fieldOptions', { n }),
              value: field.options.join(', '),
              placeholder: t('meta.optionsPlaceholder'),
              focusKey: focusKey('field', index, 'options'),
              onCommit: (value) =>
                store.dispatch({
                  type: 'update_meta_field',
                  templateId: template.id,
                  key: field.key,
                  options: value.split(','),
                }),
            })
          : el('span', { class: 'dsh-meta' }, t('meta.noOptions')),
        UI.IconButton({
          icon: 'trash',
          label: t('meta.fieldDelete', { name: field.label }),
          size: 'sm',
          mutates: true,
          onclick: async () => {
            const ok = await UI.Confirm({
              title: t('meta.deleteTitle'),
              message: t('meta.deleteMessage', { name: field.label }),
              confirmLabel: t('common.delete'),
              danger: true,
            });
            if (ok)
              store.dispatch({
                type: 'delete_meta_field',
                templateId: template.id,
                key: field.key,
              });
          },
        }),
      ];
    });
    return card({
      title: t('meta.fieldsTitle', { name: template.name }),
      subtitle: t('meta.fieldsSubtitle', { count: template.metaFields.length }),
      actions: UI.Button({
        size: 'sm',
        icon: 'plus',
        children: t('meta.add'),
        mutates: true,
        onclick: () => {
          let n = 1;
          while (template.metaFields.some((f) => f.key === `field${n}`)) n += 1;
          store.dispatch({
            type: 'add_meta_field',
            templateId: template.id,
            key: `field${n}`,
            label: t('meta.newLabel'),
            fieldType: 'text',
          });
        },
      }),
      flush: true,
      body:
        template.metaFields.length === 0
          ? el('p', { class: 'dsh-card__empty dsh-meta' }, t('meta.noFields'))
          : dataTable({
              caption: t('meta.fieldsTitle', { name: template.name }),
              columns: [
                t('common.order'),
                t('meta.colLabel'),
                t('meta.colKey'),
                t('meta.colType'),
                t('meta.colOptions'),
                t('common.actions'),
              ],
              rows,
            }),
    });
  }

  function build() {
    const state = store.getState();
    const template = selected();
    return el(
      'div',
      { class: 'dsh-split' },
      card({
        title: t('meta.targetTitle'),
        body:
          state.templates.length === 0
            ? el('p', { class: 'dsh-meta' }, t('meta.noTemplates'))
            : templateList(state, template?.id ?? null, 'metadata'),
      }),
      template
        ? el(
            'div',
            { class: 'dsh-stack dsh-gap-5 dsh-min' },
            UI.Alert({
              status: 'info',
              title: t('meta.helpTitle'),
              text: t('meta.helpText', { example: '{meta.key}', short: '{key}' }),
            }),
            fieldsCard(template),
          )
        : UI.EmptyState({ icon: 'rows', title: t('meta.emptyTitle'), text: t('meta.emptyText') }),
    );
  }

  const redraw = createRedraw(root, build);
  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (state.templates !== prevState.templates || state.apps !== prevState.apps) redraw.schedule();
  });
  redraw.draw();
  return { el: root, destroy: unsubscribe, title: () => t('admin.metadata') };
}
